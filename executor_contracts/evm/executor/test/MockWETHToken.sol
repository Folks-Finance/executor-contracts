// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWETHToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address account, uint256 value) external {
        _mint(account, value);
    }

    function burn(address account, uint256 value) external {
        _burn(account, value);
    }

    function deposit() public payable {
        _update(address(0), msg.sender, msg.value);
    }
    function withdraw(uint wad) public {
        _update(msg.sender, address(0), wad);
        payable(msg.sender).transfer(wad);
    }
}
