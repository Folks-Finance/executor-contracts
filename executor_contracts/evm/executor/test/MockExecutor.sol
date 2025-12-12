// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-vaa-executor/Executor.sol";

contract MockExecutor is Executor {
    constructor(uint16 _ourChain) Executor(_ourChain) {}
}
