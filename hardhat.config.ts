import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  solidity: {
    version: "0.8.23",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: ["./executor_contracts/evm", "./lib/native-token-transfers/evm/src/libraries"],
    tests: "./test/evm",
  },
  plugins: [hardhatNetworkHelpers, hardhatViem, hardhatViemAssertions, hardhatNodeTestRunner],
});
