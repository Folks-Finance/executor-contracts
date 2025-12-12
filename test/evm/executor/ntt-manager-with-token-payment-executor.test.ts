import { describe, it } from "node:test";

import { expect } from "chai";
import { network } from "hardhat";
import { getAddress, toHex } from "viem";

import { addressToBytes32, unixTime } from "../utils.js";

import {
  CUSTOM_TOKEN_FEE_PREFIX,
  DEFAULT_BASE_FEE,
  DEFAULT_DESTINATION_GAS_PRICE,
  DEFAULT_DESTINATION_ID,
  DEFAULT_DESTINATION_TOKEN_PRICE,
  DEFAULT_QUOTER_ADDRESS,
  DEFAULT_SOURCE_ID,
  DEFAULT_SOURCE_TOKEN_PRICE,
  encodeCustomTokenQuoteInstruction,
  encodeGasInstructions,
  RANDOM_SIGNATURE,
  encodeNttRequestInstruction,
  DEFAULT_NTT_MANAGER_WITH_TOKEN_PAYMENT_EXECUTOR_VERSION,
} from "./token-payment-executor.helper.js";

import type { CustomTokenQuoteInstruction, GasInstruction } from "./types/instructions.js";
import type { Hex } from "viem";

const { networkHelpers, viem } = await network.connect();

describe("NttManagerWithTokenPaymentExecutor (unit tests)", () => {
  const peerAddress: Hex = `0x${"7".repeat(64)}`;

  async function deployRelayerFixture() {
    const [deployer, feeReceiver, refund, user, payee, ...unusedUsers] = await viem.getWalletClients();

    const refundAddress = getAddress(refund.account.address);

    // deploy token mock
    const token = await viem.deployContract("MockERC20Token", ["SomeCoin", "COIN"], { client: { wallet: deployer } });
    const tokenAddress = getAddress(token.address);

    // deploy token2 mock
    const token2 = await viem.deployContract("MockERC20Token", ["SomeCoin2", "COIN2"], {
      client: { wallet: deployer },
    });
    const token2Address = getAddress(token2.address);

    // deploy receiver mock
    const receiver = await viem.deployContract("MockReceiver", [], { client: { wallet: deployer } });
    const receiverAddress = getAddress(receiver.address);

    // deploy executor mock
    const executor = await viem.deployContract("MockExecutor", [DEFAULT_SOURCE_ID], { client: { wallet: deployer } });
    const executorAddress = getAddress(executor.address);

    // deploy tokenPaymentExecutor mock
    const tokenPaymentExecutor = await viem.deployContract("TokenPaymentExecutor", [executorAddress], {
      client: { wallet: deployer },
    });
    const tokenPaymentExecutorAddress = getAddress(tokenPaymentExecutor.address);

    // deploy and config nttManager mock
    const structs = await viem.deployContract("TransceiverStructs", [], { client: { wallet: deployer } });
    const transceiver = await viem.deployContract("MockTransceiver", [], { client: { wallet: deployer } });
    const nttManager = await viem.deployContract(
      "MockNttManager",
      [tokenAddress, 0, DEFAULT_SOURCE_ID, deployer.account.address],
      {
        client: { wallet: deployer },
        libraries: {
          "project/lib/native-token-transfers/evm/src/libraries/TransceiverStructs.sol:TransceiverStructs":
            structs.address,
        },
      }
    );
    await nttManager.write.setTransceiver([transceiver.address], { account: deployer.account });
    await nttManager.write.setPeer([DEFAULT_DESTINATION_ID, peerAddress, 18, 1_000_000_000_000_000_000n], {
      account: deployer.account,
    });
    const nttManagerAddress = getAddress(nttManager.address);

    // deploy nttManagerWithTokenPaymentExecutor
    const nttManagerWithTokenPaymentExecutor = await viem.deployContract(
      "NttManagerWithTokenPaymentExecutor",
      [DEFAULT_SOURCE_ID, tokenPaymentExecutorAddress],
      { client: { wallet: deployer } }
    );
    const nttManagerWithTokenPaymentExecutorAddress = getAddress(nttManagerWithTokenPaymentExecutor.address);

    // mint user balance
    await token.write.mint([user.account.address, 100_000_000_000_000_000_000n]);
    await token2.write.mint([user.account.address, 100_000_000_000_000_000_000n]);

    const payeeAddress = getAddress(payee.account.address);

    return {
      deployer,
      user,
      feeReceiver,
      refund,
      refundAddress,
      unusedUsers,
      executor,
      executorAddress,
      tokenPaymentExecutor,
      tokenPaymentExecutorAddress,
      transceiver,
      nttManager,
      nttManagerAddress,
      nttManagerWithTokenPaymentExecutor,
      nttManagerWithTokenPaymentExecutorAddress,
      token,
      tokenAddress,
      token2,
      token2Address,
      receiver,
      receiverAddress,
      payeeAddress,
    };
  }

  describe("Deployment", () => {
    it("Should set executor correctly", async () => {
      const { nttManagerWithTokenPaymentExecutor, tokenPaymentExecutorAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);
      expect(await nttManagerWithTokenPaymentExecutor.read.VERSION()).to.equal(
        DEFAULT_NTT_MANAGER_WITH_TOKEN_PAYMENT_EXECUTOR_VERSION
      );
      expect(await nttManagerWithTokenPaymentExecutor.read.chainId()).to.equal(DEFAULT_SOURCE_ID);
      expect(await nttManagerWithTokenPaymentExecutor.read.tokenPaymentExecutor()).to.equal(
        tokenPaymentExecutorAddress
      );
    });
  });

  describe("Transfer", () => {
    const gasInstructionsMock: Array<GasInstruction> = [{ gasLimit: 20_000n, msgValue: 0n }];
    const customTokenQuoteInstructionMock: CustomTokenQuoteInstruction = {
      prefix: CUSTOM_TOKEN_FEE_PREFIX,
      quoterAddress: DEFAULT_QUOTER_ADDRESS,
      payeeAddress: `0x${"9".repeat(40)}`,
      sourceChain: DEFAULT_SOURCE_ID,
      destinationChain: DEFAULT_DESTINATION_ID,
      expiryTime: unixTime() + 60n,
      baseFee: DEFAULT_BASE_FEE,
      destinationGasPrice: DEFAULT_DESTINATION_GAS_PRICE,
      sourcePrice: DEFAULT_SOURCE_TOKEN_PRICE,
      destinationPrice: DEFAULT_DESTINATION_TOKEN_PRICE,
      tokenAddress: `0x${"8".repeat(40)}`,
      signature: RANDOM_SIGNATURE,
    };
    const estimatedCost = 500_000_000n;
    const msgId = 0n;
    const nttTransferAmount = 250_000_000_000_000n;
    const encodedInstructions = "0x010003aaaeee";
    const transcieverQuote = 101_000n;

    it("Should throw an error, not enough allowance to pay executor fee", async () => {
      const {
        user,
        nttManagerWithTokenPaymentExecutor,
        nttManagerWithTokenPaymentExecutorAddress,
        transceiver,
        receiverAddress,
        nttManagerAddress,
        refundAddress,
        token,
        tokenAddress,
        payeeAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const signedQuote = encodeCustomTokenQuoteInstruction({
        ...customTokenQuoteInstructionMock,
        tokenAddress,
        payeeAddress,
      });
      const gasInstructions = encodeGasInstructions(gasInstructionsMock);
      await transceiver.write.setQuote([transcieverQuote], { account: user.account });
      await token.write.approve([nttManagerWithTokenPaymentExecutorAddress, estimatedCost + nttTransferAmount - 1n], {
        account: user.account,
      });

      await viem.assertions.revertWithCustomErrorWithArgs(
        nttManagerWithTokenPaymentExecutor.write.transfer(
          [
            estimatedCost,
            nttManagerAddress,
            nttTransferAmount,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            addressToBytes32(refundAddress),
            encodedInstructions,
            { refundAddress, signedQuote, instructions: gasInstructions },
            { dbps: 0, payee: user.account.address },
          ],
          { account: user.account, value: transcieverQuote }
        ),
        token,
        "ERC20InsufficientAllowance",
        [nttManagerWithTokenPaymentExecutorAddress, estimatedCost - 1n, estimatedCost]
      );
    });

    it("Should throw an error when token address is not ERC20", async () => {
      const {
        user,
        nttManagerWithTokenPaymentExecutor,
        nttManagerWithTokenPaymentExecutorAddress,
        transceiver,
        receiverAddress,
        nttManagerAddress,
        refundAddress,
        token,
        payeeAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const quoteTokenAddress: Hex = `0x${"3".repeat(40)}`;

      const signedQuote = encodeCustomTokenQuoteInstruction({
        ...customTokenQuoteInstructionMock,
        tokenAddress: quoteTokenAddress,
        payeeAddress,
      });
      const gasInstructions = encodeGasInstructions(gasInstructionsMock);
      await transceiver.write.setQuote([transcieverQuote], { account: user.account });
      await token.write.approve([nttManagerWithTokenPaymentExecutorAddress, nttTransferAmount], {
        account: user.account,
      });

      await viem.assertions.revertWithCustomErrorWithArgs(
        nttManagerWithTokenPaymentExecutor.write.transfer(
          [
            estimatedCost,
            nttManagerAddress,
            nttTransferAmount,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            addressToBytes32(refundAddress),
            encodedInstructions,
            { refundAddress, signedQuote, instructions: gasInstructions },
            { dbps: 0, payee: user.account.address },
          ],
          { account: user.account, value: transcieverQuote }
        ),
        nttManagerWithTokenPaymentExecutor,
        "SafeERC20FailedOperation",
        [quoteTokenAddress]
      );
    });

    it("Should make NTT transfer, produce PaymentInToken event and call executor (same token for NTT and executor fee)", async () => {
      const {
        user,
        executor,
        tokenPaymentExecutor,
        nttManager,
        nttManagerWithTokenPaymentExecutor,
        nttManagerWithTokenPaymentExecutorAddress,
        transceiver,
        receiverAddress,
        nttManagerAddress,
        refundAddress,
        token,
        tokenAddress,
        payeeAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const signedQuote = encodeCustomTokenQuoteInstruction({
        ...customTokenQuoteInstructionMock,
        tokenAddress,
        payeeAddress,
      });
      const gasInstructions = encodeGasInstructions(gasInstructionsMock);
      const requestInstructions = encodeNttRequestInstruction({
        srcChain: DEFAULT_SOURCE_ID,
        srcManager: nttManagerAddress,
        messageId: addressToBytes32(toHex(msgId)),
      });
      const userBalanceBefore = await token.read.balanceOf([user.account.address]);
      const payeeBalanceBefore = await token.read.balanceOf([payeeAddress]);

      await transceiver.write.setQuote([transcieverQuote], { account: user.account });
      await token.write.approve([nttManagerWithTokenPaymentExecutorAddress, estimatedCost + nttTransferAmount], {
        account: user.account,
      });

      const tx = nttManagerWithTokenPaymentExecutor.write.transfer(
        [
          estimatedCost,
          nttManagerAddress,
          nttTransferAmount,
          DEFAULT_DESTINATION_ID,
          addressToBytes32(receiverAddress),
          addressToBytes32(refundAddress),
          encodedInstructions,
          { refundAddress, signedQuote, instructions: gasInstructions },
          { dbps: 0, payee: user.account.address },
        ],
        { account: user.account, value: transcieverQuote }
      );

      await viem.assertions.emitWithArgs(tx, nttManager, "TransferSent", [
        addressToBytes32(receiverAddress).toLowerCase(),
        addressToBytes32(refundAddress).toLowerCase(),
        nttTransferAmount,
        transcieverQuote,
        DEFAULT_DESTINATION_ID,
        msgId,
      ]);
      await viem.assertions.emitWithArgs(tx, tokenPaymentExecutor, "PaymentInToken", [tokenAddress, estimatedCost]);
      await viem.assertions.emitWithArgs(tx, executor, "RequestForExecution", [
        DEFAULT_QUOTER_ADDRESS,
        0n,
        DEFAULT_DESTINATION_ID,
        peerAddress,
        refundAddress,
        signedQuote,
        requestInstructions,
        gasInstructions,
      ]);

      const userBalanceAfter = await token.read.balanceOf([user.account.address]);
      const payeeBalanceAfter = await token.read.balanceOf([payeeAddress]);
      expect(userBalanceBefore).to.equal(userBalanceAfter + estimatedCost + nttTransferAmount);
      expect(payeeBalanceBefore).to.equal(payeeBalanceAfter - estimatedCost);
    });

    it("Should make NTT transfer, produce PaymentInToken event and call executor (different token for NTT and executor fee)", async () => {
      const {
        user,
        executor,
        tokenPaymentExecutor,
        nttManager,
        nttManagerWithTokenPaymentExecutor,
        nttManagerWithTokenPaymentExecutorAddress,
        transceiver,
        receiverAddress,
        nttManagerAddress,
        refundAddress,
        token,
        token2,
        token2Address,
        payeeAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const signedQuote = encodeCustomTokenQuoteInstruction({
        ...customTokenQuoteInstructionMock,
        tokenAddress: token2Address,
        payeeAddress,
      });
      const gasInstructions = encodeGasInstructions(gasInstructionsMock);
      const requestInstructions = encodeNttRequestInstruction({
        srcChain: DEFAULT_SOURCE_ID,
        srcManager: nttManagerAddress,
        messageId: addressToBytes32(toHex(msgId)),
      });
      const userBalanceTokenBefore = await token.read.balanceOf([user.account.address]);
      const payeeBalanceToken2Before = await token2.read.balanceOf([payeeAddress]);
      const userBalanceToken2Before = await token2.read.balanceOf([user.account.address]);

      await transceiver.write.setQuote([transcieverQuote], { account: user.account });
      await token.write.approve([nttManagerWithTokenPaymentExecutorAddress, nttTransferAmount], {
        account: user.account,
      });
      await token2.write.approve([nttManagerWithTokenPaymentExecutorAddress, estimatedCost], { account: user.account });

      const tx = nttManagerWithTokenPaymentExecutor.write.transfer(
        [
          estimatedCost,
          nttManagerAddress,
          nttTransferAmount,
          DEFAULT_DESTINATION_ID,
          addressToBytes32(receiverAddress),
          addressToBytes32(refundAddress),
          encodedInstructions,
          { refundAddress, signedQuote, instructions: gasInstructions },
          { dbps: 0, payee: user.account.address },
        ],
        { account: user.account, value: transcieverQuote }
      );
      await viem.assertions.emitWithArgs(tx, nttManager, "TransferSent", [
        addressToBytes32(receiverAddress).toLowerCase(),
        addressToBytes32(refundAddress).toLowerCase(),
        nttTransferAmount,
        transcieverQuote,
        DEFAULT_DESTINATION_ID,
        msgId,
      ]);
      await viem.assertions.emitWithArgs(tx, tokenPaymentExecutor, "PaymentInToken", [token2Address, estimatedCost]);
      await viem.assertions.emitWithArgs(tx, executor, "RequestForExecution", [
        DEFAULT_QUOTER_ADDRESS,
        0n,
        DEFAULT_DESTINATION_ID,
        peerAddress,
        refundAddress,
        signedQuote,
        requestInstructions,
        gasInstructions,
      ]);

      const userBalanceTokenAfter = await token.read.balanceOf([user.account.address]);
      const payeeBalanceToken2After = await token2.read.balanceOf([payeeAddress]);
      const userBalanceToken2After = await token2.read.balanceOf([user.account.address]);
      expect(userBalanceTokenBefore).to.equal(userBalanceTokenAfter + nttTransferAmount);
      expect(payeeBalanceToken2Before).to.equal(payeeBalanceToken2After - estimatedCost);
      expect(userBalanceToken2Before).to.equal(userBalanceToken2After + estimatedCost);
    });
  });
});
