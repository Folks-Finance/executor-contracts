// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@example-vaa-executor/libraries/ExecutorMessages.sol";
import "@native-token-transfers/interfaces/INttManager.sol";

import "./interfaces/INttManagerWithTokenPaymentExecutor.sol";
import "./interfaces/ITokenPaymentExecutor.sol";

string constant nttManagerWithExecutorVersion = "NttManagerWithTokenPaymentExecutor-0.0.1";

/// @title  NttManagerWithTokenPaymentExecutor
/// @notice The NttManagerWithTokenPaymentExecutor contract is a shim contract that initiates
///         an NTT transfer using the executor for relaying.
///         Contract is similar to Wormhole NttManagerWithExecutor with difference
///         in taking execution fee in custom token.
contract NttManagerWithTokenPaymentExecutor is INttManagerWithTokenPaymentExecutor {
    using TrimmedAmountLib for uint256;
    using TrimmedAmountLib for TrimmedAmount;

    uint16 public immutable chainId;
    ITokenPaymentExecutor public immutable tokenPaymentExecutor;

    string public constant VERSION = nttManagerWithExecutorVersion;

    constructor(uint16 _chainId, address _tokenPaymentExecutor) {
        assert(_chainId != 0);
        assert(_tokenPaymentExecutor != address(0));
        chainId = _chainId;
        tokenPaymentExecutor = ITokenPaymentExecutor(_tokenPaymentExecutor);
    }

    // ==================== External Interface ===============================================

    function transfer(
        uint256 estimatedCost,
        address nttManager,
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipientAddress,
        bytes32 refundAddress,
        bytes memory encodedInstructions,
        ExecutorArgs calldata executorArgs,
        FeeArgs calldata feeArgs
    ) external payable returns (uint64 msgId) {
        INttManager nttm = INttManager(nttManager);

        // Custody the tokens in this contract and approve NTT to spend them.
        // Not worrying about dust here since the `NttManager` will revert in that case.
        address token = nttm.token();
        amount = custodyTokens(token, amount);

        // Transfer the fee to the referrer.
        amount = payFee(token, amount, feeArgs, nttm, recipientChain);

        // Initiate the transfer.
        SafeERC20.forceApprove(IERC20(token), nttManager, amount);
        msgId = nttm.transfer{ value: msg.value }(
            amount,
            recipientChain,
            recipientAddress,
            refundAddress,
            false,
            encodedInstructions
        );

        uint256 executorFee = estimatedCost; // Avoid stack too deep error
        {
            // Approve custom token fee for executor.
            bytes32 universalTokenAddress;
            assembly {
                universalTokenAddress := calldataload(add(add(executorArgs, calldataload(add(executorArgs, 32))), 132))
            }
            IERC20 tokenAddress = IERC20(address(uint160(uint256(universalTokenAddress))));
            SafeERC20.safeTransferFrom(tokenAddress, msg.sender, address(this), executorFee);
            SafeERC20.forceApprove(tokenAddress, address(tokenPaymentExecutor), executorFee);
        }

        // Generate the executor event.
        tokenPaymentExecutor.requestExecutionWithTokenPayment(
            executorFee,
            recipientChain,
            nttm.getPeer(recipientChain).peerAddress,
            executorArgs.refundAddress,
            executorArgs.signedQuote,
            ExecutorMessages.makeNTTv1Request(
                chainId,
                bytes32(uint256(uint160(address(nttm)))),
                bytes32(uint256(msgId))
            ),
            executorArgs.instructions
        );

        // Refund any excess value.
        uint256 currentBalance = address(this).balance;
        if (currentBalance > 0) {
            (bool refundSuccessful, ) = payable(executorArgs.refundAddress).call{ value: currentBalance }("");
            if (!refundSuccessful) {
                revert RefundFailed(currentBalance);
            }
        }
    }

    // necessary for receiving native assets
    receive() external payable {}

    // ==================== Internal Functions ==============================================

    function custodyTokens(address token, uint256 amount) internal returns (uint256) {
        // query own token balance before transfer
        uint256 balanceBefore = getBalance(token);

        // deposit tokens
        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);

        // return the balance difference
        return getBalance(token) - balanceBefore;
    }

    function getBalance(address token) internal view returns (uint256 balance) {
        // fetch the specified token balance for this contract
        (, bytes memory queriedBalance) = token.staticcall(
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
        );
        balance = abi.decode(queriedBalance, (uint256));
    }

    // @dev The fee is calculated as a percentage of the amount being transferred.
    function payFee(
        address token,
        uint256 amount,
        FeeArgs calldata feeArgs,
        INttManager nttManager,
        uint16 recipientChain
    ) internal returns (uint256) {
        uint256 fee = calculateFee(amount, feeArgs.dbps);
        fee = trimFee(nttManager, fee, recipientChain);
        if (fee > 0) {
            // Don't need to check for fee greater than or equal to amount because it can never be (since dbps is a uint16).
            amount -= fee;
            SafeERC20.safeTransfer(IERC20(token), feeArgs.payee, fee);
        }
        return amount;
    }

    function calculateFee(uint256 amount, uint16 dbps) public pure returns (uint256 fee) {
        unchecked {
            uint256 q = amount / 100000;
            uint256 r = amount % 100000;
            fee = q * dbps + (r * dbps) / 100000;
        }
    }

    function trimFee(INttManager nttManager, uint256 amount, uint16 toChain) internal view returns (uint256 newFee) {
        uint8 toDecimals = nttManager.getPeer(toChain).tokenDecimals;

        if (toDecimals == 0) {
            revert InvalidPeerDecimals();
        }

        uint8 fromDecimals = nttManager.tokenDecimals();
        TrimmedAmount trimmedAmount = amount.trim(fromDecimals, toDecimals);
        newFee = trimmedAmount.untrim(fromDecimals);
    }
}
