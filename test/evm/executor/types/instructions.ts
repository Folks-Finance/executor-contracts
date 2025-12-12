import type { Hex } from "viem";

export type GasInstruction = { gasLimit: bigint; msgValue: bigint };

export type NativeTokenQuoteInstruction = {
  prefix: Hex;
  quoterAddress: Hex;
  payeeAddress: Hex;
  sourceChain: number;
  destinationChain: number;
  expiryTime: bigint;
  baseFee: bigint;
  destinationGasPrice: bigint;
  sourcePrice: bigint;
  destinationPrice: bigint;
  signature: Hex; // 65 bytes
};

export type CustomTokenQuoteInstruction = {
  prefix: Hex;
  quoterAddress: Hex;
  payeeAddress: Hex;
  sourceChain: number;
  destinationChain: number;
  expiryTime: bigint;
  baseFee: bigint;
  destinationGasPrice: bigint;
  sourcePrice: bigint;
  destinationPrice: bigint;
  tokenAddress: Hex;
  signature: Hex; // 65 bytes
};

export type VAAv1RequestInstruction = {
  emitterChain: number;
  emitterAddress: Hex;
  sequence: bigint;
};

export type NTTv1RequestInstruction = {
  srcChain: number;
  srcManager: Hex;
  messageId: Hex;
};
