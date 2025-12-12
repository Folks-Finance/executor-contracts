// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

interface IVAAv1ReceiveWithGasDropOff {
    error InvalidMsgValue(uint256 msgValue, uint256 dropOffValue);
    error DropOffFailed(address, uint256);

    /// @notice Receive a message on the specified contract and drops off the specified amount of gas.
    /// @param contractAddr The contract to receive message.
    /// @param message The message to be received.
    /// @param payeeAddress The address to receive the gas drop off.
    /// @param dropOffValue The amount of gas to be dropped off.
    function receiveMessage(
        address contractAddr,
        bytes calldata message,
        address payeeAddress,
        uint256 dropOffValue
    ) external payable;
}
