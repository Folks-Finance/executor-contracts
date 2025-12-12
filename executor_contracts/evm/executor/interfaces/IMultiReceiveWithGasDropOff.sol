// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

interface IMultiReceiveWithGasDropOff {
    error InvalidParameters(uint256, uint256);
    error DropOffFailed(address, uint256);

    /// @notice Receive a series of messages on the specified contracts and do gas drop off if necessary.
    /// @param contracts An array of contracts to receive messages.
    /// @param messages An array of messages to be received, in lock-step with contracts.
    /// @param payeeAddress The address to receive the gas drop off.
    function receiveMessages(
        address[] calldata contracts,
        bytes[] calldata messages,
        address payeeAddress
    ) external payable;
}
