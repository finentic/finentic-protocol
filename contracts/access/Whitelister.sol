// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity ^0.8.0;

abstract contract Whitelister {
    mapping(address => bool) public whitelisting;

    event AddToWhitelist(address indexed account);
    event RemoveFromWhitelist(address indexed account);

    event AddMultiToWhitelist(address[] accounts);
    event RemoveMultiFromWhitelist(address[] accounts);

    function onlyWhitelisted(address account) external view {
        require(whitelisting[account], "Whitelist: NOT_WHITELISTED");
    }

    function _addToWhitelist(address account) internal virtual {
        whitelisting[account] = true;
        emit AddToWhitelist(account);
    }

    function _removeFromWhitelist(address account) internal virtual {
        whitelisting[account] = false;
        emit RemoveFromWhitelist(account);
    }

    function _addMultiToWhitelist(
        address[] calldata accounts
    ) internal virtual {
        uint accountsLength = accounts.length;
        require(accountsLength > 0, "Whitelist: EMPTY_ARRAY");
        for (uint i = 0; i < accountsLength; i++) {
            address account = accounts[i];
            whitelisting[account] = true;
        }
        emit AddMultiToWhitelist(accounts);
    }

    function _removeMultiFromWhitelist(
        address[] calldata accounts
    ) internal virtual {
        uint accountsLength = accounts.length;
        require(accountsLength > 0, "Whitelist: EMPTY_ARRAY");
        for (uint i = 0; i < accountsLength; i++) {
            address account = accounts[i];
            whitelisting[account] = false;
        }
        emit RemoveMultiFromWhitelist(accounts);
    }
}
