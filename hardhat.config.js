require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { MAINNET_RPC_URL, ARB_RPC_URL, PRIVATE_KEY } = process.env;

if (!MAINNET_RPC_URL) {
  throw new Error("Missing MAINNET_RPC_URL in .env");
}

if (!ARB_RPC_URL) {
  throw new Error("Missing ARB_RPC_URL in .env");
}

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      chainId: 1,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    arbitrumOne: {
      url: ARB_RPC_URL,
      chainId: 42161,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
