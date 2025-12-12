import { encodePacked, stringToHex } from "viem";

import { addressToBytes32 } from "../utils.js";

import type {
  CustomTokenQuoteInstruction,
  GasInstruction,
  NativeTokenQuoteInstruction,
  NTTv1RequestInstruction,
  VAAv1RequestInstruction,
} from "./types/instructions.js";
import type { Hex } from "viem";

export const NATIVE_TOKEN_FEE_PREFIX = stringToHex("EQ01");
export const CUSTOM_TOKEN_FEE_PREFIX = stringToHex("EQC1");
export const RECV_INST_TYPE_GAS = 1;
export const REQ_VAA_V1 = stringToHex("ERV1");
export const REQ_NTT_V1 = stringToHex("ERN1");

export const DEFAULT_TOKEN_PAYMENT_EXECUTOR_VERSION = "TokenPaymentExecutor-0.0.1";
export const DEFAULT_NTT_MANAGER_WITH_TOKEN_PAYMENT_EXECUTOR_VERSION = "NttManagerWithTokenPaymentExecutor-0.0.1";
export const DEFAULT_QUOTER_ADDRESS = "0xdaC17f958d2eE523a2206206994597C13D831bC7";
export const DEFAULT_SOURCE_ID = 321;
export const DEFAULT_SOURCE_TOKEN_PRICE = 8_000_000_000_000_000_000n;
export const DEFAULT_DESTINATION_TOKEN_PRICE = 6_000_000_000_000_000_000n;
export const DEFAULT_DESTINATION_GAS_PRICE = 3_000_000_000n;
export const DEFAULT_DESTINATION_ID = 123;
export const DEFAULT_BASE_FEE = 8_000_000_000n;
export const RANDOM_SIGNATURE =
  "0x05c69662be30fb318522b7c1b4a94672cba85768e8efce9fb3ee6d1d034a289e2d565479e31738d3f48d93702904c9cdaf0461d53f9a87fd524c16fa0a36e0cd65";
export const RETURN_DATA_TRUNCATION_THRESHOLD = 266; // 132 bytes * 2 + 2 (0x)

export const encodeGasInstructions = (instructions: Array<GasInstruction>): Hex => {
  const packedInstructions = instructions.map((instruction) =>
    encodePacked(["uint8", "uint128", "uint128"], [RECV_INST_TYPE_GAS, instruction.gasLimit, instruction.msgValue])
  );

  return `0x${packedInstructions.map((p) => p.slice(2)).join("")}`;
};

export const encodeNativeTokenQuoteInstruction = ({
  prefix,
  quoterAddress,
  payeeAddress,
  sourceChain,
  destinationChain,
  expiryTime,
  baseFee,
  destinationGasPrice,
  sourcePrice,
  destinationPrice,
  signature,
}: NativeTokenQuoteInstruction): Hex => {
  return encodePacked(
    ["bytes4", "address", "bytes32", "uint16", "uint16", "uint64", "uint64", "uint64", "uint64", "uint64", "bytes"],
    [
      prefix,
      quoterAddress,
      addressToBytes32(payeeAddress),
      sourceChain,
      destinationChain,
      expiryTime,
      baseFee,
      destinationGasPrice,
      sourcePrice,
      destinationPrice,
      signature,
    ]
  ).toLowerCase() as Hex;
};

export const encodeCustomTokenQuoteInstruction = ({
  prefix,
  quoterAddress,
  payeeAddress,
  sourceChain,
  destinationChain,
  expiryTime,
  baseFee,
  destinationGasPrice,
  sourcePrice,
  destinationPrice,
  tokenAddress,
  signature,
}: CustomTokenQuoteInstruction): Hex => {
  return encodePacked(
    [
      "bytes4",
      "address",
      "bytes32",
      "uint16",
      "uint16",
      "uint64",
      "uint64",
      "uint64",
      "uint64",
      "uint64",
      "bytes32",
      "bytes",
    ],
    [
      prefix,
      quoterAddress,
      addressToBytes32(payeeAddress),
      sourceChain,
      destinationChain,
      expiryTime,
      baseFee,
      destinationGasPrice,
      sourcePrice,
      destinationPrice,
      addressToBytes32(tokenAddress),
      signature,
    ]
  ).toLowerCase() as Hex;
};

export const encodeVAAv1RequestInstruction = ({
  emitterChain,
  emitterAddress,
  sequence,
}: VAAv1RequestInstruction): Hex => {
  return encodePacked(
    ["bytes4", "uint16", "bytes32", "uint64"],
    [REQ_VAA_V1, emitterChain, addressToBytes32(emitterAddress), sequence]
  ).toLowerCase() as Hex;
};

export const encodeNttRequestInstruction = ({ srcChain, srcManager, messageId }: NTTv1RequestInstruction): Hex => {
  return encodePacked(
    ["bytes4", "uint16", "bytes32", "bytes32"],
    [REQ_NTT_V1, srcChain, addressToBytes32(srcManager), messageId]
  ).toLowerCase() as Hex;
};
