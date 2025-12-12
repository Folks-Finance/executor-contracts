// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-vaa-executor/interfaces/IVaaV1Receiver.sol";
import "./interfaces/IVAAv1ReceiveWithGasDropOff.sol";
import "./libraries/Utils.sol";

string constant safeVAAv1ReceiveWithGasDropOffVersion = "SafeVAAv1ReceiveWithGasDropOff-0.0.1";

contract SafeVAAv1ReceiveWithGasDropOff {
    string public constant VERSION = safeVAAv1ReceiveWithGasDropOffVersion;
    uint256 public constant RETURN_DATA_TRUNCATION_THRESHOLD = 132;
    IVAAv1ReceiveWithGasDropOff public immutable VAAv1ReceiveWithGasDropOff;

    event VAAMessageReceived(bytes32 requestForExecutionId, bool success, bytes errorReason);

    constructor(IVAAv1ReceiveWithGasDropOff _VAAv1ReceiveWithGasDropOff) {
        VAAv1ReceiveWithGasDropOff = _VAAv1ReceiveWithGasDropOff;
    }

    function receiveMessage(
        address contractAddr,
        bytes calldata message,
        address payeeAddress,
        uint256 dropOffValue,
        uint256 gasLimit,
        bytes32 requestForExecutionId
    ) external payable {
        bytes memory callData = abi.encodeCall(
            IVAAv1ReceiveWithGasDropOff.receiveMessage,
            (contractAddr, message, payeeAddress, dropOffValue)
        );

        // If it reverts, returns the first RETURN_DATA_TRUNCATION_THRESHOLD bytes of the revert message
        (bool success, bytes memory errorReason) = returnLengthBoundedCall(
            payable(address(VAAv1ReceiveWithGasDropOff)),
            callData,
            gasLimit,
            msg.value,
            RETURN_DATA_TRUNCATION_THRESHOLD
        );

        emit VAAMessageReceived(requestForExecutionId, success, errorReason);
    }
}
