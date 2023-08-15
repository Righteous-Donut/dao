// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const config = require('../src/config.json')

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), 'ether')
}

const ether = tokens

async function main() {
      console.log(`Fetching accounts & network...\n`)

      const accounts = await ethers.getSigners()
      const funder = accounts[0]
      const investor1 = accounts[1]
      const investor2 = accounts[2]
      const investor3 = accounts[3]
      const recipient = accounts[4]

      let transaction

      // Fetch network
      const { chainId } = await ethers.provider.getNetwork()
      console.log(chainId)

      console.log(`Fetching token and transferring to accounts...\n`)

      const token = await ethers.getContractAt('Token', config[chainId].token.address)
      console.log(`Token fetched: ${token.address}\n`)

      // Send tokens to investors - each one gets 20%
      transaction = await token.transfer(investor1.address, tokens(200000))
      await transaction.wait()

      transaction = await token.transfer(investor2.address, tokens(200000))
      await transaction.wait()

      transaction = await token.transfer(investor3.address, tokens(200000))
      await transaction.wait()

      console.log(`Fetching dao...\n`)

      // Fetch deployed dao
      const dao = await ethers.getContractAt('DAO', config[chainId].dao.address)
      console.log('DAO fetched: ${dao.address}\n')

      // Funder sends ether to DAO treasury
      transaction = await funder.sendTransaction({ to: dao.address, value: ether(1000) }) // 1,000 ether
      await transaction.wait()
      console.log(`Sent funds to dao treasury...\n`)

      for(var i = 0; i < 3; i++) {

      // Create proposal
      transaction = await dao.connect(investor1).createProposal(`Proposal ${i + 1}`, ether(100), recipient.address)
      await transaction.wait()
      // Vote 1
      transaction = await dao.connect(investor1).vote(i + 1)
      await transaction.wait()

      // Vote 2
      transaction = await dao.connect(investor2).vote(i + 1)
      await transaction.wait()

      // Vote 3
      transaction = await dao.connect(investor3).vote(i + 1)
      await transaction.wait()

      // Finalize
      transaction = await dao.connect(investor1).finalizeProposal(i + 1)
      await transaction.wait()

      console.log(`Created & Finalized Proposal ${i + 1}\n`)

  }

    console.log(`Creating one more proposal...\n`)

    // Create one more proposal
    transaction = await dao.connect(investor1).createProposal(`Proposal 4`, ether(100), recipient.address)
    await transaction.wait()

    // Vote 1
    transaction = await dao.connect(investor2).vote(4)
    await transaction.wait()

    // Vote 2
    transaction = await dao.connect(investor3).vote(4)
    await transaction.wait()

    console.log(`Finished.\n`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
