// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "native-token-transfers/evm/src/interfaces/INttManager.sol";
import "./IWETH.sol";

interface INttManagerWethUnwrap is INttManager {
    function weth() external returns (IWETH);
}
