// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@native-token-transfers/NttManager/NttManagerNoRateLimiting.sol";
import "@native-token-transfers/interfaces/IManagerBase.sol";

contract MockNttManager is NttManagerNoRateLimiting {
    constructor(
        address _token,
        IManagerBase.Mode _mode,
        uint16 _chainId,
        address owner
    ) NttManagerNoRateLimiting(_token, _mode, _chainId) {
        _transferOwnership(owner);
    }
}
