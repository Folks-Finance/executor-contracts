import { convertNumberToBytes, enc, getRandomBytes } from "./bytes.js";
import { getRandomUInt } from "./uint.js";

export function encodeSignedQuoteHeader(
  prefix: Uint8Array,
  quoterAddress: Uint8Array,
  payeeAddress: Uint8Array,
  sourceChain: number | bigint,
  destinationChain: number | bigint,
  expiryTime: number | bigint
) {
  if (prefix.length !== 4) throw Error("Prefix must be 4 bytes");
  if (quoterAddress.length !== 20) throw Error("Quoter address must be 20 bytes");
  if (payeeAddress.length !== 32) throw Error("Payee address must be 32 bytes");
  return Uint8Array.from([
    ...prefix,
    ...quoterAddress,
    ...payeeAddress,
    ...convertNumberToBytes(sourceChain, 2),
    ...convertNumberToBytes(destinationChain, 2),
    ...convertNumberToBytes(expiryTime, 8),
  ]);
}

export function encodedSignedQuoteBody(
  baseFee: bigint = getRandomUInt(1_000_000),
  destinationGasPrice: bigint = getRandomUInt(1e16),
  sourcePrice: bigint = getRandomUInt(1e10),
  destinationPrice: bigint = getRandomUInt(1e10)
) {
  return Uint8Array.from([
    ...convertNumberToBytes(baseFee, 8),
    ...convertNumberToBytes(destinationGasPrice, 8),
    ...convertNumberToBytes(sourcePrice, 8),
    ...convertNumberToBytes(destinationPrice, 8),
    ...getRandomBytes(65), // faked signature
  ]);
}

export function encodedTokenPaymentSignedQuoteBody(
  tokenAddress: Uint8Array = getRandomBytes(32),
  baseFee: bigint = getRandomUInt(1_000_000),
  destinationGasPrice: bigint = getRandomUInt(1e16),
  sourcePrice: bigint = getRandomUInt(1e10),
  destinationPrice: bigint = getRandomUInt(1e10)
) {
  if (tokenAddress.length !== 32) throw Error("Token address must be 32 bytes");
  return Uint8Array.from([
    ...convertNumberToBytes(baseFee, 8),
    ...convertNumberToBytes(destinationGasPrice, 8),
    ...convertNumberToBytes(sourcePrice, 8),
    ...convertNumberToBytes(destinationPrice, 8),
    ...tokenAddress,
    ...getRandomBytes(65), // faked signature
  ]);
}

export function encodeSignedQuote(header: Uint8Array, body: Uint8Array) {
  return Uint8Array.from([...header, ...body]);
}

export function encodeVaaV1Request(emitterChain: number | bigint, emitterAddress: Uint8Array, sequence: bigint) {
  if (emitterAddress.length !== 32) throw Error("Emitter address must be 32 bytes");
  return Uint8Array.from([
    ...enc.encode("ERV1"),
    ...convertNumberToBytes(emitterChain, 2),
    ...emitterAddress,
    ...convertNumberToBytes(sequence, 8),
  ]);
}

export function encodeNttV1Request(sourceChain: number | bigint, sourceManager: Uint8Array, messageId: Uint8Array) {
  if (sourceManager.length !== 32) throw Error("Source manager must be 32 bytes");
  if (messageId.length !== 32) throw Error("Message id must be 32 bytes");
  return Uint8Array.from([
    ...enc.encode("ERN1"),
    ...convertNumberToBytes(sourceChain, 2),
    ...sourceManager,
    ...messageId,
  ]);
}

enum RelayInstruction {
  GAS = 1,
  GAS_DROP_OFF = 2,
}

export function encodeGasInstruction(gasLimit: bigint, msgValue: bigint) {
  return Uint8Array.from([
    ...convertNumberToBytes(RelayInstruction.GAS, 1),
    ...convertNumberToBytes(gasLimit, 16),
    ...convertNumberToBytes(msgValue, 16),
  ]);
}

export function encodeGasDropOffInstruction(dropOff: bigint, recipient: Uint8Array) {
  if (recipient.length !== 32) throw Error("Recipient must be 32 bytes");
  return Uint8Array.from([
    ...convertNumberToBytes(RelayInstruction.GAS_DROP_OFF, 1),
    ...convertNumberToBytes(dropOff, 16),
    ...recipient,
  ]);
}

export function encodeRelayInstructions(instructions: Array<Uint8Array>) {
  return Uint8Array.from([
    ...convertNumberToBytes(instructions.length, 2),
    ...instructions.flatMap((instruction) => [...instruction]),
  ]);
}
