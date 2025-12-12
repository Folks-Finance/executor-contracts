// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-vaa-executor/interfaces/IVaaV1Receiver.sol";

contract MockReceiver is IVaaV1Receiver {
    string public errorReason = "";

    function setErrorReason(string memory _errorReason) external {
        errorReason = _errorReason;
    }

    function executeVAAv1(bytes memory) external payable {
        if (bytes(errorReason).length == 0) {
            return;
        }
        revert(errorReason);
    }
}
