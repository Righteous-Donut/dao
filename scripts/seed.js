const hre = require("hardhat");
const config = require("../src/config.json");

const { ethers } = hre;

const TRANSFER_AMOUNT = "100000";
const TREASURY_FUNDING_ETH = "0.0005";
const DEBUG = false;

function getNetworkConfig(chainId) {
  const networkConfig = config[chainId];

  if (!networkConfig) {
    throw new Error(`No config found for chainId ${chainId}`);
  }

  return networkConfig;
}

function validateAddress(label, address, chainId) {
  if (!address || !ethers.isAddress(address)) {
    throw new Error(`Invalid ${label} address for chainId ${chainId}: "${address}"`);
  }
}

async function logCodeIfDebug(label, address) {
  if (!DEBUG) return;

  const code = await ethers.provider.getCode(address);
  console.log(`${label} code:`, code);
}

async function transferTokens(token, recipient, amount, label) {
  const tx = await token.transfer(recipient, amount);
  await tx.wait();

  const balance = await token.balanceOf(recipient);
  console.log(`${label} balance:`, ethers.formatUnits(balance, 18));
}

async function fundTreasury(sender, daoAddress, amount) {
  const tx = await sender.sendTransaction({
    to: daoAddress,
    value: amount,
  });

  await tx.wait();
  console.log(`DAO treasury funded with ${ethers.formatEther(amount)} ETH`);
}

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();

  console.log("Network:", network.name);
  console.log("Chain ID:", chainId);

  const networkConfig = getNetworkConfig(chainId);

  const daoAddress = networkConfig.dao?.address;
  const tokenAddress = networkConfig.token?.address;

  validateAddress("DAO", daoAddress, chainId);
  validateAddress("Token", tokenAddress, chainId);

  const [deployer, investor1, investor2] = await ethers.getSigners();

  console.log("Seeder:", deployer.address);
  console.log("DAO:", daoAddress);
  console.log("Token:", tokenAddress);

  await logCodeIfDebug("DAO", daoAddress);
  await logCodeIfDebug("Token", tokenAddress);

  const dao = await ethers.getContractAt("DAO", daoAddress);
  const token = await ethers.getContractAt("Token", tokenAddress);

  const transferAmount = ethers.parseUnits(TRANSFER_AMOUNT, 18);
  const treasuryFunding = ethers.parseEther(TREASURY_FUNDING_ETH);

  console.log("Transferring tokens...");
  await transferTokens(token, investor1.address, transferAmount, "Investor1");
  await transferTokens(token, investor2.address, transferAmount, "Investor2");

  console.log("Funding DAO treasury...");
  const daoAddressResolved = await dao.getAddress();
  await fundTreasury(deployer, dao.address, treasuryFunding);

  console.log("Seeding complete ✅");
}

main().catch((error) => {
  console.error("Seed failed:");
  console.error(error);
  process.exit(1);
});
