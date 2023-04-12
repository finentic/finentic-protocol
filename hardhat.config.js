require("@nomicfoundation/hardhat-toolbox")
require('@nomiclabs/hardhat-ethers')
require("@nomiclabs/hardhat-etherscan")
require('solidity-coverage')
require('dotenv').config()

const { PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  defaultNetwork: "fuji",
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      forking: { url: "https://api.avax-test.network/ext/bc/C/rpc" }
    },
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [PRIVATE_KEY],
    },
  },
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  mocha: {
    timeout: 200000
  }
}
