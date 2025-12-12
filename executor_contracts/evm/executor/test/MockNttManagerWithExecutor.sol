// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-ntt-with-executor-evm/NttManagerWithExecutor.sol";

contract MockNttManagerWithExecutor is NttManagerWithExecutor {
    constructor(uint16 _chainId, address _executor) NttManagerWithExecutor(_chainId, _executor) {}
}
