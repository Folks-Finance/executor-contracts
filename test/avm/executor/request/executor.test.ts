import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { getApplicationAddress, OnApplicationComplete } from "algosdk";
import { expect } from "chai";

import { ExecutorFactory } from "../../../../specs/client/Executor.client.js";
import { convertNumberToBytes, enc, getEventBytes, getRandomBytes } from "../../utils/bytes.js";
import { encodedSignedQuoteBody, encodeSignedQuote, encodeSignedQuoteHeader } from "../../utils/quote.js";
import { getPrevBlockTimestamp } from "../../utils/time.js";
import { getRandomUInt } from "../../utils/uint.js";

import type { ExecutorClient } from "../../../../specs/client/Executor.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

describe("Executor", () => {
  const localnet = algorandFixture();

  let factory: ExecutorFactory;
  let client: ExecutorClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;
  let user: Address & Account & TransactionSignerAccount;
  let refundTo: Address & Account & TransactionSignerAccount;
  let payee: Address & Account & TransactionSignerAccount;

  const EXECUTOR_VERSION = "Executor-0.0.1";
  const OUR_CHAIN = 8;

  const prefix = enc.encode("EQ01");
  const quoterAddress = getRandomBytes(20);
  const destinationChain = 6;
  const destinationAddress = getRandomBytes(32);

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });
      user = await generateAccount({ initialFunds: (100).algo() });
      refundTo = await generateAccount({ initialFunds: (100).algo() });
      payee = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(ExecutorFactory, {
        defaultSender: creator,
        defaultSigner: creator.signer,
      });
    },
    { timeout: 20_000 }
  );

  describe("creation", () => {
    it("deploys with correct state", async () => {
      const { appClient, result } = await factory.deploy({
        createParams: {
          sender: creator,
          method: "create",
          args: [OUR_CHAIN],
        },
      });
      appId = result.appId;
      client = appClient;

      expect(appId).not.to.equal(0n);
      expect(await client.state.global.executorVersion()).to.equal(EXECUTOR_VERSION);
      expect(await client.state.global.ourChain()).to.equal(OUR_CHAIN);
    });
  });

  describe("request execution", () => {
    it("fails when fee payment isn't payment", async () => {
      const feePaymentTxn = await localnet.algorand.createTransaction.assetCreate({
        sender: user,
        total: 1n,
        decimals: 6,
        assetName: "",
        unitName: "",
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
              client.appClient.getABIMethod("request_execution").getSelector(),
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
        expect((e as Error).message).to.include("transaction type is pay");
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
      it(`fails when dst chain is ${dstChainLength}, dst addr is ${dstAddrLength}, refund addr is ${refundAddrLength}, signed quotes bytes delta ${signedQuoteBytesLengthDelta}, request bytes delta ${requestBytesLengthDelta} and relay instructions delta ${relayInstructionsLengthDelta} bytes`, async () => {
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
                client.appClient.getABIMethod("request_execution").getSelector(),
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

    it("fails when quote source chain mismatch", async () => {
      const sourceChain = 31;
      expect(sourceChain).not.to.equal(OUR_CHAIN);

      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(10).algo();
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, sourceChain, destinationChain, expiryTime),
        encodedSignedQuoteBody()
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: user,
        receiver: getApplicationAddress(appId),
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecution({
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
          extraFee: (1000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Quote source chain mismatch");
      }
    });

    it("fails when quote destination chain mismatch", async () => {
      const incorrectDestinationChain = 22;
      expect(incorrectDestinationChain).not.to.equal(destinationChain);

      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(10).algo();
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedSignedQuoteBody()
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: user,
        receiver: getApplicationAddress(appId),
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecution({
          sender: user,
          args: [
            feePaymentTxn,
            incorrectDestinationChain,
            destinationAddress,
            refundTo.toString(),
            signedQuoteBytes,
            requestBytes,
            relayInstructions,
          ],
          extraFee: (1000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Quote destination chain mismatch");
      }
    });

    for (const { offset, name } of [
      {
        name: "with same timestamp",
        offset: 0n,
      },
      {
        name: "with timestamp in past",
        offset: 30n,
      },
    ]) {
      it(`fails when quote expired ${name}`, async () => {
        // prepare bytes
        const expiryTime = (await getPrevBlockTimestamp(localnet)) - offset;
        const estimatedCost = getRandomUInt(10).algo();
        const signedQuoteBytes = encodeSignedQuote(
          encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
          encodedSignedQuoteBody()
        );
        const requestBytes = getRandomBytes(46);
        const relayInstructions = getRandomBytes(33);

        // request execution
        const feePaymentTxn = await localnet.algorand.createTransaction.payment({
          sender: user,
          receiver: getApplicationAddress(appId),
          amount: estimatedCost,
        });

        try {
          await client.send.requestExecution({
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
            extraFee: (1000).microAlgos(),
          });
          expect.fail("Expected function to throw");
        } catch (e) {
          expect((e as Error).message).to.include("Quote expired");
        }
      });
    }

    it("fails when fee sender is different", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(10).algo();
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedSignedQuoteBody()
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: creator,
        receiver: getApplicationAddress(appId),
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecution({
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
          extraFee: (1000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Fee txn must be from same sender");
      }
    });

    it("fails when fee recipient is not app address", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(10).algo();
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedSignedQuoteBody()
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: user,
        receiver: user.toString(),
        amount: estimatedCost,
      });

      try {
        await client.send.requestExecution({
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
          extraFee: (1000).microAlgos(),
        });
        expect.fail("Expected function to throw");
      } catch (e) {
        expect((e as Error).message).to.include("Unknown fee payment receiver");
      }
    });

    it("succeeds", async () => {
      // prepare bytes
      const expiryTime = (await getPrevBlockTimestamp(localnet)) + 60n;
      const estimatedCost = getRandomUInt(10).algo();
      const signedQuoteBytes = encodeSignedQuote(
        encodeSignedQuoteHeader(prefix, quoterAddress, payee.publicKey, OUR_CHAIN, destinationChain, expiryTime),
        encodedSignedQuoteBody()
      );
      const requestBytes = getRandomBytes(46);
      const relayInstructions = getRandomBytes(33);

      // balances before
      const { balance: payeeBalanceBefore } = await localnet.algorand.account.getInformation(payee);

      // request execution
      const feePaymentTxn = await localnet.algorand.createTransaction.payment({
        sender: user,
        receiver: getApplicationAddress(appId),
        amount: estimatedCost,
      });
      const res = await client.send.requestExecution({
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
        extraFee: (1000).microAlgos(),
      });

      // logs
      expect(res.confirmations[1].logs).not.to.be.undefined;
      expect(res.confirmations[1].logs?.[0]).to.deep.equal(
        getEventBytes("RequestForExecution(byte[20],uint64,uint16,byte[32],address,byte[],byte[],byte[])", [
          quoterAddress,
          estimatedCost.microAlgos,
          destinationChain,
          destinationAddress,
          refundTo.toString(),
          signedQuoteBytes,
          requestBytes,
          relayInstructions,
        ])
      );

      // inner txns
      expect(res.confirmations[1].innerTxns?.length).to.equal(1);
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.type).to.equal("pay");
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.payment?.amount).to.equal(estimatedCost.microAlgos);
      expect(res.confirmations[1].innerTxns?.[0].txn.txn.payment?.receiver.toString()).to.equal(payee.toString());

      // balances after
      const { balance: payeeBalanceAfter } = await localnet.algorand.account.getInformation(payee);
      expect(payeeBalanceAfter.microAlgos).to.equal(payeeBalanceBefore.microAlgos + estimatedCost.microAlgos);
    });
  });
});
