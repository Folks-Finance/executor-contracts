import type { AlgorandFixture } from "@algorandfoundation/algokit-utils/types/testing";

export const SECONDS_IN_MINUTE = 60n;
export const SECONDS_IN_HOUR = 60n * SECONDS_IN_MINUTE;
export const SECONDS_IN_DAY = 24n * SECONDS_IN_HOUR;
export const SECONDS_IN_WEEK = 7n * SECONDS_IN_DAY;
export const SECONDS_IN_YEAR = 365n * SECONDS_IN_DAY;

export function unixTime(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

export async function getPrevBlockTimestamp(localnet: AlgorandFixture): Promise<bigint> {
  const { lastRound } = await localnet.algorand.client.algod.status().do();
  const { block } = await localnet.algorand.client.algod.block(lastRound).do();
  return block.header.timestamp;
}

export async function advancePrevBlockTimestamp(localnet: AlgorandFixture, secs: number | bigint): Promise<bigint> {
  // set offset
  await localnet.algorand.client.algod.setBlockOffsetTimestamp(secs).do();

  // add block for new timestamp
  const account = await localnet.algorand.account.localNetDispenser();
  const res = await localnet.algorand.send.payment({ sender: account, receiver: account, amount: (0).microAlgos() });
  const { confirmedRound } = res.confirmations[0];
  if (!confirmedRound) throw Error("Unknown confirmed round");
  const { block } = await localnet.algorand.client.algod.block(confirmedRound).do();

  // reset offset
  await localnet.algorand.client.algod.setBlockOffsetTimestamp(0).do();

  // return timestamp of latest block
  return block.header.timestamp;
}
