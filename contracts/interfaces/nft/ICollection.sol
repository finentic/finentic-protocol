// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

/**
 * @title Finentic Collection NFT (FC-NFT) is a collection of NFTs by a single creator.
 * @notice All NFTs from this contract are minted by the same creator.
 * @dev A Collection NFT is the implementation template used byall collection contracts created with the Collection Factory.
 */

interface ICollection {
    function initialize(
        address _creator,
        string calldata _name,
        string calldata _symbol,
        string calldata _newBaseURI
    ) external;
}
