// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

contract MockTransceiver {
    uint256 public quote = 0;

    function setQuote(uint256 _quote) external {
        quote = _quote;
    }

    struct TransceiverInstruction {
        uint8 index;
        bytes payload;
    }

    function quoteDeliveryPrice(uint16, TransceiverInstruction calldata) external view returns (uint256) {
        return quote;
    }

    function sendMessage(uint16, TransceiverInstruction memory, bytes memory, bytes32, bytes32) external payable {}
}
