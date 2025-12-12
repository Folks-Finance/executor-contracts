// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@example-vaa-executor/interfaces/IVaaV1Receiver.sol";
import "./interfaces/IMultiReceiveWithGasDropOff.sol";
import "./libraries/Utils.sol";

string constant safeMultiReceiveWithGasDropOffVersion = "SafeMultiReceiveWithGasDropOff-0.0.1";

contract SafeMultiReceiveWithGasDropOff {
    string public constant VERSION = safeMultiReceiveWithGasDropOffVersion;
    uint256 public constant RETURN_DATA_TRUNCATION_THRESHOLD = 132;
    IMultiReceiveWithGasDropOff public immutable MultiReceiveWithGasDropOff;

    event NTTMessageReceived(bytes32 requestForExecutionId, bool success, bytes errorReason);

    constructor(IMultiReceiveWithGasDropOff _MultiReceiveWithGasDropOff) {
        MultiReceiveWithGasDropOff = _MultiReceiveWithGasDropOff;
    }

    function receiveMessages(
        address[] calldata contracts,
        bytes[] calldata messages,
        address payeeAddress,
        uint256 gasLimit,
        bytes32[] calldata requestForExecutionIds
    ) external payable {
        bytes memory callData = abi.encodeCall(
            IMultiReceiveWithGasDropOff.receiveMessages,
            (contracts, messages, payeeAddress)
        );

        // If it reverts, returns the first RETURN_DATA_TRUNCATION_THRESHOLD bytes of the revert message
        (bool success, bytes memory errorReason) = returnLengthBoundedCall(
            payable(address(MultiReceiveWithGasDropOff)),
            callData,
            gasLimit,
            msg.value,
            RETURN_DATA_TRUNCATION_THRESHOLD
        );

        for (uint256 i = 0; i < requestForExecutionIds.length; i++) {
            emit NTTMessageReceived(requestForExecutionIds[i], success, success ? bytes("") : errorReason);
        }
    }
}
