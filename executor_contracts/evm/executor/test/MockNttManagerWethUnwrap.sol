// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@native-token-transfers/NttManager/NttManagerWethUnwrap.sol";
import "@native-token-transfers/interfaces/IManagerBase.sol";

contract MockNttManagerWethUnwrap is NttManagerWethUnwrap {
    constructor(
        address _token,
        IManagerBase.Mode _mode,
        uint16 _chainId,
        uint64 _rateLimitDuration,
        bool _skipRateLimiting,
        address owner
    ) NttManagerWethUnwrap(_token, _mode, _chainId, _rateLimitDuration, _skipRateLimiting) {
        _transferOwnership(owner);
    }
}
