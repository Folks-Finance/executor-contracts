import { describe, it } from "node:test";

import { expect } from "chai";
import { network } from "hardhat";
import { getAddress } from "viem";

import { addressToBytes32, unixTime } from "../utils.js";

import {
  CUSTOM_TOKEN_FEE_PREFIX,
  DEFAULT_BASE_FEE,
  DEFAULT_DESTINATION_GAS_PRICE,
  DEFAULT_DESTINATION_ID,
  DEFAULT_DESTINATION_TOKEN_PRICE,
  DEFAULT_TOKEN_PAYMENT_EXECUTOR_VERSION,
  DEFAULT_QUOTER_ADDRESS,
  DEFAULT_SOURCE_ID,
  DEFAULT_SOURCE_TOKEN_PRICE,
  encodeCustomTokenQuoteInstruction,
  encodeGasInstructions,
  encodeNativeTokenQuoteInstruction,
  encodeVAAv1RequestInstruction,
  NATIVE_TOKEN_FEE_PREFIX,
  RANDOM_SIGNATURE,
} from "./token-payment-executor.helper.js";

import type {
  CustomTokenQuoteInstruction,
  GasInstruction,
  NativeTokenQuoteInstruction,
  VAAv1RequestInstruction,
} from "./types/instructions.js";
import type { Hex } from "viem";

const { networkHelpers, viem } = await network.connect();

async function deployRelayerFixture() {
  const [deployer, feeReceiver, refund, user, payee, ...unusedUsers] = await viem.getWalletClients();

  // deploy token mock
  const token = await viem.deployContract("MockERC20Token", ["SomeCoin", "COIN"], { client: { wallet: deployer } });
  const tokenAddress = getAddress(token.address);

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

  // mint user balance
  await token.write.mint([user.account.address, 100_000_000_000_000_000_000n]);

  const payeeAddress = getAddress(payee.account.address);
  const refundAddress = getAddress(refund.account.address);

  return {
    deployer,
    user,
    feeReceiver,
    refund,
    unusedUsers,
    executor,
    executorAddress,
    tokenPaymentExecutor,
    tokenPaymentExecutorAddress,
    token,
    tokenAddress,
    receiver,
    receiverAddress,
    payeeAddress,
    refundAddress,
  };
}

describe("TokenPaymentExecutor (unit tests)", () => {
  describe("Deployment", () => {
    it("Should set executor correctly", async () => {
      const { tokenPaymentExecutor, executorAddress } = await networkHelpers.loadFixture(deployRelayerFixture);
      expect(await tokenPaymentExecutor.read.EXECUTOR_VERSION()).to.equal(DEFAULT_TOKEN_PAYMENT_EXECUTOR_VERSION);
      expect(await tokenPaymentExecutor.read.executor()).to.equal(executorAddress);
    });
  });

  describe("RequestExecution", () => {
    const gasInstructionsMock: Array<GasInstruction> = [{ gasLimit: 20_000n, msgValue: 0n }];
    const nativeTokenQuoteInstructionMock: NativeTokenQuoteInstruction = {
      prefix: NATIVE_TOKEN_FEE_PREFIX,
      quoterAddress: DEFAULT_QUOTER_ADDRESS,
      payeeAddress: `0x${"9".repeat(40)}`,
      sourceChain: DEFAULT_SOURCE_ID,
      destinationChain: DEFAULT_DESTINATION_ID,
      expiryTime: unixTime() + 60n,
      baseFee: DEFAULT_BASE_FEE,
      destinationGasPrice: DEFAULT_DESTINATION_GAS_PRICE,
      sourcePrice: DEFAULT_SOURCE_TOKEN_PRICE,
      destinationPrice: DEFAULT_DESTINATION_TOKEN_PRICE,
      signature: RANDOM_SIGNATURE,
    };
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

    const VAAv1RequestInstructionMock: VAAv1RequestInstruction = {
      emitterChain: DEFAULT_SOURCE_ID,
      emitterAddress: "0x0000000000000000000000000000000000000000",
      sequence: 0n,
    };

    it(`Should throw an error when calling TokenPaymentExecutor with quote prefix other than ${CUSTOM_TOKEN_FEE_PREFIX}`, async () => {
      const { user, tokenPaymentExecutor, receiverAddress, refundAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      await viem.assertions.revertWithCustomErrorWithArgs(
        tokenPaymentExecutor.write.requestExecutionWithTokenPayment(
          [
            100_000n,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            refundAddress,
            encodeNativeTokenQuoteInstruction(nativeTokenQuoteInstructionMock),
            encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
            encodeGasInstructions(gasInstructionsMock),
          ],
          { account: user.account }
        ),
        tokenPaymentExecutor,
        "PrefixMismatch",
        [NATIVE_TOKEN_FEE_PREFIX, CUSTOM_TOKEN_FEE_PREFIX]
      );
    });

    it("Should throw an error when payee address is not valid solidity address", async () => {
      const { user, tokenPaymentExecutor, receiverAddress, refundAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const payeeAddress: Hex = `0x${"1".repeat(64)}`;

      await viem.assertions.revertWithCustomErrorWithArgs(
        tokenPaymentExecutor.write.requestExecutionWithTokenPayment(
          [
            100_000n,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            refundAddress,
            encodeCustomTokenQuoteInstruction({ ...customTokenQuoteInstructionMock, payeeAddress }),
            encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
            encodeGasInstructions(gasInstructionsMock),
          ],
          { account: user.account }
        ),
        tokenPaymentExecutor,
        "NotAnEvmAddress",
        [payeeAddress]
      );
    });

    it("Should throw an error when token address is not valid solidity address", async () => {
      const { user, tokenPaymentExecutor, receiverAddress, refundAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const tokenAddress: Hex = `0x${"2".repeat(64)}`;

      await viem.assertions.revertWithCustomErrorWithArgs(
        tokenPaymentExecutor.write.requestExecutionWithTokenPayment(
          [
            100_000n,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            refundAddress,
            encodeCustomTokenQuoteInstruction({ ...customTokenQuoteInstructionMock, tokenAddress }),
            encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
            encodeGasInstructions(gasInstructionsMock),
          ],
          { account: user.account }
        ),
        tokenPaymentExecutor,
        "NotAnEvmAddress",
        [tokenAddress]
      );
    });

    it("Should throw an error when token address is not ERC20", async () => {
      const { user, tokenPaymentExecutor, receiverAddress, refundAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const tokenAddress: Hex = `0x${"3".repeat(40)}`;

      await viem.assertions.revertWithCustomErrorWithArgs(
        tokenPaymentExecutor.write.requestExecutionWithTokenPayment(
          [
            100_000n,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            refundAddress,
            encodeCustomTokenQuoteInstruction({ ...customTokenQuoteInstructionMock, tokenAddress }),
            encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
            encodeGasInstructions(gasInstructionsMock),
          ],
          { account: user.account }
        ),
        tokenPaymentExecutor,
        "SafeERC20FailedOperation",
        [tokenAddress]
      );
    });

    it("Should throw an error when is not enough allowance to take payment", async () => {
      const {
        user,
        tokenPaymentExecutor,
        tokenPaymentExecutorAddress,
        receiverAddress,
        refundAddress,
        token,
        tokenAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const estimatedCost = 100_000n;

      await viem.assertions.revertWithCustomErrorWithArgs(
        tokenPaymentExecutor.write.requestExecutionWithTokenPayment(
          [
            estimatedCost,
            DEFAULT_DESTINATION_ID,
            addressToBytes32(receiverAddress),
            refundAddress,
            encodeCustomTokenQuoteInstruction({ ...customTokenQuoteInstructionMock, tokenAddress }),
            encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
            encodeGasInstructions(gasInstructionsMock),
          ],
          { account: user.account }
        ),
        token,
        "ERC20InsufficientAllowance",
        [tokenPaymentExecutorAddress, 0n, estimatedCost]
      );
    });

    it("Should accept payment, produce PaymentInToken event and call executor", async () => {
      const {
        user,
        executor,
        tokenPaymentExecutor,
        tokenPaymentExecutorAddress,
        receiverAddress,
        refundAddress,
        token,
        tokenAddress,
        payeeAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const estimatedCost = 500_000_000n;

      const userBalanceBefore = await token.read.balanceOf([user.account.address]);
      const payeeBalanceBefore = await token.read.balanceOf([payeeAddress]);
      await token.write.approve([tokenPaymentExecutorAddress, estimatedCost * 10n], { account: user.account });

      const tx = tokenPaymentExecutor.write.requestExecutionWithTokenPayment(
        [
          estimatedCost,
          DEFAULT_DESTINATION_ID,
          addressToBytes32(receiverAddress),
          refundAddress,
          encodeCustomTokenQuoteInstruction({
            ...customTokenQuoteInstructionMock,
            tokenAddress,
            payeeAddress,
          }),
          encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
          encodeGasInstructions(gasInstructionsMock),
        ],
        { account: user.account }
      );

      await viem.assertions.emitWithArgs(tx, tokenPaymentExecutor, "PaymentInToken", [tokenAddress, estimatedCost]);
      await viem.assertions.emitWithArgs(tx, executor, "RequestForExecution", [
        DEFAULT_QUOTER_ADDRESS,
        0n,
        DEFAULT_DESTINATION_ID,
        addressToBytes32(receiverAddress).toLowerCase(),
        refundAddress,
        encodeCustomTokenQuoteInstruction({
          ...customTokenQuoteInstructionMock,
          tokenAddress,
          payeeAddress,
        }),
        encodeVAAv1RequestInstruction(VAAv1RequestInstructionMock),
        encodeGasInstructions(gasInstructionsMock),
      ]);

      const userBalanceAfter = await token.read.balanceOf([user.account.address]);
      const payeeBalanceAfter = await token.read.balanceOf([payeeAddress]);
      expect(userBalanceBefore).to.equal(userBalanceAfter + estimatedCost);
      expect(payeeBalanceBefore).to.equal(payeeBalanceAfter - estimatedCost);
    });
  });
});
