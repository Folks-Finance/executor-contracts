import { describe, it } from "node:test";

import { expect } from "chai";
import { network } from "hardhat";
import { encodeErrorResult, getAddress } from "viem";

import { BUILTIN_ERRORS_ABI } from "../constants.js";

import { RETURN_DATA_TRUNCATION_THRESHOLD } from "./token-payment-executor.helper.js";

export const RECEIVE_MESSAGE_VAA_VERSION = "SafeVAAv1ReceiveWithGasDropOff-0.0.1";
export const DEFAULT_MESSAGE_ID = "0xfe95a52131cb8ed4ffa27e845e54f438b420ad25000000000000000000000001";

const { networkHelpers, viem } = await network.connect();

async function deployRelayerFixture() {
  const [deployer, feeReceiver, refund, user, payee, receiver, ...unusedUsers] = await viem.getWalletClients();

  // deploy MockVAAv1ReceiveWithGasDropOff
  const mockVAAv1ReceiveWithGasDropOff = await viem.deployContract("MockVAAv1ReceiveWithGasDropOff", [], {
    client: { wallet: deployer },
  });
  const mockVAAv1ReceiveWithGasDropOffAddress = getAddress(mockVAAv1ReceiveWithGasDropOff.address);

  // deploy SafeVAAv1ReceiveWithGasDropOff
  const safeVAAv1ReceiveWithGasDropOff = await viem.deployContract(
    "SafeVAAv1ReceiveWithGasDropOff",
    [mockVAAv1ReceiveWithGasDropOffAddress],
    { client: { wallet: deployer } }
  );
  const safeVAAv1ReceiveWithGasDropOffAddress = getAddress(safeVAAv1ReceiveWithGasDropOff.address);

  const payeeAddress = getAddress(payee.account.address);
  const receiverAddress = getAddress(receiver.account.address);

  return {
    deployer,
    user,
    feeReceiver,
    refund,
    unusedUsers,
    mockVAAv1ReceiveWithGasDropOff,
    mockVAAv1ReceiveWithGasDropOffAddress,
    safeVAAv1ReceiveWithGasDropOff,
    safeVAAv1ReceiveWithGasDropOffAddress,
    payeeAddress,
    receiverAddress,
  };
}

describe("SafeVAAv1ReceiveWithGasDropOff (unit tests)", () => {
  describe("Deployment", () => {
    it("Should set VAA receiver correctly", async () => {
      const { safeVAAv1ReceiveWithGasDropOff, mockVAAv1ReceiveWithGasDropOffAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);
      expect(await safeVAAv1ReceiveWithGasDropOff.read.VERSION()).to.equal(RECEIVE_MESSAGE_VAA_VERSION);
      expect(await safeVAAv1ReceiveWithGasDropOff.read.VAAv1ReceiveWithGasDropOff()).to.equal(
        mockVAAv1ReceiveWithGasDropOffAddress
      );
    });
  });

  describe("Safe receive message", () => {
    it(`Should log silent error when transaction run out of gas`, async () => {
      const { user, safeVAAv1ReceiveWithGasDropOff, receiverAddress, payeeAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      await viem.assertions.emitWithArgs(
        safeVAAv1ReceiveWithGasDropOff.write.receiveMessage(
          [receiverAddress, "0x", payeeAddress, 0n, 1000n, DEFAULT_MESSAGE_ID],
          { account: user.account }
        ),
        safeVAAv1ReceiveWithGasDropOff,
        "VAAMessageReceived",
        [DEFAULT_MESSAGE_ID, false, "0x"]
      );
    });

    it(`Should log error if receiver produce custom error`, async () => {
      const { user, safeVAAv1ReceiveWithGasDropOff, receiverAddress, payeeAddress, mockVAAv1ReceiveWithGasDropOff } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const error = encodeErrorResult({
        abi: mockVAAv1ReceiveWithGasDropOff.abi,
        errorName: "DropOffFailed",
        args: [payeeAddress, 1000n],
      });
      await mockVAAv1ReceiveWithGasDropOff.write.setErrorReason(["", true]);

      await viem.assertions.emitWithArgs(
        safeVAAv1ReceiveWithGasDropOff.write.receiveMessage(
          [receiverAddress, "0x", payeeAddress, 1000n, 100_000n, DEFAULT_MESSAGE_ID],
          { account: user.account }
        ),
        safeVAAv1ReceiveWithGasDropOff,
        "VAAMessageReceived",
        [DEFAULT_MESSAGE_ID, false, error]
      );
    });

    it(`Should log error if receiver produce default error`, async () => {
      const { user, safeVAAv1ReceiveWithGasDropOff, receiverAddress, payeeAddress, mockVAAv1ReceiveWithGasDropOff } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const errorReason = "Not delivered";
      const error = encodeErrorResult({
        abi: BUILTIN_ERRORS_ABI,
        errorName: "Error",
        args: [errorReason],
      });
      await mockVAAv1ReceiveWithGasDropOff.write.setErrorReason([errorReason, false]);

      await viem.assertions.emitWithArgs(
        safeVAAv1ReceiveWithGasDropOff.write.receiveMessage(
          [receiverAddress, "0x", payeeAddress, 0n, 100_000n, DEFAULT_MESSAGE_ID],
          { account: user.account }
        ),
        safeVAAv1ReceiveWithGasDropOff,
        "VAAMessageReceived",
        [DEFAULT_MESSAGE_ID, false, error]
      );
    });

    it(`Should log cropped error if receiver produce default error`, async () => {
      const { user, safeVAAv1ReceiveWithGasDropOff, receiverAddress, payeeAddress, mockVAAv1ReceiveWithGasDropOff } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const errorReason =
        "This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. ";
      const error = encodeErrorResult({
        abi: BUILTIN_ERRORS_ABI,
        errorName: "Error",
        args: [errorReason],
      }).substring(0, RETURN_DATA_TRUNCATION_THRESHOLD);
      await mockVAAv1ReceiveWithGasDropOff.write.setErrorReason([errorReason, false]);

      await viem.assertions.emitWithArgs(
        safeVAAv1ReceiveWithGasDropOff.write.receiveMessage(
          [receiverAddress, "0x", payeeAddress, 0n, 100_000n, DEFAULT_MESSAGE_ID],
          { account: user.account }
        ),
        safeVAAv1ReceiveWithGasDropOff,
        "VAAMessageReceived",
        [DEFAULT_MESSAGE_ID, false, error]
      );
    });

    it(`Should successfully receive message`, async () => {
      const { user, safeVAAv1ReceiveWithGasDropOff, receiverAddress, payeeAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      await viem.assertions.emitWithArgs(
        safeVAAv1ReceiveWithGasDropOff.write.receiveMessage(
          [receiverAddress, "0x", payeeAddress, 0n, 100_000n, DEFAULT_MESSAGE_ID],
          { account: user.account }
        ),
        safeVAAv1ReceiveWithGasDropOff,
        "VAAMessageReceived",
        [DEFAULT_MESSAGE_ID, true, "0x"]
      );
    });

    it(`Should successfully receive message and forward msg.value to mockVAAv1ReceiveWithGasDropOff`, async () => {
      const {
        user,
        safeVAAv1ReceiveWithGasDropOff,
        receiverAddress,
        payeeAddress,
        mockVAAv1ReceiveWithGasDropOffAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const value = 300_000_000_000n;

      const tx = safeVAAv1ReceiveWithGasDropOff.write.receiveMessage(
        [receiverAddress, "0x", payeeAddress, 0n, 100_000n, DEFAULT_MESSAGE_ID],
        { value, account: user.account }
      );

      await viem.assertions.emitWithArgs(tx, safeVAAv1ReceiveWithGasDropOff, "VAAMessageReceived", [
        DEFAULT_MESSAGE_ID,
        true,
        "0x",
      ]);

      await viem.assertions.balancesHaveChanged(tx, [
        {
          address: mockVAAv1ReceiveWithGasDropOffAddress,
          amount: value,
        },
      ]);
    });
  });
});
