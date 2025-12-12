// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@example-vaa-executor/interfaces/IExecutor.sol";
import "./interfaces/ITokenPaymentExecutor.sol";

string constant executorVersion = "TokenPaymentExecutor-0.0.1";

contract TokenPaymentExecutor is ITokenPaymentExecutor {
    string public constant EXECUTOR_VERSION = executorVersion;
    IExecutor public immutable executor;

    constructor(IExecutor _executor) {
        executor = _executor;
    }

    function requestExecutionWithTokenPayment(
        uint256 estimatedCost,
        uint16 dstChain,
        bytes32 dstAddr,
        address refundAddr,
        bytes calldata signedQuoteBytes,
        bytes calldata requestBytes,
        bytes calldata relayInstructions
    ) external {
        {
            bytes4 prefix;
            assembly {
                prefix := calldataload(signedQuoteBytes.offset)
            }

            if (prefix != CUSTOM_TOKEN_FEE_PREFIX) {
                revert PrefixMismatch(prefix, CUSTOM_TOKEN_FEE_PREFIX);
            }
        }

        {
            // take payment in token
            bytes32 universalPayeeAddress;
            bytes32 universalTokenAddress;
            uint256 amount = estimatedCost; // avoid stack too deep error
            assembly {
                universalPayeeAddress := calldataload(add(signedQuoteBytes.offset, 24))
                universalTokenAddress := calldataload(add(signedQuoteBytes.offset, 100))
            }
            // Check if the higher 96 bits (left-most 12 bytes) are non-zero
            if (uint256(universalPayeeAddress) >> 160 != 0) revert NotAnEvmAddress(universalPayeeAddress);
            if (uint256(universalTokenAddress) >> 160 != 0) revert NotAnEvmAddress(universalTokenAddress);

            address payeeAddress = address(uint160(uint256(universalPayeeAddress)));
            IERC20 tokenAddress = IERC20(address(uint160(uint256(universalTokenAddress))));
            SafeERC20.safeTransferFrom(tokenAddress, msg.sender, payeeAddress, amount);

            emit PaymentInToken(tokenAddress, amount);
        }

        // zero msg.value used because token payment covers entire cost
        executor.requestExecution(dstChain, dstAddr, refundAddr, signedQuoteBytes, requestBytes, relayInstructions);
    }
}
