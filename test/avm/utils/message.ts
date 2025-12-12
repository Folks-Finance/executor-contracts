import { keccak_256 } from "@noble/hashes/sha3";

import { convertNumberToBytes, getRandomBytes } from "./bytes.js";
import { unixTime } from "./time.js";

export type WormholeVAA = {
  header: Uint8Array;
  body: Uint8Array;
  vaaBytes: Uint8Array;
  vaaDigest: Uint8Array;
};

export function getWormholeVAA(
  emitterChainId: number | bigint,
  emitterAddress: Uint8Array,
  sequence: number | bigint,
  payload: Uint8Array
): WormholeVAA {
  const numSignatures = 13;
  const header = Uint8Array.from([
    ...convertNumberToBytes(1, 1), // version
    ...convertNumberToBytes(4, 4), // guardian set index
    ...convertNumberToBytes(numSignatures, 1), // len_signatures
    ...getRandomBytes(66 * numSignatures), // signatures
  ]);
  const body = Uint8Array.from([
    ...convertNumberToBytes(unixTime(), 4), // timestamp
    ...convertNumberToBytes(0, 4), // nonce
    ...convertNumberToBytes(emitterChainId, 2), // emitter chain
    ...emitterAddress, // emitter address
    ...convertNumberToBytes(sequence, 8), // sequence
    ...convertNumberToBytes(15, 1), // consistency level
    ...payload, // payload
  ]);
  const vaaBytes = Uint8Array.from([...header, ...body]);
  const digest = keccak_256(keccak_256(body));
  return { header, body, vaaBytes, vaaDigest: digest };
}
