import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { getApplicationAddress, OnApplicationComplete } from "algosdk";
import { expect } from "chai";

import { FakeNttV1ReceiverFactory } from "../../../../specs/client/FakeNttV1Receiver.client.js";
import { MockNttV1ReceiverFactory } from "../../../../specs/client/MockNttV1Receiver.client.js";
import { NttV1ReceiveWithGasDropOffFactory } from "../../../../specs/client/NttV1ReceiveWithGasDropOff.client.js";
import { convertNumberToBytes, enc, getEventBytes, getRandomBytes } from "../../utils/bytes.js";
import { deployWormholeCore } from "../../utils/contract.js";

import type { FakeNttV1ReceiverClient } from "../../../../specs/client/FakeNttV1Receiver.client.js";
import type { MockNttV1ReceiverClient } from "../../../../specs/client/MockNttV1Receiver.client.js";
import type { NttV1ReceiveWithGasDropOffClient } from "../../../../specs/client/NttV1ReceiveWithGasDropOff.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { AlgorandFixture } from "@algorandfoundation/algokit-utils/types/testing";
import type { Account, Address } from "algosdk";

const generateTxnArgs = async (
  localnet: AlgorandFixture,
  wormholeCoreAppId: bigint,
  nttV1ReceiverClient: MockNttV1ReceiverClient,
  executor: Address & Account & TransactionSignerAccount,
  dropOffTo: Address & Account & TransactionSignerAccount
) => {
  const gasPaymentTxn = await localnet.algorand.createTransaction.payment({
    sender: executor,
    receiver: getApplicationAddress(nttV1ReceiverClient.appId),
    amount: (1).algo(),
  });
  const verifySigsTxn = await localnet.algorand.createTransaction.appCall({
    sender: executor,
    appId: wormholeCoreAppId,
    onComplete: OnApplicationComplete.NoOpOC,
    args: [enc.encode("verifySigs")],
  });
  const verifyVAATxn = await localnet.algorand.createTransaction.appCall({
    sender: executor,
    appId: wormholeCoreAppId,
    onComplete: OnApplicationComplete.NoOpOC,
    args: [enc.encode("verifyVAA")],
  });
  const {
    transactions: [, receiveNttTxn],
  } = await nttV1ReceiverClient.createTransaction.receiveMessage({
    sender: executor,
    args: [verifyVAATxn],
  });
  const gasDropOffTxn = await localnet.algorand.createTransaction.payment({
    sender: executor,
    receiver: dropOffTo.toString(),
    amount: (5).algo(),
  });
  return { gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn };
};

describe("NttV1ReceiveWithGasDropOff", () => {
  const localnet = algorandFixture();

  let wormholeCoreAppId: bigint;

  let nttV1ReceiverFactory: MockNttV1ReceiverFactory;
  let nttV1ReceiverClient: MockNttV1ReceiverClient;
  let nttV1ReceiverAppId: bigint;

  let fakeNttV1ReceiverFactory: FakeNttV1ReceiverFactory;
  let fakeNttV1ReceiverClient: FakeNttV1ReceiverClient;
  let fakeNttV1ReceiverAppId: bigint;

  let factory: NttV1ReceiveWithGasDropOffFactory;
  let client: NttV1ReceiveWithGasDropOffClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let executor: Address & Account & TransactionSignerAccount;
  let user: Address & Account & TransactionSignerAccount;

  const requestForExecutionId = getRandomBytes(32);

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });
      executor = await generateAccount({ initialFunds: (100).algo() });
      user = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(NttV1ReceiveWithGasDropOffFactory, {
        defaultSender: creator,
        defaultSigner: creator.signer,
      });

      // deploy wormhole core
      {
        wormholeCoreAppId = await deployWormholeCore(localnet, creator);

        expect(wormholeCoreAppId).not.to.equal(0n);
      }

      // deploy ntt v1 receiver
      {
        nttV1ReceiverFactory = algorand.client.getTypedAppFactory(MockNttV1ReceiverFactory, {
          defaultSender: creator,
          defaultSigner: creator.signer,
        });
        const { appClient, result } = await nttV1ReceiverFactory.deploy();
        nttV1ReceiverAppId = result.appId;
        nttV1ReceiverClient = appClient;

        expect(nttV1ReceiverAppId).not.to.equal(0n);
      }

      // deploy fake ntt v1 receiver
      {
        fakeNttV1ReceiverFactory = algorand.client.getTypedAppFactory(FakeNttV1ReceiverFactory, {
          defaultSender: creator,
          defaultSigner: creator.signer,
        });
        const { appClient, result } = await fakeNttV1ReceiverFactory.deploy();
        fakeNttV1ReceiverAppId = result.appId;
        fakeNttV1ReceiverClient = appClient;

        expect(fakeNttV1ReceiverAppId).not.to.equal(0n);
      }
    },
    { timeout: 20_000 }
  );

  describe("creation", () => {
    it("deploys with correct state", async () => {
      const { appClient, result } = await factory.deploy({ createParams: { sender: creator } });
      appId = result.appId;
      client = appClient;

      expect(appId).not.to.equal(0n);
    });
  });

  describe("receive message", () => {
    it("fails when gas isn't payment", async () => {
      const gasPaymentTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(gasPaymentTxn)
          .addTransaction(verifySigsTxn)
          .addTransaction(verifyVAATxn)
          .addTransaction(receiveNttTxn)
          .addTransaction(gasDropOffTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [client.appClient.getABIMethod("receive_message").getSelector(), getRandomBytes(32)],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is pay");
      }
    });

    it("fails when verify sigs isn't app call", async () => {
      const verifySigsTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { gasPaymentTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(gasPaymentTxn)
          .addTransaction(verifySigsTxn)
          .addTransaction(verifyVAATxn)
          .addTransaction(receiveNttTxn)
          .addTransaction(gasDropOffTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [client.appClient.getABIMethod("receive_message").getSelector(), getRandomBytes(32)],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is appl");
      }
    });

    it("fails when verify vaa isn't app call", async () => {
      const verifyVAATxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { gasPaymentTxn, verifySigsTxn, receiveNttTxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(gasPaymentTxn)
          .addTransaction(verifySigsTxn)
          .addTransaction(verifyVAATxn)
          .addTransaction(receiveNttTxn)
          .addTransaction(gasDropOffTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [client.appClient.getABIMethod("receive_message").getSelector(), getRandomBytes(32)],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is appl");
      }
    });

    it("fails when receive ntt isn't app call", async () => {
      const receiveNttTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { gasPaymentTxn, verifySigsTxn, verifyVAATxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(gasPaymentTxn)
          .addTransaction(verifySigsTxn)
          .addTransaction(verifyVAATxn)
          .addTransaction(receiveNttTxn)
          .addTransaction(gasDropOffTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [client.appClient.getABIMethod("receive_message").getSelector(), getRandomBytes(32)],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is appl");
      }
    });

    it("fails when gas drop off isn't payment", async () => {
      const gasDropOffTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(gasPaymentTxn)
          .addTransaction(verifySigsTxn)
          .addTransaction(verifyVAATxn)
          .addTransaction(receiveNttTxn)
          .addTransaction(gasDropOffTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [client.appClient.getABIMethod("receive_message").getSelector(), getRandomBytes(32)],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is pay");
      }
    });

    for (const { requestForExecutionIdLength, arg } of [
      { requestForExecutionIdLength: 16, arg: "arc4.static_array<arc4.uint8, 32>" },
      { requestForExecutionIdLength: 34, arg: "arc4.static_array<arc4.uint8, 32>" },
    ]) {
      it(`fails when request for execution id is $requestForExecutionIdLength bytes`, async () => {
        const { gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn } = await generateTxnArgs(
          localnet,
          wormholeCoreAppId,
          nttV1ReceiverClient,
          executor,
          user
        );

        try {
          await localnet.algorand
            .newGroup()
            .addTransaction(gasPaymentTxn)
            .addTransaction(verifySigsTxn)
            .addTransaction(verifyVAATxn)
            .addTransaction(receiveNttTxn)
            .addTransaction(gasDropOffTxn)
            .addAppCall({
              sender: user,
              appId,
              onComplete: OnApplicationComplete.NoOpOC,
              args: [
                client.appClient.getABIMethod("receive_message").getSelector(),
                getRandomBytes(requestForExecutionIdLength),
              ],
            })
            .send();
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include(`invalid number of bytes for ${arg}`);
        }
      });
    }

    it("fails when gas recipient is not ntt receiver app address", async () => {
      const { verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );
      const gasPaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: executor,
        receiver: user.toString(),
        amount: (1).algo(),
      });

      try {
        await client.send.receiveMessage({
          sender: user,
          args: [gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn, requestForExecutionId],
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Gas receiver unknown");
      }
    });

    it("fails when receive ntt call is not a noop", async () => {
      const { verifySigsTxn, verifyVAATxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );
      const gasPaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: executor,
        receiver: getApplicationAddress(fakeNttV1ReceiverAppId),
        amount: (1).algo(),
      });
      const {
        transactions: [, receiveNttTxn],
      } = await fakeNttV1ReceiverClient.createTransaction.optIn.receiveMessage({
        sender: executor,
        args: [verifyVAATxn],
      });

      try {
        await client.send.receiveMessage({
          sender: user,
          args: [gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn, requestForExecutionId],
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Incorrect app on completion");
      }
    });

    it("fails when receive ntt call is to incorrect method", async () => {
      const { verifySigsTxn, verifyVAATxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );
      const gasPaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: executor,
        receiver: getApplicationAddress(fakeNttV1ReceiverAppId),
        amount: (1).algo(),
      });
      const {
        transactions: [, receiveNttTxn],
      } = await fakeNttV1ReceiverClient.createTransaction.incorrectMethod({
        sender: executor,
        args: [verifyVAATxn],
      });

      try {
        await client.send.receiveMessage({
          sender: user,
          args: [gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn, requestForExecutionId],
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Incorrect method");
      }
    });

    it("succeeds", async () => {
      const { gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn } = await generateTxnArgs(
        localnet,
        wormholeCoreAppId,
        nttV1ReceiverClient,
        executor,
        user
      );
      const res = await client.send.receiveMessage({
        sender: user,
        args: [gasPaymentTxn, verifySigsTxn, verifyVAATxn, receiveNttTxn, gasDropOffTxn, requestForExecutionId],
      });

      // logs
      expect(res.confirmations[5].logs).to.not.be.undefined;
      expect(res.confirmations[5].logs?.[0]).to.deep.equal(
        getEventBytes("NTTMessageReceived(byte[32],bool,byte[])", [requestForExecutionId, true, enc.encode("")])
      );
    });
  });

  describe("report error", () => {
    for (const { requestForExecutionIdLength, errorReasonLengthDelta, arg } of [
      { requestForExecutionIdLength: 30, errorReasonLengthDelta: 0, arg: "arc4.static_array<arc4.uint8, 32>" },
      { requestForExecutionIdLength: 34, errorReasonLengthDelta: 0, arg: "arc4.static_array<arc4.uint8, 32>" },
      { requestForExecutionIdLength: 32, errorReasonLengthDelta: -1, arg: "arc4.dynamic_array<arc4.uint8>" },
      { requestForExecutionIdLength: 32, errorReasonLengthDelta: 1, arg: "arc4.dynamic_array<arc4.uint8>" },
    ]) {
      it(`fails when request for execution id is $requestForExecutionIdLength and error reason delta $errorReasonLengthDelta bytes`, async () => {
        const errorReason = getRandomBytes(10);

        try {
          await localnet.algorand.send.appCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("report_error").getSelector(),
              getRandomBytes(requestForExecutionIdLength),
              Uint8Array.from([
                ...convertNumberToBytes(errorReason.length + errorReasonLengthDelta, 2),
                ...errorReason,
              ]),
            ],
          });
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include(`invalid number of bytes for ${arg}`);
        }
      });
    }

    it("succeeds", async () => {
      const errorReason = enc.encode("underflow");
      const res = await client.send.reportError({
        sender: user,
        args: [requestForExecutionId, errorReason],
      });

      // logs
      expect(res.confirmations[0].logs).to.not.be.undefined;
      expect(res.confirmations[0].logs?.[0]).to.deep.equal(
        getEventBytes("NTTMessageReceived(byte[32],bool,byte[])", [requestForExecutionId, false, errorReason])
      );
    });
  });
});
