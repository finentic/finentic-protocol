// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity ^0.8.0;

interface IControlCenter {
    function onlyOperator(address account) external view;

    function onlyTreasurer(address account) external view;

    function onlyModerator(address account) external view;

    /*
    //////////////////////
      WHITELIST FUNTIONS  
    //////////////////////
    */

    function whitelisting(address account) external view returns (bool);

    function onlyWhitelisted(address account) external view;

    function addToWhitelist(address account) external;

    function removeFromWhitelist(address account) external;

    function addMultiToWhitelist(address[] calldata accounts) external;

    function removeMultiFromWhitelist(address[] calldata accounts) external;

    /*
    //////////////////////
      BLACKLIST FUNTIONS  
    //////////////////////
    */

    function blacklisting(address account) external view returns (bool);

    function notInBlacklisted(address account) external view;

    function addToBlacklist(address account) external;

    function removeFromBlacklist(address account) external;

    function addMultiToBlacklist(address[] calldata accounts) external;

    function removeMultiFromBlacklist(address[] calldata accounts) external;
}
