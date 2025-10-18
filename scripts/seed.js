// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const path = require("path");

// Load addresses from the frontend config
// NOTE: keep this path correct relative to scripts/seed.js
const config = require(path.join(__dirname, "..", "src", "config.json"));

const tokens = (n) => hre.ethers.utils.parseUnits(n.toString(), "ether");
const ether = tokens;

async function main() {
  const { ethers } = hre;

  console.log("➡️  Fetching accounts & network...\n");
  const [funder, investor1, investor2, investor3, recipient] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  // ---------- Validate config for this chain ----------
  const netCfg = config[String(chainId)] || config[chainId];
  if (!netCfg) {
    throw new Error(
      `No config entry for chainId ${chainId}. ` +
      `Add an object like:\n` +
      `{\n  "${chainId}": {\n    "token": { "address": "<deployed Token address>" },\n    "dao": { "address": "<deployed DAO address>" }\n  }\n}`
    );
  }

  const tokenAddress = netCfg?.token?.address;
  const daoAddress   = netCfg?.dao?.address;

  if (!tokenAddress) {
    throw new Error(
      `config.json for chainId ${chainId} is missing token.address`
    );
  }
  if (!daoAddress) {
    throw new Error(
      `config.json for chainId ${chainId} is missing dao.address`
    );
  }

  // ---------- Verify contracts actually exist on-chain ----------
  const tokenCode = await ethers.provider.getCode(tokenAddress);
  if (!tokenCode || tokenCode === "0x") {
    throw new Error(
      `No contract code found at Token ${tokenAddress} on chain ${chainId}. ` +
      `Make sure you've deployed and updated config.json.`
    );
  }

  const daoCode = await ethers.provider.getCode(daoAddress);
  if (!daoCode || daoCode === "0x") {
    throw new Error(
      `No contract code found at DAO ${daoAddress} on chain ${chainId}. ` +
      `Make sure you've deployed and updated config.json.`
    );
  }

  // ---------- Connect to deployed contracts ----------
  console.log("➡️  Connecting to Token & DAO...\n");
  const token = await ethers.getContractAt("Token", tokenAddress);
  const dao   = await ethers.getContractAt("DAO", daoAddress);
  console.log(`✅ Token: ${token.address}`);
  console.log(`✅ DAO:   ${dao.address}\n`);

  // ---------- Seed token balances ----------
  console.log("➡️  Transferring tokens to investors...\n");
  // adjust amounts to match your Token decimals / total supply
  await (await token.transfer(investor1.address, tokens(200_000))).wait();
  await (await token.transfer(investor2.address, tokens(200_000))).wait();
  await (await token.transfer(investor3.address, tokens(200_000))).wait();
  console.log("✅ Token transfers complete.\n");

  // ---------- Fund DAO treasury ----------
  console.log("➡️  Funding DAO treasury with 1,000 ETH (local test ETH)...\n");
  await (await funder.sendTransaction({ to: dao.address, value: ether(1_000) })).wait();
  console.log("✅ DAO treasury funded.\n");

  // ---------- Create / vote / finalize a few proposals ----------
  console.log("➡️  Creating and finalizing 3 proposals...\n");
  for (let i = 0; i < 3; i++) {
    const id = i + 1;

    // Create
    await (await dao.connect(investor1).createProposal(`Proposal ${id}`, ether(100), recipient.address)).wait();

    // Vote yes from 3 investors
    await (await dao.connect(investor1).vote(id, true)).wait();
    await (await dao.connect(investor2).vote(id, true)).wait();
    await (await dao.connect(investor3).vote(id, true)).wait();

    // Finalize
    try {
      await (await dao.connect(investor1).finalizeProposal(id)).wait();
      console.log(`✅ Created & Finalized Proposal ${id}`);
    } catch (e) {
      console.log(`⚠️  Proposal ${id} finalize failed: ${e?.reason || e?.message || e}`);
    }
  }

  console.log("\n➡️  Creating one more proposal (leave un-finalized for UI testing)...\n");
  await (await dao.connect(investor1).createProposal(`Proposal 4`, ether(100), recipient.address)).wait();
  await (await dao.connect(investor2).vote(4, true)).wait();
  await (await dao.connect(investor3).vote(4, true)).wait();

  console.log("🎉 Seeding finished.\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
