import { readFileSync } from "node:fs";

import { OnApplicationComplete } from "algosdk";

import type { AlgorandFixture } from "@algorandfoundation/algokit-utils/types/testing";
import type { Address } from "algosdk";

export async function deployWormholeCore(localnet: AlgorandFixture, creator: string | Address): Promise<bigint> {
  const approvalTeal = Buffer.from(
    readFileSync("specs/teal/avm/executor/receive/test/MockWormholeCore.approval.teal")
  ).toString();
  const clearTeal = Buffer.from(
    readFileSync("specs/teal/avm/executor/receive/test/MockWormholeCore.clear.teal")
  ).toString();
  const approval = await localnet.algorand.app.compileTeal(approvalTeal);
  const clear = await localnet.algorand.app.compileTeal(clearTeal);
  const result = await localnet.algorand.send.appCreate({
    sender: creator,
    approvalProgram: approval.compiledBase64ToBytes,
    clearStateProgram: clear.compiledBase64ToBytes,
    onComplete: OnApplicationComplete.NoOpOC,
    args: [],
    schema: {
      globalInts: 1,
      globalByteSlices: 0,
      localInts: 0,
      localByteSlices: 1,
    },
  });
  return result.appId;
}
