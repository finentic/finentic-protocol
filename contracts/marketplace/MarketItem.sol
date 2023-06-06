// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

/**
 * @title Allows the owner of an NFT to listed item.
 * @dev NFTs are escrowed in the market contract.
 */

abstract contract MarketItem {
    /**
     * @notice The listing configuration for a specific NFT.
     */
    struct ItemListing {
        /**
         * @notice The owner of the NFT which listed it in auction.
         */
        address seller;
        /**
         * @notice Is this NFT listing for fixed price?
         */
        bool isFixedPrice;
        /**
         * @notice Is this NFT required shipping?
         */
        bool isRequiredShipping;
        /**
         * @notice The time at which this auction will accept new bids.
         */
        uint256 startTime;
        /**
         * @notice The time at which this auction will not accept any new bids.
         * @dev This is `0` until the first bid is placed.
         */
        uint256 endTime;
        /**
         * @notice The current highest bidder in this auction.
         * @dev This is `address(0)` until the first bid is placed.
         */
        address buyer;
        /**
         * @notice The address of the token payment contract for this NFT.
         */
        address paymentToken;
        /**
         * @notice The latest price of the NFT in this auction.
         * @dev This is set to the starting price, and then to the lowest bid once the auction has started.
         * If there is does not receive any bids greater than starting price, the auction will end without a sale.
         */
        uint256 amount;
        /**
         * @notice The minimum price gap between two bids
         * @dev Must greater than 1. The next highest bid >= highest bid + gap.
         */
        // uint256 gap;
    }

    /**
     * @notice Stores the auction for each NFT.
     * @dev NFT contract address => tokenId => ItemListing
     */
    mapping(address => mapping(uint256 => ItemListing)) public itemListing;

    event Listing(address nftContract, uint256 tokenId, ItemListing item);

    event Bidded(
        address nftContract,
        uint256 tokenId,
        address buyer,
        uint256 amount
    );

    event UpdateItemListing(
        address nftContract,
        uint256 tokenId,
        ItemListing item
    );

    event RemoveItemListing(address nftContract, uint256 tokenId);

    /**
     * @notice List an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param _item The ListPrice struct of the NFT.
     */
    function _listingItem(
        address nftContract,
        uint256 tokenId,
        ItemListing memory _item
    ) internal {
        require(_item.startTime > block.timestamp, "MarketItem: STARTED");
        require(
            (_item.startTime + 10 minutes) <= _item.endTime,
            "MarketItem: INVALID_END_TIME"
        );
        // require(_item.gap > 0, "MarketItem: GAP_ZERO");
        itemListing[nftContract][tokenId] = _item;
        emit Listing(nftContract, tokenId, _item);
    }

    /**
     * @notice Update the auction for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param buyer Who bid for this NFT.
     * @param amount The price at which bidder offering for this NFT.
     */
    function _bidding(
        address nftContract,
        uint256 tokenId,
        address buyer,
        uint256 amount
    ) internal {
        ItemListing storage _item = itemListing[nftContract][tokenId];

        require(_item.startTime < block.timestamp, "MarketItem: NOT_STARTED");
        require(_item.endTime > block.timestamp, "MarketItem: AUCTION_ENDED");
        require(
            // _item.amount + _item.gap <= amount,
            _item.amount < amount,
            "MarketItem: AMOUNT_TOO_LOW"
        );

        _item.buyer = buyer;
        _item.amount = amount;

        emit Bidded(nftContract, tokenId, buyer, amount);
    }

    /**
     * @notice Update for an NFT listed.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param startTime The time at which this auction will accept new bids.
     * @param endTime The time at which this auction will not accept any new bids.
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param amount The price at which someone could buy this NFT.
     */
    function _updateItemListing(
        address nftContract,
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount
    ) internal {
        ItemListing storage _item = itemListing[nftContract][tokenId];

        if (!_item.isFixedPrice) {
            require(
                block.timestamp < _item.startTime ||
                    block.timestamp > _item.endTime,
                "MarketItem: LISTING"
            );
        }
        // require(gap > 0, "MarketItem: GAP_ZERO");

        _item.startTime = startTime;
        _item.endTime = endTime;
        _item.paymentToken = paymentToken;
        _item.amount = amount;

        emit UpdateItemListing(nftContract, tokenId, _item);
    }

    /**
     * @notice Remove an NFT listed.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     */
    function _removeItemListing(address nftContract, uint256 tokenId) internal {
        ItemListing storage _item = itemListing[nftContract][tokenId];
        if (!_item.isFixedPrice) {
            require(
                block.timestamp < _item.startTime ||
                    block.timestamp > _item.endTime,
                "MarketItem: LISTING"
            );
        }
        delete itemListing[nftContract][tokenId];
        emit RemoveItemListing(nftContract, tokenId);
    }
}
