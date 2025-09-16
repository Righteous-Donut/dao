require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();


const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY is not defined in your .env file");
}


module.exports = {
  solidity: "0.8.9",
  networks: {
    // Localhost Network
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337, // Hardhat localhost default chain ID
    },
    
    // Sepolia Testnet
    sepolia: {
      url: "https://rpc.sepolia.org", // Public RPC URL for Sepolia
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    
    // Mainnet
    mainnet: {
      url: "https://mainnet.infura.io/v3/",
      accounts: [PRIVATE_KEY],
      chainId: 1,
    },
  },
};
