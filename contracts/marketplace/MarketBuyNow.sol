// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

/**
 * @title Allows sellers to set a list price of their NFTs that may be accepted and instantly transferred to the buyer.
 * @notice NFTs with a list price set are escrowed in the market contract.
 */

abstract contract MarketBuyNow {
    /**
     * @notice Stores the list price details for a specific NFT.
     */
    struct ItemBuyNow {
        /**
         * @notice The current owner of this NFT which set a list price.
         */
        address seller;
        /**
         * @notice The new owner of this NFT which purchase.
         */
        address buyer;
        /**
         * @notice Is this NFT linked to a physical asset?
         */
        bool isPhygital;
        /**
         * @notice The address of the token payment contract for this NFT.
         */
        address paymentToken;
        /**
         * @notice The current buy price set for this NFT.
         * @dev A zero price is acceptable so a non-zero address determines whether a price has been set.
         */
        uint256 price;
    }

    /**
     * @notice Stores the current list price for each NFT.
     * @dev NFT contract address => token Id => ItemBuyNow
     */
    mapping(address => mapping(uint256 => ItemBuyNow)) public itemBuyNow;

    event ListForBuyNow(
        address nftContract,
        uint tokenId,
        address seller,
        bool isPhygital,
        address paymentToken,
        uint256 price
    );

    event UpdateItemForBuyNow(
        address nftContract,
        uint tokenId,
        address paymentToken,
        uint256 price
    );

    event RemoveItemForBuyNow(address nftContract, uint tokenId);

    /**
     * @notice Sets the list price for an NFT.
     * @dev A 0 price is acceptable and valid price you can set, enabling a giveaway to the first collector that calls `buy`.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param _itemBuyNow The ItemBuyNow struct of the NFT.
     */
    function _setItemForBuyNow(
        address nftContract,
        uint256 tokenId,
        ItemBuyNow memory _itemBuyNow
    ) internal {
        require(
            itemBuyNow[nftContract][tokenId].seller == address(0),
            "MarketBuyNow: ALREADY_EXIST"
        );
        itemBuyNow[nftContract][tokenId] = _itemBuyNow;
        emit ListForBuyNow(
            nftContract,
            tokenId,
            _itemBuyNow.seller,
            _itemBuyNow.isPhygital,
            _itemBuyNow.paymentToken,
            _itemBuyNow.price
        );
    }

    /**
     * @notice Update the list price for an NFT.
     * @dev A 0 price is acceptable and valid price you can set, enabling a giveaway to the first collector that calls `buy`.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param price The price at which someone could buy this NFT.
     */
    function _updateItemForBuyNow(
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    ) internal {
        ItemBuyNow storage _itemBuyNow = itemBuyNow[nftContract][tokenId];
        require(_itemBuyNow.buyer == address(0), "MarketBuyNow: SOLD");
        _itemBuyNow.paymentToken = paymentToken;
        _itemBuyNow.price = price;
        emit UpdateItemForBuyNow(nftContract, tokenId, paymentToken, price);
    }

    /**
     * @notice Remove the list price for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     */
    function _removeItemForBuyNow(
        address nftContract,
        uint256 tokenId
    ) internal {
        delete itemBuyNow[nftContract][tokenId];
        emit RemoveItemForBuyNow(nftContract, tokenId);
    }
}
