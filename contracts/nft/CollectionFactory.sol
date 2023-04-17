// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/access/IControlCenter.sol";
import "../interfaces/nft/ICollection.sol";

/**
 * @title A factory to create NFT collections.
 * @notice Call this factory to create NFT collections.
 * @dev This creates and initializes an ERC-1167 minimal proxy pointing to an NFT collection contract implementation.
 */

contract CollectionFactory is Pausable {
    IControlCenter public immutable controlCenter;
    address public immutable collectionImplementation;

    /**
     * @notice Emitted when a new Collection is created from this factory.
     * @param collection The address of the new NFT collection contract.
     * @param creator The address of the creator which owns the new collection.
     * @param name The name of the collection contract created.
     * @param symbol The symbol of the collection contract created.
     */
    event CollectionCreated(
        address indexed collection,
        address indexed creator,
        string name,
        string symbol
    );

    constructor(
        IControlCenter _controlCenter,
        address _collectionImplementation
    ) {
        controlCenter = _controlCenter;
        collectionImplementation = _collectionImplementation;
    }

    /**
     * @notice Create a new collection contract.
     * @param name The collection's `name`.
     * @param symbol The collection's `symbol`.
     * @param baseURI The base URI for the collection.
     * @return collection The address of the newly created collection contract.
     */
    function createCollection(
        address creator,
        string calldata name,
        string calldata symbol,
        string calldata baseURI
    ) external whenNotPaused returns (address collection) {
        require(bytes(symbol).length != 0, "CollectionFactory: EMPTY_SYMBOL");

        // taken from https://solidity-by-example.org/app/minimal-proxy/
        bytes20 targetBytes = bytes20(collectionImplementation);
        assembly {
            let clone := mload(0x40)
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            mstore(add(clone, 0x14), targetBytes)
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            collection := create(0, clone, 0x37)
        }
        ICollection(collection).initialize(creator, name, symbol, baseURI);

        emit CollectionCreated(collection, creator, name, symbol);
    }

    function pause() external {
        controlCenter.onlyModerator(_msgSender());
        _pause();
    }

    function unpause() external {
        controlCenter.onlyModerator(_msgSender());
        _unpause();
    }
}
