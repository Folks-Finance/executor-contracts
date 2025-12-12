// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

bytes4 constant CUSTOM_TOKEN_FEE_PREFIX = "EQC1";

interface ITokenPaymentExecutor {
    error PrefixMismatch(bytes4 quotePrefix, bytes4 requiredPrefix);
    error NotAnEvmAddress(bytes32);

    event PaymentInToken(IERC20 indexed tokenAddress, uint256 amtPaid);

    function requestExecutionWithTokenPayment(
        uint256 estimatedCost,
        uint16 dstChain,
        bytes32 dstAddr,
        address refundAddr,
        bytes calldata signedQuoteBytes,
        bytes calldata requestBytes,
        bytes calldata relayInstructions
    ) external;
}
