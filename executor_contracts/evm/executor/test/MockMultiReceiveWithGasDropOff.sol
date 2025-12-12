// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-vaa-executor/interfaces/IVaaV1Receiver.sol";
import "../interfaces/IMultiReceiveWithGasDropOff.sol";

contract MockMultiReceiveWithGasDropOff is IMultiReceiveWithGasDropOff {
    string public errorReason = "";
    bool public dropOffFailed = false;

    function setErrorReason(string memory _errorReason, bool _dropOffFailed) external {
        errorReason = _errorReason;
        dropOffFailed = _dropOffFailed;
    }

    function receiveMessages(address[] calldata, bytes[] calldata, address payeeAddress) external payable {
        if (dropOffFailed) {
            revert DropOffFailed(payeeAddress, msg.value);
        }
        if (bytes(errorReason).length == 0) {
            return;
        }
        revert(errorReason);
    }
}
