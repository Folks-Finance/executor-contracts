import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { getApplicationAddress, OnApplicationComplete } from "algosdk";
import { expect } from "chai";

import { FakeNttManagerFactory } from "../../../../specs/client/FakeNttManager.client.js";
import { MockNttManagerFactory } from "../../../../specs/client/MockNttManager.client.js";
import { MockTokenPaymentExecutorFactory } from "../../../../specs/client/MockTokenPaymentExecutor.client.js";
import { NttManagerWithTokenPaymentExecutorFactory } from "../../../../specs/client/NttManagerWithTokenPaymentExecutor.client.js";
import { convertNumberToBytes, getEventBytes, getRandomBytes } from "../../utils/bytes.js";
import { encodeNttV1Request } from "../../utils/quote.js";
import { getRandomUInt, MAX_UINT16, MAX_UINT64 } from "../../utils/uint.js";

import type { FakeNttManagerClient } from "../../../../specs/client/FakeNttManager.client.js";
import type { MockNttManagerClient } from "../../../../specs/client/MockNttManager.client.js";
import type { MockTokenPaymentExecutorClient } from "../../../../specs/client/MockTokenPaymentExecutor.client.js";
import type {
  ExecutorArgs,
  FeeArgs,
  NttManagerWithTokenPaymentExecutorClient,
} from "../../../../specs/client/NttManagerWithTokenPaymentExecutor.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { AlgorandFixture } from "@algorandfoundation/algokit-utils/types/testing";
import type { Account, Address } from "algosdk";

const generateTxnArgs = async (
  localnet: AlgorandFixture,
  nttManagerWithTokenPaymentExecutorAppId: bigint,
  nttManagerClient: MockNttManagerClient,
  user: Address & Account & TransactionSignerAccount,
  referrer: Address & Account & TransactionSignerAccount,
  tokenPaymentAssetId: bigint,
  nttAssetId: bigint,
  recipientChain: number | bigint,
  nttAmount = 5_000_000n,
  referrerAmount = 0n,
  executorAmount = 10_000_000n
) => {
  const nttFeePaymentTxn = await localnet.algorand.createTransaction.payment({
    sender: user,
    receiver: getApplicationAddress(nttManagerClient.appId),
    amount: (0).algo(),
  });
  const nttSendTokenTxn = await localnet.algorand.createTransaction.assetTransfer({
    sender: user,
    assetId: nttAssetId,
    receiver: getApplicationAddress(nttManagerClient.appId),
    amount: nttAmount,
  });
  const { transactions } = await nttManagerClient.createTransaction.transfer({
    sender: user,
    args: [nttFeePaymentTxn, nttSendTokenTxn, nttAmount, recipientChain, getRandomBytes(32)],
  });
  const nttTransferTxn = transactions[2];
  const payExecutorTxn = await localnet.algorand.createTransaction.assetTransfer({
    sender: user,
    assetId: tokenPaymentAssetId,
    receiver: getApplicationAddress(nttManagerWithTokenPaymentExecutorAppId),
    amount: executorAmount,
  });
  const payReferrerTxn = await localnet.algorand.createTransaction.assetTransfer({
    sender: user,
    assetId: nttAssetId,
    receiver: referrer,
    amount: referrerAmount,
  });
  return { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn };
};

describe("NttManagerWithTokenPaymentExecutor", () => {
  const localnet = algorandFixture();

  const NTT_TOTAL = 50_000_000_000_000n;
  const NTT_DECIMALS = 6;
  const NTT_ASSET_NAME = "Folks Finance";
  const NTT_UNIT_NAME = "FOLKS";
  let nttAssetId: bigint;
  let fakeNttAssetId: bigint;

  const TOKEN_PAYMENT_TOTAL = MAX_UINT64;
  const TOKEN_PAYMENT_DECIMALS = 6;
  const TOKEN_PAYMENT_ASSET_NAME = "USD Coin";
  const TOKEN_PAYMENT_UNIT_NAME = "USDC";
  let tokenPaymentAssetId: bigint;

  let executorFactory: MockTokenPaymentExecutorFactory;
  let executorClient: MockTokenPaymentExecutorClient;
  let executorAppId: bigint;

  let nttManagerFactory: MockNttManagerFactory;
  let nttManagerClient: MockNttManagerClient;
  let nttManagerAppId: bigint;

  let fakeNttManagerFactory: FakeNttManagerFactory;
  let fakeNttManagerClient: FakeNttManagerClient;

  let factory: NttManagerWithTokenPaymentExecutorFactory;
  let client: NttManagerWithTokenPaymentExecutorClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let user: Address & Account & TransactionSignerAccount;
  let referrer: Address & Account & TransactionSignerAccount;

  const EXECUTOR_VERSION = "NttManagerWithTokenPaymentExecutor-0.0.1";
  const OUR_CHAIN = 8;
  const PEER_CHAIN = 16;
  const PEER_CONTRACT = getRandomBytes(32);
  const PEER_DECIMALS = 8;

  const MESSAGE_ID = getRandomBytes(32);

  const EXECUTOR_ARGS: ExecutorArgs = {
    refundAddress: "NYMNQ7BFWNKTNJE6U6EGTNSBQIAAERDRHD3VIEINQYFHGSMJXE7CIP6GI4",
    signedQuoteBytes: getRandomBytes(100),
    relayInstructions: getRandomBytes(16),
  };

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });
      user = await generateAccount({ initialFunds: (100).algo() });
      referrer = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(NttManagerWithTokenPaymentExecutorFactory, {
        defaultSender: creator,
        defaultSigner: creator.signer,
      });

      // create ntt asset
      {
        const res = await localnet.algorand.send.assetCreate({
          sender: creator,
          total: NTT_TOTAL,
          decimals: NTT_DECIMALS,
          assetName: NTT_ASSET_NAME,
          unitName: NTT_UNIT_NAME,
        });
        nttAssetId = res.assetId;
      }

      // create fake ntt asset
      {
        const res = await localnet.algorand.send.assetCreate({
          sender: creator,
          total: NTT_TOTAL,
          decimals: NTT_DECIMALS,
          assetName: NTT_ASSET_NAME,
          unitName: NTT_UNIT_NAME,
        });
        fakeNttAssetId = res.assetId;
      }

      // create token payment asset
      {
        const res = await localnet.algorand.send.assetCreate({
          sender: creator,
          total: TOKEN_PAYMENT_TOTAL,
          decimals: TOKEN_PAYMENT_DECIMALS,
          assetName: TOKEN_PAYMENT_ASSET_NAME,
          unitName: TOKEN_PAYMENT_UNIT_NAME,
        });
        tokenPaymentAssetId = res.assetId;
      }

      // opt user and referrer into assets and fund
      await localnet.algorand.send.assetOptIn({ sender: user, assetId: nttAssetId });
      await localnet.algorand.send.assetOptIn({ sender: referrer, assetId: nttAssetId });
      await localnet.algorand.send.assetTransfer({
        sender: creator,
        receiver: user,
        assetId: nttAssetId,
        amount: BigInt(100e6),
      });
      await localnet.algorand.send.assetOptIn({ sender: user, assetId: fakeNttAssetId });
      await localnet.algorand.send.assetOptIn({ sender: referrer, assetId: fakeNttAssetId });
      await localnet.algorand.send.assetTransfer({
        sender: creator,
        receiver: user,
        assetId: fakeNttAssetId,
        amount: BigInt(100e6),
      });
      await localnet.algorand.send.assetOptIn({ sender: user, assetId: tokenPaymentAssetId });
      await localnet.algorand.send.assetTransfer({
        sender: creator,
        receiver: user,
        assetId: tokenPaymentAssetId,
        amount: BigInt(100e6),
      });

      // deploy executor
      {
        executorFactory = localnet.algorand.client.getTypedAppFactory(MockTokenPaymentExecutorFactory, {
          defaultSender: creator,
          defaultSigner: creator.signer,
        });
        const { appClient, result } = await executorFactory.deploy();
        executorAppId = result.appId;
        executorClient = appClient;

        expect(executorAppId).not.to.equal(0n);

        // opt into token payment asset
        const APP_MIN_BALANCE = (200_000).microAlgos();
        const fundingTxn = await localnet.algorand.createTransaction.payment({
          sender: creator,
          receiver: getApplicationAddress(executorAppId),
          amount: APP_MIN_BALANCE,
        });
        await executorClient
          .newGroup()
          .addTransaction(fundingTxn)
          .whitelistTokenForPayment({
            sender: creator,
            args: [tokenPaymentAssetId],
            extraFee: (1000).microAlgos(),
          })
          .send();
      }

      // deploy ntt manager
      {
        nttManagerFactory = localnet.algorand.client.getTypedAppFactory(MockNttManagerFactory, {
          defaultSender: creator,
          defaultSigner: creator.signer,
        });
        const { appClient, result } = await nttManagerFactory.deploy();
        nttManagerAppId = result.appId;
        nttManagerClient = appClient;

        expect(nttManagerAppId).not.to.equal(0n);

        // opt into ntt asset
        const APP_MIN_BALANCE = (200_000).microAlgos();
        const fundingTxn = await localnet.algorand.createTransaction.payment({
          sender: creator,
          receiver: getApplicationAddress(nttManagerAppId),
          amount: APP_MIN_BALANCE,
        });
        await nttManagerClient
          .newGroup()
          .addTransaction(fundingTxn)
          .whitelistTokenForTransfer({
            sender: creator,
            args: [nttAssetId],
            extraFee: (1000).microAlgos(),
          })
          .send();

        // set ntt manager peer
        await nttManagerClient.send.setNttManagerPeer({
          sender: creator,
          args: [PEER_CONTRACT, PEER_DECIMALS],
        });
        expect(await nttManagerClient.getNttManagerPeer({ args: [PEER_CHAIN] })).to.deep.equal({
          peerContract: PEER_CONTRACT,
          decimals: PEER_DECIMALS,
        });

        // set message id
        await nttManagerClient.send.setMessageId({
          sender: creator,
          args: [MESSAGE_ID],
        });
      }

      // deploy fake ntt manager
      {
        fakeNttManagerFactory = localnet.algorand.client.getTypedAppFactory(FakeNttManagerFactory, {
          defaultSender: creator,
          defaultSigner: creator.signer,
        });
        const { appClient } = await fakeNttManagerFactory.deploy();
        fakeNttManagerClient = appClient;

        expect(nttManagerAppId).not.to.equal(0n);
      }
    },
    { timeout: 20_000 }
  );

  describe("creation", () => {
    it("deploys with correct state", async () => {
      const { appClient, result } = await factory.deploy({
        createParams: {
          sender: creator,
          method: "create",
          args: [OUR_CHAIN, executorAppId],
        },
      });
      appId = result.appId;
      client = appClient;

      expect(appId).not.to.equal(0n);
      expect(await client.state.global.executorVersion()).to.equal(EXECUTOR_VERSION);
      expect(await client.state.global.ourChain()).to.equal(OUR_CHAIN);
      expect(await client.state.global.executor()).to.equal(executorAppId);
    });
  });

  describe("whitelist token for payment", () => {
    for (const { assetIdLength, arg } of [
      { assetIdLength: 4, arg: "arc4.uint64" },
      { assetIdLength: 16, arg: "arc4.uint64" },
    ]) {
      it(`fails when asset id is ${assetIdLength} bytes`, async () => {
        try {
          await localnet.algorand.send.appCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("whitelist_token_for_payment").getSelector(),
              convertNumberToBytes(0, assetIdLength),
            ],
          });
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include(`invalid number of bytes for ${arg}`);
        }
      });
    }

    it("succeeds", async () => {
      const APP_MIN_BALANCE = (200_000).microAlgos();
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: APP_MIN_BALANCE,
      });
      const { confirmations } = await client
        .newGroup()
        .addTransaction(fundingTxn)
        .whitelistTokenForPayment({
          sender: user,
          args: [tokenPaymentAssetId],
          extraFee: (1000).microAlgos(),
        })
        .send();

      expect(confirmations.length).to.equal(2);
      expect(confirmations[1].innerTxns).to.not.be.undefined;
      const optIntoAssetTx = confirmations[1].innerTxns?.[0];
      expect(optIntoAssetTx?.txn.txn.type).to.equal("axfer");
      expect(optIntoAssetTx?.txn.txn.sender).to.deep.equal(getApplicationAddress(appId));
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer).to.not.be.undefined;
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.assetIndex).to.equal(tokenPaymentAssetId);
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.amount).to.equal(0n);
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.assetSender).to.be.undefined;
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.receiver).to.deep.equal(
        getApplicationAddress(appId)
      );
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.closeRemainderTo).to.be.undefined;
    });
  });

  describe("transfer", () => {
    it("fails when ntt send token isn't asset transfer", async () => {
      const nttSendTokenTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { nttFeePaymentTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              getRandomBytes(100),
              getRandomBytes(34),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is axfer");
      }
    });

    it("fails when ntt transfer isn't appl call", async () => {
      const nttTransferTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { nttFeePaymentTxn, nttSendTokenTxn, payExecutorTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              getRandomBytes(100),
              getRandomBytes(34),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is appl");
      }
    });

    it("fails when pay executor isn't asset transfer", async () => {
      const payExecutorTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              getRandomBytes(100),
              getRandomBytes(34),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is axfer");
      }
    });

    it("fails when pay referrer isn't asset transfer", async () => {
      const payReferrerTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
      });
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              getRandomBytes(100),
              getRandomBytes(34),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is axfer");
      }
    });

    it("fails when executor args is less than 34 bytes", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
        await generateTxnArgs(
          localnet,
          appId,
          nttManagerClient,
          user,
          referrer,
          tokenPaymentAssetId,
          nttAssetId,
          PEER_CHAIN
        );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              getRandomBytes(33),
              getRandomBytes(34),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("invalid tuple encoding");
      }
    });

    it("fails when executor args pointer is not to signed quote bytes", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
        await generateTxnArgs(
          localnet,
          appId,
          nttManagerClient,
          user,
          referrer,
          tokenPaymentAssetId,
          nttAssetId,
          PEER_CHAIN
        );

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              Uint8Array.from([
                ...getRandomBytes(32),
                // pointer to signed quote bytes
                ...convertNumberToBytes(35, 2),
              ]),
              getRandomBytes(33),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("invalid tail pointer at index 1");
      }
    });

    it("fails when executor args pointer is not to relay instructions", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
        await generateTxnArgs(
          localnet,
          appId,
          nttManagerClient,
          user,
          referrer,
          tokenPaymentAssetId,
          nttAssetId,
          PEER_CHAIN
        );
      const signedQuoteBytes = getRandomBytes(30);

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .addTransaction(nttSendTokenTxn)
          .addTransaction(nttTransferTxn)
          .addTransaction(payExecutorTxn)
          .addTransaction(payReferrerTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("transfer").getSelector(),
              convertNumberToBytes(MAX_UINT64, 8),
              Uint8Array.from([
                ...getRandomBytes(32),
                // pointer to signed quote bytes
                ...convertNumberToBytes(36, 2),
                // pointer to relay instructions
                ...convertNumberToBytes(36 + 1 + signedQuoteBytes.length, 2),
                ...convertNumberToBytes(signedQuoteBytes.length, 2),
                ...signedQuoteBytes,
                ...getRandomBytes(10),
              ]),
              getRandomBytes(33),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("invalid tail pointer at index 2");
      }
    });

    for (const { amountLength, executorArgsLengthDelta, feeArgsLengthDelta, arg } of [
      { amountLength: 4, executorArgsLengthDelta: 0, feeArgsLengthDelta: 0, arg: "arc4.uint64" },
      { amountLength: 16, executorArgsLengthDelta: 0, feeArgsLengthDelta: 0, arg: "arc4.uint64" },
      {
        amountLength: 8,
        executorArgsLengthDelta: -1,
        feeArgsLengthDelta: 0,
        arg: "executor_contracts.avm.executor.request.interfaces.INttManagerWithTokenPaymentExecutor.ExecutorArgs",
      },
      {
        amountLength: 8,
        executorArgsLengthDelta: 1,
        feeArgsLengthDelta: 0,
        arg: "executor_contracts.avm.executor.request.interfaces.INttManagerWithTokenPaymentExecutor.ExecutorArgs",
      },
      {
        amountLength: 8,
        executorArgsLengthDelta: 0,
        feeArgsLengthDelta: 1,
        arg: "executor_contracts.avm.executor.request.interfaces.INttManagerWithTokenPaymentExecutor.FeeArgs",
      },
      {
        amountLength: 8,
        executorArgsLengthDelta: 0,
        feeArgsLengthDelta: 1,
        arg: "executor_contracts.avm.executor.request.interfaces.INttManagerWithTokenPaymentExecutor.FeeArgs",
      },
    ]) {
      it(`fails when amount is ${amountLength}, executor args length delta is ${executorArgsLengthDelta} and fee args length delta is ${feeArgsLengthDelta} bytes`, async () => {
        const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
          await generateTxnArgs(
            localnet,
            appId,
            nttManagerClient,
            user,
            referrer,
            tokenPaymentAssetId,
            nttAssetId,
            PEER_CHAIN
          );
        const signedQuoteBytes = getRandomBytes(30);
        const relayInstructions = getRandomBytes(10);

        try {
          await localnet.algorand
            .newGroup()
            .addTransaction(nttFeePaymentTxn)
            .addTransaction(nttSendTokenTxn)
            .addTransaction(nttTransferTxn)
            .addTransaction(payExecutorTxn)
            .addTransaction(payReferrerTxn)
            .addAppCall({
              sender: user,
              appId,
              onComplete: OnApplicationComplete.NoOpOC,
              args: [
                client.appClient.getABIMethod("transfer").getSelector(),
                convertNumberToBytes(0, amountLength),
                Uint8Array.from([
                  ...getRandomBytes(32),
                  // pointer to signed quote bytes
                  ...convertNumberToBytes(36, 2),
                  // pointer to relay instructions
                  ...convertNumberToBytes(36 + 2 + signedQuoteBytes.length, 2),
                  ...convertNumberToBytes(signedQuoteBytes.length, 2),
                  ...signedQuoteBytes,
                  ...convertNumberToBytes(relayInstructions.length + executorArgsLengthDelta, 2),
                  ...relayInstructions,
                ]),
                getRandomBytes(34 + feeArgsLengthDelta),
              ],
            })
            .send();
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include(`invalid number of bytes for ${arg}`);
        }
      });
    }

    it("fails when ntt transfer call is not a noop", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, payExecutorTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const { transactions } = await fakeNttManagerClient.createTransaction.optIn.transfer({
        sender: user,
        args: [nttFeePaymentTxn, nttSendTokenTxn, 0n, getRandomUInt(MAX_UINT16), getRandomBytes(32)],
      });
      const nttTransferTxn = transactions[2];
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Incorrect app on completion");
      }
    });

    it("fails when ntt transfer call is to incorrect method", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, payExecutorTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const {
        transactions: [nttTransferTxn],
      } = await fakeNttManagerClient.createTransaction.incorrectMethodCall({
        sender: user,
        args: [],
      });
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Incorrect method");
      }
    });

    it("fails when executor pay is not from same sender", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const payExecutorTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: creator,
        assetId: tokenPaymentAssetId,
        receiver: getApplicationAddress(appId),
        amount: 10_000_000n,
      });
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Pay executor txn must be from same sender");
      }
    });

    it("fails when executor pay receiver is app address", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payReferrerTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const payExecutorTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        assetId: tokenPaymentAssetId,
        receiver: user.toString(),
        amount: 10_000_000n,
      });
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unknown pay executor receiver");
      }
    });

    it("fails when referrer pay uses different asset", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const payReferrerTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        assetId: fakeNttAssetId,
        receiver: referrer,
        amount: 0n,
      });
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unknown pay referrer asset");
      }
    });

    it("fails when referrer pay is not from same sender", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const payReferrerTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: creator,
        assetId: nttAssetId,
        receiver: referrer,
        amount: 0n,
      });
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Pay referrer txn must be from same sender");
      }
    });

    it("fails when referrer pay receiver is not fee payee", async () => {
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn } = await generateTxnArgs(
        localnet,
        appId,
        nttManagerClient,
        user,
        referrer,
        tokenPaymentAssetId,
        nttAssetId,
        PEER_CHAIN
      );
      const payReferrerTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        assetId: nttAssetId,
        receiver: user,
        amount: 0n,
      });
      const feeArgs: FeeArgs = {
        dbps: 0,
        payee: referrer.toString(),
      };

      try {
        await client
          .newGroup()
          .addTransaction(nttFeePaymentTxn)
          .transfer({
            sender: user,
            args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, 0n, EXECUTOR_ARGS, feeArgs],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unknown pay referrer receiver");
      }
    });

    for (const { offset } of [
      {
        name: "too low",
        offset: -1n,
      },
      {
        name: "too high",
        offset: 1n,
      },
    ]) {
      it("fails when referrer pay amount is $name", async () => {
        // prepare amounts
        const totalAmount = getRandomUInt(10_000_000);
        const dbps = getRandomUInt(1000);
        const feeArgs: FeeArgs = {
          dbps: Number(dbps),
          payee: referrer.toString(),
        };
        const referrerAmount = (totalAmount * dbps) / 100_000n + offset;
        const nttTransferAmount = totalAmount - referrerAmount;

        // transfer
        const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
          await generateTxnArgs(
            localnet,
            appId,
            nttManagerClient,
            user,
            referrer,
            tokenPaymentAssetId,
            nttAssetId,
            PEER_CHAIN,
            nttTransferAmount,
            referrerAmount
          );

        try {
          await client
            .newGroup()
            .addTransaction(nttFeePaymentTxn)
            .transfer({
              sender: user,
              args: [
                nttSendTokenTxn,
                nttTransferTxn,
                payExecutorTxn,
                payReferrerTxn,
                totalAmount,
                EXECUTOR_ARGS,
                feeArgs,
              ],
              extraFee: (3000).microAlgos(),
            })
            .send();
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include("Incorrect pay referrer amount");
        }
      });
    }

    for (const { offset } of [
      {
        name: "too low",
        offset: -1n,
      },
      {
        name: "too high",
        offset: 1n,
      },
    ]) {
      it("fails when referrer pay amount is $name", async () => {
        // prepare amounts
        const totalAmount = getRandomUInt(10_000_000);
        const dbps = getRandomUInt(1000);
        const feeArgs: FeeArgs = {
          dbps: Number(dbps),
          payee: referrer.toString(),
        };
        const referrerAmount = (totalAmount * dbps) / 100_000n;
        const nttTransferAmount = totalAmount - referrerAmount + offset;

        // transfer
        const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
          await generateTxnArgs(
            localnet,
            appId,
            nttManagerClient,
            user,
            referrer,
            tokenPaymentAssetId,
            nttAssetId,
            PEER_CHAIN,
            nttTransferAmount,
            referrerAmount
          );

        try {
          await client
            .newGroup()
            .addTransaction(nttFeePaymentTxn)
            .transfer({
              sender: user,
              args: [
                nttSendTokenTxn,
                nttTransferTxn,
                payExecutorTxn,
                payReferrerTxn,
                totalAmount,
                EXECUTOR_ARGS,
                feeArgs,
              ],
              extraFee: (3000).microAlgos(),
            })
            .send();
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include("Incorrect ntt transfer amount");
        }
      });
    }

    it("succeeds", async () => {
      const totalAmount = getRandomUInt(10_000_000);
      const dbps = getRandomUInt(1000);
      const feeArgs: FeeArgs = {
        dbps: Number(dbps),
        payee: referrer.toString(),
      };
      const referrerAmount = (totalAmount * dbps) / 100_000n;
      const nttTransferAmount = totalAmount - referrerAmount;
      const executorAmount = getRandomUInt(10_000_000n);

      // transfer
      const { nttFeePaymentTxn, nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn } =
        await generateTxnArgs(
          localnet,
          appId,
          nttManagerClient,
          user,
          referrer,
          tokenPaymentAssetId,
          nttAssetId,
          PEER_CHAIN,
          nttTransferAmount,
          referrerAmount,
          executorAmount
        );
      const res = await client
        .newGroup()
        .addTransaction(nttFeePaymentTxn)
        .transfer({
          sender: user,
          args: [nttSendTokenTxn, nttTransferTxn, payExecutorTxn, payReferrerTxn, totalAmount, EXECUTOR_ARGS, feeArgs],
          extraFee: (3000).microAlgos(),
        })
        .send();

      // inner txns
      expect(res.confirmations[5].innerTxns?.length).to.equal(3);
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.type).to.equal("axfer");
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.sender).to.deep.equal(getApplicationAddress(appId));
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.assetTransfer).to.not.be.undefined;
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.assetTransfer?.assetIndex).to.equal(tokenPaymentAssetId);
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.assetTransfer?.amount).to.equal(executorAmount);
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.assetTransfer?.assetSender).to.be.undefined;
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.assetTransfer?.receiver).to.deep.equal(
        getApplicationAddress(executorAppId)
      );
      expect(res.confirmations[5].innerTxns?.[1].txn.txn.assetTransfer?.closeRemainderTo).to.be.undefined;

      // logs
      expect(res.confirmations[5].innerTxns?.[2].logs).to.not.be.undefined;
      expect(res.confirmations[5].innerTxns?.[2].logs?.[0]).to.deep.equal(
        getEventBytes("RequestForExecution(uint64,uint16,byte[32],address,byte[],byte[],byte[])", [
          executorAmount,
          PEER_CHAIN,
          PEER_CONTRACT,
          EXECUTOR_ARGS.refundAddress,
          EXECUTOR_ARGS.signedQuoteBytes,
          encodeNttV1Request(OUR_CHAIN, convertNumberToBytes(nttManagerAppId, 32), MESSAGE_ID),
          EXECUTOR_ARGS.relayInstructions,
        ])
      );
    });
  });
});
