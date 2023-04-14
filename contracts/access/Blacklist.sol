// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity ^0.8.0;

abstract contract Blacklist {
    mapping(address => bool) public blacklisting;

    event AddToBlacklist(address indexed account);
    event RemoveFromBlacklist(address indexed account);

    event AddMultiToBlacklist(address[] accounts);
    event RemoveMultiFromBlacklist(address[] accounts);

    function notInBlacklisted(address account) external view {
        require(!blacklisting[account], "Blacklist: BLACKLISTED");
    }

    function _addToBlacklist(address account) internal virtual {
        blacklisting[account] = true;
        emit AddToBlacklist(account);
    }

    function _removeFromBlacklist(address account) internal virtual {
        blacklisting[account] = false;
        emit RemoveFromBlacklist(account);
    }

    function _addMultiToBlacklist(address[] calldata accounts) internal virtual {
        uint accountsLength = accounts.length;
        require(accountsLength > 0, "Blacklist: EMPTY_ARRAY");
        for (uint i = 0; i < accountsLength; i++) {
            address account = accounts[i];
            blacklisting[account] = true;
        }
        emit AddMultiToBlacklist(accounts);
    }

    function _removeMultiFromBlacklist(address[] calldata accounts) internal virtual {
        uint accountsLength = accounts.length;
        require(accountsLength > 0, "Blacklist: EMPTY_ARRAY");
        for (uint i = 0; i < accountsLength; i++) {
            address account = accounts[i];
            blacklisting[account] = false;
        }
        emit RemoveMultiFromBlacklist(accounts);
    }
}
