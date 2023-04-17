// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

interface IShared {
    function currentTokenId() external view returns (uint);

    function mint(
        address to,
        bytes calldata _hashedMetadata
    ) external returns (uint tokenId);

    function mintAndApprove(
        address to,
        address operator,
        bytes calldata _hashedMetadata
    ) external returns (uint tokenId);

    function burn(uint256 tokenId) external;

    function updateBaseURI(string calldata newBaseURI) external;

    function pause() external;

    function unpause() external;
}
