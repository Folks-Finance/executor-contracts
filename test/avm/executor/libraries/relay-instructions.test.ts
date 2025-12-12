import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { expect } from "chai";

import { RelayInstructionsExposedFactory } from "../../../../specs/client/RelayInstructionsExposed.client.js";
import { getRandomBytes } from "../../utils/bytes.js";
import { encodeGasDropOffInstruction, encodeGasInstruction } from "../../utils/quote.js";
import { getRandomUInt, MAX_UINT128 } from "../../utils/uint.js";

import type { RelayInstructionsExposedClient } from "../../../../specs/client/RelayInstructionsExposed.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

describe("RelayInstructions", () => {
  const localnet = algorandFixture();

  let factory: RelayInstructionsExposedFactory;
  let client: RelayInstructionsExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(RelayInstructionsExposedFactory, {
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

  describe("encode gas", () => {
    it("succeeds", async () => {
      const gasLimit = getRandomUInt(MAX_UINT128);
      const msgValue = getRandomUInt(MAX_UINT128);
      const instructionBytes = await client.encodeGas({ args: [gasLimit, msgValue] });
      expect(instructionBytes).to.deep.equal(encodeGasInstruction(gasLimit, msgValue));
    });
  });

  describe("encode gas drop off", () => {
    it("succeeds", async () => {
      const dropOff = getRandomUInt(MAX_UINT128);
      const recipient = getRandomBytes(32);
      const instructionBytes = await client.encodeGasDropOff({ args: [dropOff, recipient] });
      expect(instructionBytes).to.deep.equal(encodeGasDropOffInstruction(dropOff, recipient));
    });
  });
});
