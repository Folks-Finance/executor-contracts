import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { expect } from "chai";

import { ExecutorMessagesExposedFactory } from "../../../../specs/client/ExecutorMessagesExposed.client.js";
import { getRandomBytes } from "../../utils/bytes.js";
import { encodeNttV1Request, encodeVaaV1Request } from "../../utils/quote.js";
import { getRandomUInt, MAX_UINT64 } from "../../utils/uint.js";

import type { ExecutorMessagesExposedClient } from "../../../../specs/client/ExecutorMessagesExposed.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

describe("ExecutorMessages", () => {
  const localnet = algorandFixture();

  let factory: ExecutorMessagesExposedFactory;
  let client: ExecutorMessagesExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(ExecutorMessagesExposedFactory, {
        defaultSender: creator,
        defaultSigner: creator.signer,
      });

      // deploy library
      {
        const { appClient, result } = await factory.deploy({
          createParams: { sender: creator },
        });
        appId = result.appId;
        client = appClient;

        expect(appId).not.to.equal(0n);
      }
    },
    { timeout: 20_000 }
  );

  describe("make vaa v1 request", () => {
    it("succeeds", async () => {
      const emitterChain = getRandomUInt(2);
      const emitterAddress = getRandomBytes(32);
      const sequence = getRandomUInt(MAX_UINT64);
      const requestBytes = await client.makeVaaV1Request({ args: [emitterChain, emitterAddress, sequence] });
      expect(requestBytes).to.deep.equal(encodeVaaV1Request(emitterChain, emitterAddress, sequence));
    });
  });

  describe("make ntt v1 request", () => {
    it("succeeds", async () => {
      const sourceChain = getRandomUInt(2);
      const sourceManager = getRandomBytes(32);
      const messageId = getRandomBytes(32);
      const requestBytes = await client.makeNttV1Request({ args: [sourceChain, sourceManager, messageId] });
      expect(requestBytes).to.deep.equal(encodeNttV1Request(sourceChain, sourceManager, messageId));
    });
  });
});
