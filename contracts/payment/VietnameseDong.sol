// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/access/IControlCenter.sol";

/**
 * @title Vietnamese Dong (VND) is a fiat-backed stablecoin launched by the Finentic.
 * @notice Only for who whitelisting (KYC)
 */

contract VietnameseDong is ERC20, Pausable {
    IControlCenter public immutable controlCenter;

    constructor(IControlCenter _controlCenter) ERC20("Vietnamese Dong", "VND") {
        controlCenter = _controlCenter;
    }

    function mint(address account, uint amount) external {
        controlCenter.onlyTreasurer(_msgSender());
        _mint(account, amount);
    }

    function burn(address account, uint amount) external {
        controlCenter.onlyTreasurer(_msgSender());
        _burn(account, amount);
    }

    function pause() external {
        controlCenter.onlyModerator(_msgSender());
        _pause();
    }

    function unpause() external {
        controlCenter.onlyModerator(_msgSender());
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal view override whenNotPaused {
        controlCenter.notInBlacklisted(from);
        controlCenter.onlyWhitelisted(to);
    }
}
