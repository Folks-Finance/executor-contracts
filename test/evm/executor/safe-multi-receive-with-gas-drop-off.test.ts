import { describe, it } from "node:test";

import { expect } from "chai";
import { network } from "hardhat";
import { encodeErrorResult, getAddress } from "viem";

import { BUILTIN_ERRORS_ABI } from "../constants.js";

import { RETURN_DATA_TRUNCATION_THRESHOLD } from "./token-payment-executor.helper.js";

import type { Hex } from "viem";

export const RECEIVE_MESSAGES_NTT_VERSION = "SafeMultiReceiveWithGasDropOff-0.0.1";
export const DEFAULT_MESSAGE_ID = "0xaaa5a52131cb8ed4ffa27e845e54f438b420ad25000000000000000000000001";

const { networkHelpers, viem } = await network.connect();

async function deployRelayerFixture() {
  const [deployer, feeReceiver, refund, user, payee, receiver, ...unusedUsers] = await viem.getWalletClients();

  // deploy MockVAAv1ReceiveWithGasDropOff
  const mockMultiReceiveWithGasDropOff = await viem.deployContract("MockMultiReceiveWithGasDropOff", [], {
    client: { wallet: deployer },
  });
  const mockMultiReceiveWithGasDropOffAddress = getAddress(mockMultiReceiveWithGasDropOff.address);

  // deploy SafeMultiReceiveWithGasDropOff
  const safeMultiReceiveWithGasDropOff = await viem.deployContract(
    "SafeMultiReceiveWithGasDropOff",
    [mockMultiReceiveWithGasDropOffAddress],
    { client: { wallet: deployer } }
  );
  const safeMultiReceiveWithGasDropOffAddress = getAddress(safeMultiReceiveWithGasDropOff.address);

  const payeeAddress = getAddress(payee.account.address);
  const receiverAddress = getAddress(receiver.account.address);

  return {
    deployer,
    user,
    feeReceiver,
    refund,
    unusedUsers,
    mockMultiReceiveWithGasDropOff,
    mockMultiReceiveWithGasDropOffAddress,
    safeMultiReceiveWithGasDropOff,
    safeMultiReceiveWithGasDropOffAddress,
    payeeAddress,
    receiverAddress,
  };
}

describe("SafeMultiReceiveWithGasDropOff (unit tests)", () => {
  describe("Deployment", () => {
    it("Should set NTT receiver correctly", async () => {
      const { safeMultiReceiveWithGasDropOff, mockMultiReceiveWithGasDropOffAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);
      expect(await safeMultiReceiveWithGasDropOff.read.VERSION()).to.equal(RECEIVE_MESSAGES_NTT_VERSION);
      expect(await safeMultiReceiveWithGasDropOff.read.MultiReceiveWithGasDropOff()).to.equal(
        mockMultiReceiveWithGasDropOffAddress
      );
    });
  });

  describe("Safe receive message", () => {
    it(`Should log silent error when transaction run out of gas`, async () => {
      const { user, safeMultiReceiveWithGasDropOff, receiverAddress, payeeAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      await viem.assertions.emitWithArgs(
        safeMultiReceiveWithGasDropOff.write.receiveMessages(
          [[receiverAddress], ["0x"], payeeAddress, 1000n, [DEFAULT_MESSAGE_ID]],
          { account: user.account }
        ),
        safeMultiReceiveWithGasDropOff,
        "NTTMessageReceived",
        [DEFAULT_MESSAGE_ID, false, "0x"]
      );
    });

    it(`Should log error if receiver produce custom error`, async () => {
      const { user, safeMultiReceiveWithGasDropOff, receiverAddress, payeeAddress, mockMultiReceiveWithGasDropOff } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const value = 3_000n;
      const error = encodeErrorResult({
        abi: mockMultiReceiveWithGasDropOff.abi,
        errorName: "DropOffFailed",
        args: [payeeAddress, value],
      });
      await mockMultiReceiveWithGasDropOff.write.setErrorReason(["", true]);

      await viem.assertions.emitWithArgs(
        safeMultiReceiveWithGasDropOff.write.receiveMessages(
          [[receiverAddress], ["0x"], payeeAddress, 100_000n, [DEFAULT_MESSAGE_ID]],
          {
            value,
            account: user.account,
          }
        ),
        safeMultiReceiveWithGasDropOff,
        "NTTMessageReceived",
        [DEFAULT_MESSAGE_ID, false, error]
      );
    });

    it(`Should log error if receiver produce default error`, async () => {
      const { user, safeMultiReceiveWithGasDropOff, receiverAddress, payeeAddress, mockMultiReceiveWithGasDropOff } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const errorReason = "Not delivered";
      const error = encodeErrorResult({
        abi: BUILTIN_ERRORS_ABI,
        errorName: "Error",
        args: [errorReason],
      });
      await mockMultiReceiveWithGasDropOff.write.setErrorReason([errorReason, false]);

      await viem.assertions.emitWithArgs(
        safeMultiReceiveWithGasDropOff.write.receiveMessages(
          [[receiverAddress], ["0x"], payeeAddress, 100_000n, [DEFAULT_MESSAGE_ID]],
          { account: user.account }
        ),
        safeMultiReceiveWithGasDropOff,
        "NTTMessageReceived",
        [DEFAULT_MESSAGE_ID, false, error]
      );
    });

    it(`Should log cropped error if receiver produce default error`, async () => {
      const { user, safeMultiReceiveWithGasDropOff, receiverAddress, payeeAddress, mockMultiReceiveWithGasDropOff } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const errorReason =
        "This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. This is way too long error and it should be cropped. ";
      const error = encodeErrorResult({
        abi: BUILTIN_ERRORS_ABI,
        errorName: "Error",
        args: [errorReason],
      }).substring(0, RETURN_DATA_TRUNCATION_THRESHOLD);
      await mockMultiReceiveWithGasDropOff.write.setErrorReason([errorReason, false]);

      await viem.assertions.emitWithArgs(
        safeMultiReceiveWithGasDropOff.write.receiveMessages(
          [[receiverAddress], ["0x"], payeeAddress, 100_000n, [DEFAULT_MESSAGE_ID]],
          { account: user.account }
        ),
        safeMultiReceiveWithGasDropOff,
        "NTTMessageReceived",
        [DEFAULT_MESSAGE_ID, false, error]
      );
    });

    it(`Should successfully receive message`, async () => {
      const { user, safeMultiReceiveWithGasDropOff, receiverAddress, payeeAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      await viem.assertions.emitWithArgs(
        safeMultiReceiveWithGasDropOff.write.receiveMessages(
          [[receiverAddress], ["0x"], payeeAddress, 100_000n, [DEFAULT_MESSAGE_ID]],
          { account: user.account }
        ),
        safeMultiReceiveWithGasDropOff,
        "NTTMessageReceived",
        [DEFAULT_MESSAGE_ID, true, "0x"]
      );
    });

    it(`Should successfully receive message and forward msg.value to mockVAAv1ReceiveWithGasDropOff`, async () => {
      const {
        user,
        safeMultiReceiveWithGasDropOff,
        receiverAddress,
        payeeAddress,
        mockMultiReceiveWithGasDropOffAddress,
      } = await networkHelpers.loadFixture(deployRelayerFixture);

      const value = 700_000_000_000n;

      const tx = safeMultiReceiveWithGasDropOff.write.receiveMessages(
        [[receiverAddress], ["0x"], payeeAddress, 100_000n, [DEFAULT_MESSAGE_ID]],
        { value, account: user.account }
      );
      await viem.assertions.emitWithArgs(tx, safeMultiReceiveWithGasDropOff, "NTTMessageReceived", [
        DEFAULT_MESSAGE_ID,
        true,
        "0x",
      ]);

      await viem.assertions.balancesHaveChanged(tx, [
        {
          address: mockMultiReceiveWithGasDropOffAddress,
          amount: value,
        },
      ]);
    });

    it(`Should successfully receive multiple messages`, async () => {
      const { user, safeMultiReceiveWithGasDropOff, receiverAddress, payeeAddress } =
        await networkHelpers.loadFixture(deployRelayerFixture);

      const anotherMessageId = DEFAULT_MESSAGE_ID.replace("a", "b") as Hex;

      const tx = safeMultiReceiveWithGasDropOff.write.receiveMessages(
        [
          [receiverAddress, receiverAddress],
          ["0x12121212", "0x"],
          payeeAddress,
          100_000n,
          [DEFAULT_MESSAGE_ID, anotherMessageId],
        ],
        { account: user.account }
      );

      await viem.assertions.emitWithArgs(tx, safeMultiReceiveWithGasDropOff, "NTTMessageReceived", [
        DEFAULT_MESSAGE_ID,
        true,
        "0x",
      ]);

      await viem.assertions.emitWithArgs(tx, safeMultiReceiveWithGasDropOff, "NTTMessageReceived", [
        anotherMessageId,
        true,
        "0x",
      ]);
    });
  });
});
