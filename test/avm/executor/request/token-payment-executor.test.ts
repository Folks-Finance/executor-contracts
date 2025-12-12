import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { getApplicationAddress, OnApplicationComplete } from "algosdk";
import { expect } from "chai";

import { MockExecutorFactory } from "../../../../specs/client/MockExecutor.client.js";
import { TokenPaymentExecutorFactory } from "../../../../specs/client/TokenPaymentExecutor.client.js";
import { convertNumberToBytes, enc, getEventBytes, getRandomBytes } from "../../utils/bytes.js";
import { encodedTokenPaymentSignedQuoteBody, encodeSignedQuote, encodeSignedQuoteHeader } from "../../utils/quote.js";
import { getPrevBlockTimestamp } from "../../utils/time.js";
import { getRandomUInt } from "../../utils/uint.js";

import type { TokenPaymentExecutorClient } from "../../../../specs/client/TokenPaymentExecutor.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

describe("TokenPaymentExecutor", () => {
  const localnet = algorandFixture();

  const TOTAL = 50_000_000_000_000n;
  const DECIMALS = 6;
  const ASSET_NAME = "Folks Finance";
  const UNIT_NAME = "FOLKS";
  let assetId: bigint;
  let fakeAssetId: bigint;

  let executorFactory: MockExecutorFactory;
  let executorAppId: bigint;

  let factory: TokenPaymentExecutorFactory;
  let client: TokenPaymentExecutorClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let user: Address & Account & TransactionSignerAccount;
  let refundTo: Address & Account & TransactionSignerAccount;
  let payee: Address & Account & TransactionSignerAccount;

  const EXECUTOR_VERSION = "TokenPaymentExecutor-0.0.1";
  const OUR_CHAIN = 8n;

  const prefix = enc.encode("EQC1");
  const quoterAddress = getRandomBytes(20);
  const destinationChain = 6n;
  const destinationAddress = getRandomBytes(32);

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });
      user = await generateAccount({ initialFunds: (100).algo() });
      refundTo = await generateAccount({ initialFunds: (100).algo() });
      payee = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(TokenPaymentExecutorFactory, {
        defaultSender: creator,
        defaultSigner: creator.signer,
      });

      // create asset
      {
        const res = await localnet.algorand.send.assetCreate({
          sender: creator,
          total: TOTAL,
          decimals: DECIMALS,
          assetName: ASSET_NAME,
          unitName: UNIT_NAME,
        });
        assetId = res.assetId;
      }

      // create fake asset
      {
        const res = await localnet.algorand.send.assetCreate({
          sender: creator,
          total: TOTAL,
          decimals: DECIMALS,
          assetName: ASSET_NAME,
          unitName: UNIT_NAME,
        });
        fakeAssetId = res.assetId;
      }

      // opt payee and user into asset (+fake asset) and fund
      await localnet.algorand.send.assetOptIn({ sender: payee, assetId });
      await localnet.algorand.send.assetOptIn({ sender: user, assetId });
      await localnet.algorand.send.assetTransfer({ sender: creator, receiver: user, assetId, amount: BigInt(100e6) });
      await localnet.algorand.send.assetOptIn({ sender: payee, assetId: fakeAssetId });
      await localnet.algorand.send.assetOptIn({ sender: user, assetId: fakeAssetId });
      await localnet.algorand.send.assetTransfer({
        sender: creator,
        receiver: user,
        assetId: fakeAssetId,
        amount: BigInt(100e6),
      });

      // deploy executor
      {
        executorFactory = localnet.algorand.client.getTypedAppFactory(MockExecutorFactory, {
          defaultSender: creator,
          defaultSigner: creator.signer,
        });
        const { result } = await executorFactory.deploy();
        executorAppId = result.appId;

        expect(executorAppId).not.to.equal(0n);
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
          args: [executorAppId],
        },
      });
      appId = result.appId;
      client = appClient;

      expect(appId).not.to.equal(0n);
      expect(await client.state.global.executorVersion()).to.equal(EXECUTOR_VERSION);
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
          args: [assetId],
          extraFee: (1000).microAlgos(),
        })
        .send();

      expect(confirmations.length).to.equal(2);
      expect(confirmations[1].innerTxns).to.not.be.undefined;
      const optIntoAssetTx = confirmations[1].innerTxns?.[0];
      expect(optIntoAssetTx?.txn.txn.type).to.equal("axfer");
      expect(optIntoAssetTx?.txn.txn.sender).to.deep.equal(getApplicationAddress(appId));
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer).to.not.be.undefined;
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.assetIndex).to.equal(assetId);
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.amount).to.equal(0n);
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.assetSender).to.be.undefined;
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.receiver).to.deep.equal(
        getApplicationAddress(appId)
      );
      expect(confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.closeRemainderTo).to.be.undefined;
    });
  });

  describe("request execution with token payment", () => {
    it("fails when fee payment isn't asset transfer", async () => {
      const feePaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: user,
        receiver: getApplicationAddress(appId),
        amount: (0).microAlgos(),
      });
      const signedQuoteBytes = getRandomBytes(100);
      const requestBytes = getRandomBytes(60);
      const relayInstructions = getRandomBytes(34);

      try {
        await localnet.algorand
          .newGroup()
          .addTransaction(feePaymentTxn)
          .addAppCall({
            sender: user,
            appId,
            onComplete: OnApplicationComplete.NoOpOC,
            args: [
              client.appClient.getABIMethod("request_execution_with_token_payment").getSelector(),
              convertNumberToBytes(0, 2),
              getRandomBytes(32),
              getRandomBytes(32),
              Uint8Array.from([...convertNumberToBytes(signedQuoteBytes.length, 2), ...signedQuoteBytes]),
              Uint8Array.from([...convertNumberToBytes(requestBytes.length, 2), ...requestBytes]),
              Uint8Array.from([...convertNumberToBytes(relayInstructions.length, 2), ...relayInstructions]),
            ],
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("transaction type is axfer");
      }
    });

    for (const {
      dstChainLength,
      dstAddrLength,
      refundAddrLength,
      signedQuoteBytesLengthDelta,
      requestBytesLengthDelta,
      relayInstructionsLengthDelta,
      arg,
    } of [
      {
        dstChainLength: 1,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.uint16",
      },
      {
        dstChainLength: 4,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.uint16",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 30,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.static_array<arc4.uint8, 32>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 34,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.static_array<arc4.uint8, 32>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 16,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.static_array<arc4.uint8, 32>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 40,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.static_array<arc4.uint8, 32>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: -1,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.dynamic_array<arc4.uint8>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 1,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.dynamic_array<arc4.uint8>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: -1,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.dynamic_array<arc4.uint8>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 1,
        relayInstructionsLengthDelta: 0,
        arg: "arc4.dynamic_array<arc4.uint8>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: -1,
        arg: "arc4.dynamic_array<arc4.uint8>",
      },
      {
        dstChainLength: 2,
        dstAddrLength: 32,
        refundAddrLength: 32,
        signedQuoteBytesLengthDelta: 0,
        requestBytesLengthDelta: 0,
        relayInstructionsLengthDelta: 1,
        arg: "arc4.dynamic_array<arc4.uint8>",
      },
    ]) {
      it(`fails when dst chain is $dstChainLength, dst addr is $dstAddrLength, refund addr is $refundAddrLength, signed quotes bytes delta $signedQuoteBytesLengthDelta, request bytes delta $requestBytesLengthDelta and relay instructions delta $relayInstructionsLengthDelta bytes`, async () => {
        const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
          sender: user,
          receiver: getApplicationAddress(appId),
          assetId,
          amount: 0n,
        });
        const signedQuoteBytes = getRandomBytes(100);
        const requestBytes = getRandomBytes(60);
        const relayInstructions = getRandomBytes(34);

        try {
          await localnet.algorand
            .newGroup()
            .addTransaction(feePaymentTxn)
            .addAppCall({
              sender: user,
              appId,
              onComplete: OnApplicationComplete.NoOpOC,
              args: [
                client.appClient.getABIMethod("request_execution_with_token_payment").getSelector(),
                convertNumberToBytes(0, dstChainLength),
                getRandomBytes(dstAddrLength),
                getRandomBytes(refundAddrLength),
                Uint8Array.from([
                  ...convertNumberToBytes(signedQuoteBytes.length + signedQuoteBytesLengthDelta, 2),
                  ...signedQuoteBytes,
                ]),
                Uint8Array.from([
                  ...convertNumberToBytes(requestBytes.length + requestBytesLengthDelta, 2),
                  ...requestBytes,
                ]),
                Uint8Array.from([
                  ...convertNumberToBytes(relayInstructions.length + relayInstructionsLengthDelta, 2),
                  ...relayInstructions,
                ]),
              ],
            })
            .send();
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include(`invalid number of bytes for ${arg}`);
        }
      });
    }

    it("fails when prefix mismatch", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(1_000_000);
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(
          enc.encode("EQ01"),
          quoterAddress,
          payee.publicKey,
          OUR_CHAIN,
          destinationChain,
          expiryTime
        ),
        encodedTokenPaymentSignedQuoteBody(convertNumberToBytes(assetId, 32))
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        receiver: getApplicationAddress(appId),
        assetId,
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecutionWithTokenPayment({
          sender: user,
          args: [
            feePaymentTxn,
            destinationChain,
            destinationAddress,
            refundTo.toString(),
            signedQuoteBytes,
            requestBytes,
            relayInstructions,
          ],
          extraFee: (3000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Prefix mismatch");
      }
    });

    it("fails when token address isn't an algorand asset", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(1_000_000);
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedTokenPaymentSignedQuoteBody(getRandomBytes(32))
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        receiver: getApplicationAddress(appId),
        assetId,
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecutionWithTokenPayment({
          sender: user,
          args: [
            feePaymentTxn,
            destinationChain,
            destinationAddress,
            refundTo.toString(),
            signedQuoteBytes,
            requestBytes,
            relayInstructions,
          ],
          extraFee: (3000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unsafe conversion of bytes32 to uint64");
      }
    });

    it("fails when fee sender is different", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(1_000_000);
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedTokenPaymentSignedQuoteBody(convertNumberToBytes(assetId, 32))
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: creator,
        receiver: getApplicationAddress(appId),
        assetId,
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecutionWithTokenPayment({
          sender: user,
          args: [
            feePaymentTxn,
            destinationChain,
            destinationAddress,
            refundTo.toString(),
            signedQuoteBytes,
            requestBytes,
            relayInstructions,
          ],
          extraFee: (3000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Fee txn must be from same sender");
      }
    });

    it("fails when fee recipient is not app address", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(1_000_000);
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedTokenPaymentSignedQuoteBody(convertNumberToBytes(assetId, 32))
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        receiver: user.toString(),
        assetId,
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecutionWithTokenPayment({
          sender: user,
          args: [
            feePaymentTxn,
            destinationChain,
            destinationAddress,
            refundTo.toString(),
            signedQuoteBytes,
            requestBytes,
            relayInstructions,
          ],
          extraFee: (3000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unknown fee payment receiver");
      }
    });

    it("fails when unknown asset id", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(1_000_000);
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedTokenPaymentSignedQuoteBody(convertNumberToBytes(assetId, 32))
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const APP_MIN_BALANCE = (100_000).microAlgos();
      const fundingTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: APP_MIN_BALANCE,
      });
      const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        receiver: getApplicationAddress(appId),
        assetId: fakeAssetId,
        amount: estimatedCost,
      });

      try {
        await client
          .newGroup()
          .addTransaction(fundingTxn)
          .whitelistTokenForPayment({
            sender: user,
            args: [fakeAssetId],
            extraFee: (1000).microAlgos(),
          })
          .requestExecutionWithTokenPayment({
            sender: user,
            args: [
              feePaymentTxn,
              destinationChain,
              destinationAddress,
              refundTo.toString(),
              signedQuoteBytes,
              requestBytes,
              relayInstructions,
            ],
            extraFee: (3000).microAlgos(),
          })
          .send();
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unknown asset id");
      }
    });

    it("succeeds", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(1_000_000);
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedTokenPaymentSignedQuoteBody(convertNumberToBytes(assetId, 32))
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.assetTransfer({
        sender: user,
        receiver: getApplicationAddress(appId),
        assetId,
        amount: estimatedCost,
      });
      const res = await client.send.requestExecutionWithTokenPayment({
        sender: user,
        args: [
          feePaymentTxn,
          destinationChain,
          destinationAddress,
          refundTo.toString(),
          signedQuoteBytes,
          requestBytes,
          relayInstructions,
        ],
        extraFee: (3000).microAlgos(),
      });

      // inner txns
      expect(res.confirmations[1].innerTxns?.length).to.equal(3);
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.type).to.equal("axfer");
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.sender).to.deep.equal(getApplicationAddress(appId));
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.assetTransfer).to.not.be.undefined;
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.assetIndex).to.equal(assetId);
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.amount).to.equal(estimatedCost);
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.assetSender).to.be.undefined;
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.receiver).to.deep.equal(payee.addr);
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.assetTransfer?.closeRemainderTo).to.be.undefined;
      expect(res.confirmations[1].innerTxns?.[1].txn.txn.type).to.equal("pay");
      expect(res.confirmations[1].innerTxns?.[1].txn.txn.payment?.amount).to.equal(0n);
      expect(res.confirmations[1].innerTxns?.[1].txn.txn.payment?.receiver.toString()).to.equal(
        getApplicationAddress(executorAppId).toString()
      );

      // logs
      expect(res.confirmations[1].logs).to.not.be.undefined;
      expect(res.confirmations[1].logs?.[0]).to.deep.equal(
        getEventBytes("PaymentInToken(uint64,uint64)", [assetId, estimatedCost])
      );
      expect(res.confirmations[1].innerTxns?.[2].logs).to.not.be.undefined;
      expect(res.confirmations[1].innerTxns?.[2].logs?.[0]).to.deep.equal(
        getEventBytes("RequestForExecution(uint64,uint16,byte[32],address,byte[],byte[],byte[])", [
          0,
          destinationChain,
          destinationAddress,
          refundTo.toString(),
          signedQuoteBytes,
          requestBytes,
          relayInstructions,
        ])
      );
    });
  });
});
