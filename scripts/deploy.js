// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  // ----- App params (adjust as needed) -----
  const NAME = "Dapp University";
  const SYMBOL = "DAPP";
  const MAX_SUPPLY = "1000000"; // If your Token expects 18 decimals in constructor, consider parseUnits("1000000", 18)

  // Quorum is 500k tokens (18 decimals)
  const quorum = hre.ethers.parseUnits("500000", 18);

  // ----- Who is deploying -----
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // ----- Deploy Token -----
  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy(NAME, SYMBOL, MAX_SUPPLY);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log(`Token deployed to: ${tokenAddress}\n`);

  // ----- Deploy DAO -----
  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenAddress, quorum);
  await dao.waitForDeployment();

  const daoAddress = await dao.getAddress();
  console.log(`DAO deployed to: ${daoAddress}\n`);

  // ----- Optional: verify on Etherscan (if available + non-local network) -----
  const networkName = hre.network.name;
  const isLocal =
    networkName === "hardhat" ||
    networkName === "localhost" ||
    networkName === "hardhatLocal";

  if (process.env.ETHERSCAN_API_KEY && !isLocal) {
    try {
      console.log("Verifying Token on Etherscan...");
      await hre.run("verify:verify", {
        address: tokenAddress,
        constructorArguments: [NAME, SYMBOL, MAX_SUPPLY],
      });
    } catch (e) {
      console.warn("Token verification skipped/failed:", e.message ?? e);
    }

    try {
      console.log("Verifying DAO on Etherscan...");
      await hre.run("verify:verify", {
        address: daoAddress,
        constructorArguments: [tokenAddress, quorum],
      });
    } catch (e) {
      console.warn("DAO verification skipped/failed:", e.message ?? e);
    }
  } else {
    console.log(
      "Skipping Etherscan verification (no ETHERSCAN_API_KEY or local network)."
    );
  }

  // Helpful exports for scripts
  return { tokenAddress, daoAddress };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
