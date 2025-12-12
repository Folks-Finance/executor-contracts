import { pad } from "viem";

import type { Hex } from "viem";

export const addressToBytes32 = (address: Hex): Hex => {
  return pad(address, { size: 32 });
};

export function unixTime(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}
