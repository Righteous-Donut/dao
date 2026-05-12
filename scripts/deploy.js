const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deployer:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const NAME = "Dapp University";
  const SYMBOL = "DAPP";
  const TOTAL_SUPPLY = "1000000";

  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy(NAME, SYMBOL, TOTAL_SUPPLY);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("Token deployed at:", tokenAddress);

  const quorum = hre.ethers.parseUnits("500000", 18);

  const DAO = await hre.ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(tokenAddress, quorum);
  await dao.waitForDeployment();

  const daoAddress = await dao.getAddress();
  console.log("DAO deployed at:", daoAddress);

  // const tx = await deployer.sendTransaction({
  //   to: daoAddress,
  //   value: hre.ethers.parseEther("0.0005"),
  // });
  // await tx.wait();

  console.log("Sent 0.0005 ETH to DAO treasury");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
