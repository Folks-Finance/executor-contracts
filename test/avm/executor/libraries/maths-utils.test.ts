import { describe, it, before } from "node:test";

import { algorandFixture } from "@algorandfoundation/algokit-utils/testing";
import { expect } from "chai";

import { MathsUtilsExposedFactory } from "../../../../specs/client/MathsUtilsExposed.client.js";
import { getRandomUInt, MAX_UINT64 } from "../../utils/uint.js";

import type { MathsUtilsExposedClient } from "../../../../specs/client/MathsUtilsExposed.client.js";
import type { TransactionSignerAccount } from "@algorandfoundation/algokit-utils/types/account";
import type { Account, Address } from "algosdk";

describe("MathsUtils", () => {
  const localnet = algorandFixture();

  let factory: MathsUtilsExposedFactory;
  let client: MathsUtilsExposedClient;
  let appId: bigint;

  let creator: Address & Account & TransactionSignerAccount;

  before(
    async () => {
      await localnet.newScope();
      const { algorand, generateAccount } = localnet.context;

      creator = await generateAccount({ initialFunds: (100).algo() });

      factory = algorand.client.getTypedAppFactory(MathsUtilsExposedFactory, {
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

  describe("calculate fee", () => {
    for (const { amount, dbps } of [
      // 0%
      { amount: 0n, dbps: 0n },
      { amount: 1_234_567n, dbps: 0n },
      { amount: getRandomUInt(MAX_UINT64), dbps: 0n },
      { amount: MAX_UINT64, dbps: 0n },
      // 0.001%
      { amount: 0n, dbps: 1n },
      { amount: 1_234_567n, dbps: 1n },
      { amount: getRandomUInt(MAX_UINT64), dbps: 1n },
      { amount: MAX_UINT64, dbps: 1n },
      // 0.105%
      { amount: 0n, dbps: 105n },
      { amount: 1_234_567n, dbps: 105n },
      { amount: getRandomUInt(MAX_UINT64), dbps: 105n },
      { amount: MAX_UINT64, dbps: 105n },
      // 2.5%
      { amount: 0n, dbps: 2500n },
      { amount: 1_234_567n, dbps: 2500n },
      { amount: getRandomUInt(MAX_UINT64), dbps: 2500n },
      { amount: MAX_UINT64, dbps: 2500n },
    ]) {
      it("of amount $amount and dbps $dbps succeeds", async () => {
        const expected = (amount * dbps) / 100_000n;
        expect(await client.calculateFee({ args: [amount, dbps] })).to.equal(expected);
      });
    }
  });
});
