# Executor contracts

[![License: Apache-2.0][license-image]][license-url]
[![CI][ci-image]][ci-url]

## Table of Contents

- [Overview](#overview)
- [Structure and Usage](#structure-and-usage)
  - [EVM](#evm)
    - [Smart-contracts overview](#smart-contracts-overview)
    - [Setup](#setup)
  - [AVM](#avm)
    - [Smart-contracts overview](#smart-contracts-overview-1)
    - [Setup](#setup-1)
- [Quote](#quote)

## Overview

PuyaPy implementation of [Executor](https://github.com/wormholelabs-xyz/example-messaging-executor) and TokenPaymentExecutor, solidity implementation of TokenPaymentExecutor.

TokenPaymentExecutor extends functionality of [Wormhole Executor](https://github.com/wormholelabs-xyz/example-messaging-executor) to
support of paying Executor fee both in native and in custom tokens (default Wormhole Executor support only native token payments).

Before proceeding with this repository is highly recommended to get known with [Wormhole executor integration notes](https://wormholelabs.notion.site/Executor-Integration-Notes-Public-1bd3029e88cb804e8281ec19e3264c3b).
This document explain logic of integration of wormhole executor.

## Structure and usage

### EVM

#### Smart-contracts overview

EVM smart-contracts located in `contracts/evm` directory.

`TokenPaymentExecutor` and `NttManagerWithTokenPaymentExecutor` contracts extend functionality of default Wormhole VAA and NTT executor, allowing to take executor fee in custom token.

`SafeMultiReceiveWithGasDropOff` and `SafeVAAv1ReceiveWithGasDropOff` contracts are wrappers on default Wormhole receiver contracts to avoid extra gas consumption by receiver contracts and ensure parent call is succeed. In simple words `returnLengthBoundedCall` works as try/catch on default Wormhole receiver contract.

#### Setup

Install git submodules:

```bash
git submodule update --init --recursive
```

Install [foundry](https://getfoundry.sh/):

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup -i v1.5.0
```

Install required packages:

```bash
npm install
```

Build the project:

```bash
npm run build:evm
```

Run tests:

```bash
npm run test:evm
```

### AVM

#### Smart-contracts overview

AVM smart-contracts located in `contracts/avm` directory.

`Executor` and `NttManagerWithExecutor` are analogs of [Wormhole smart-contracts](https://github.com/wormholelabs-xyz/example-messaging-executor/blob/main/evm/src/Executor.sol) written for Algorand.

`TokenPaymentExecutor` and `NttManagerWithTokenPaymentExecutor` contracts extend functionality of `Executor` and `NttManagerWithExecutor`, allowing to take executor fee in custom token.

`NttV1ReceiveWithGasDropOff` and `VAAv1ReceiveWithGasDropOff` are analogs of default Wormhole receiver contracts on Algorand.

#### Setup

Activate virtual environment and install required packages:

```bash
python3 -m venv venv
source venv/bin/activate
python3 -m pip install -r requirements.txt
```

Build the project:

```bash
npm run build:avm
```

Make sure to run the compilation commands before testing.

Run tests ([Algokit](https://developer.algorand.org/docs/get-started/algokit/) is required):

```bash
algokit localnet start
npm run test:avm
```

## Quote

To recognize payment in custom token - specific quote prefix used: `EQC1`.
Also there is additional parameter in quote body for `EQC1`, named `tokenAddress`. The difference between quote bodies bytes for different prefixes listed below:

#### Signed Quote Header

```solidity
bytes4  prefix;           // 4-byte prefix for this struct
address quoterAddress;    // The public key of the quoter. Used to identify an execution provider.
bytes32 payeeAddress;     // UniversalAddress of a payee for the quoter on the sending chain.
uint16  sourceChain;      // Wormhole Chain ID
uint16  destinationChain; // Wormhole Chain ID
uint64  expiryTime;       // The unix time, in seconds, after which this quote should no longer be considered valid for requesting an execution
```

#### Signed Quote (for native token payments)

```solidity
Header   header              // prefix = "EQ01"
uint64   baseFee             // The base fee, in sourceChain native currency, required by the quoter to perform an execution on the destination chain
uint64   destinationGasPrice // The current gas price on the destination chain
uint64   sourcePrice         // The USD price, in 10^10, of the sourceChain native currency
uint64   destinationPrice    // The USD price, in 10^10, of the destinationChain native currency
[65]byte signature           // Quoter's signature of the previous bytes
```

#### Signed Quote (for custom token payments)

```solidity
Header   header              // prefix = "EQC1"
uint64   baseFee             // The base fee, in sourceChain custom token, required by the quoter to perform an execution on the destination chain
uint64   destinationGasPrice // The current gas price on the destination chain
uint64   sourcePrice         // The USD price, in 10^10, of the sourceChain custom token
uint64   destinationPrice    // The USD price, in 10^10, of the destinationChain native currency
bytes32  tokenAddress        // UniversalAddress of the custom token on the sourceChain
[65]byte signature           // Quoter's signature of the previous bytes
```

[license-image]: https://img.shields.io/badge/License-Apache%202.0-brightgreen.svg?style=flat-square
[license-url]: https://opensource.org/license/apache-2-0
[ci-image]: https://img.shields.io/github/actions/workflow/status/Folks-Finance/executor-contracts/format.yml?branch=main&logo=github&style=flat-square
[ci-url]: https://github.com/Folks-Finance/executor-contracts/actions/workflows/format.yml
