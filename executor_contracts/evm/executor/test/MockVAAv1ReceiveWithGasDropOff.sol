// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-vaa-executor/interfaces/IVaaV1Receiver.sol";
import "../interfaces/IVAAv1ReceiveWithGasDropOff.sol";

contract MockVAAv1ReceiveWithGasDropOff is IVAAv1ReceiveWithGasDropOff {
    string public errorReason = "";
    bool public dropOffFailed = false;

    function setErrorReason(string memory _errorReason, bool _dropOffFailed) external {
        errorReason = _errorReason;
        dropOffFailed = _dropOffFailed;
    }

    function receiveMessage(address, bytes calldata, address payeeAddress, uint256 dropOffValue) external payable {
        if (dropOffFailed) {
            revert DropOffFailed(payeeAddress, dropOffValue);
        }
        if (bytes(errorReason).length == 0) {
            return;
        }
        revert(errorReason);
    }
}
