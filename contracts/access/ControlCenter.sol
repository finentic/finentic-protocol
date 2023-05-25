// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./Blacklister.sol";
import "./Whitelister.sol";

contract ControlCenter is AccessControl, Blacklister, Whitelister {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(OPERATOR_ROLE, _msgSender());
        _setupRole(TREASURER_ROLE, _msgSender());
        _setupRole(MODERATOR_ROLE, _msgSender());
        _addToWhitelist(_msgSender());
        _addToWhitelist(address(0));
    }

    function setRoleAdmin(
        bytes32 role,
        bytes32 adminRole
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRoleAdmin(role, adminRole);
    }

    function onlyOperator(address account) external view {
        require(hasRole(OPERATOR_ROLE, account), "ControlCenter: OPERATOR_ONLY");
    }

    function onlyTreasurer(address account) external view {
        require(
            hasRole(TREASURER_ROLE, account),
            "ControlCenter: TREASURER_ONLY"
        );
    }

    function onlyModerator(address account) external view {
        require(
            hasRole(MODERATOR_ROLE, account),
            "ControlCenter: MODERATOR_ONLY"
        );
    }

    /*
    //////////////////////
      WHITELIST FUNTIONS  
    //////////////////////
    */

    function addToWhitelist(address account) external onlyRole(MODERATOR_ROLE) {
        _addToWhitelist(account);
    }

    function removeFromWhitelist(
        address account
    ) external onlyRole(MODERATOR_ROLE) {
        _removeFromWhitelist(account);
    }

    function addMultiToWhitelist(
        address[] calldata accounts
    ) external onlyRole(MODERATOR_ROLE) {
        _addMultiToWhitelist(accounts);
    }

    function removeMultiFromWhitelist(
        address[] calldata accounts
    ) external onlyRole(MODERATOR_ROLE) {
        _removeMultiFromWhitelist(accounts);
    }

    /*
    //////////////////////
      BLACKLIST FUNTIONS  
    //////////////////////
    */

    function addToBlacklist(address account) external onlyRole(MODERATOR_ROLE) {
        _removeFromWhitelist(account);
        _addToBlacklist(account);
    }

    function removeFromBlacklist(
        address account
    ) external onlyRole(MODERATOR_ROLE) {
        _removeFromBlacklist(account);
    }

    function addMultiToBlacklist(
        address[] calldata accounts
    ) external onlyRole(MODERATOR_ROLE) {
        _removeMultiFromWhitelist(accounts);
        _addMultiToBlacklist(accounts);
    }

    function removeMultiFromBlacklist(
        address[] calldata accounts
    ) external onlyRole(MODERATOR_ROLE) {
        _removeMultiFromBlacklist(accounts);
    }
}
