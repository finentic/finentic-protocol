// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity ^0.8.0;

interface IVietnameseDong {
    function controlCenter() external view returns (address);

    function mint(address account, uint amount) external;

    function burn(address account, uint amount) external;

    function pause() external;

    function unpause() external;
}
