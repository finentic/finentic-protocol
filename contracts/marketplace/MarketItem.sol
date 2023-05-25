// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

/**
 * @title Allows the owner of an NFT to listed item.
 * @dev NFTs are escrowed in the market contract.
 */

abstract contract MarketItem {
    /**
     * @notice The listed configuration for a specific NFT.
     */
    struct ItemListed {
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
     * @dev NFT contract address => tokenId => ItemListed
     */
    mapping(address => mapping(uint256 => ItemListed)) public itemListed;

    event Listed(address nftContract, uint256 tokenId, ItemListed item);

    event Bidded(
        address nftContract,
        uint256 tokenId,
        address buyer,
        uint256 amount
    );

    event UpdateItemListed(
        address nftContract,
        uint256 tokenId,
        ItemListed item
    );

    event RemoveItemListed(address nftContract, uint256 tokenId);

    /**
     * @notice List an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param _item The ListPrice struct of the NFT.
     */
    function _listingItem(
        address nftContract,
        uint256 tokenId,
        ItemListed memory _item
    ) internal {
        require(_item.startTime > block.timestamp, "MarketListed: STARTED");
        require(
            (_item.startTime + 10 minutes) <= _item.endTime,
            "MarketListed: INVALID_END_TIME"
        );
        // require(_item.gap > 0, "MarketListed: GAP_ZERO");
        itemListed[nftContract][tokenId] = _item;
        emit Listed(nftContract, tokenId, _item);
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
        ItemListed storage _item = itemListed[nftContract][tokenId];

        require(_item.startTime < block.timestamp, "MarketListed: NOT_STARTED");
        require(_item.endTime > block.timestamp, "MarketListed: AUCTION_ENDED");
        require(
            // _item.amount + _item.gap <= amount,
            _item.amount < amount,
            "MarketListed: AMOUNT_TOO_LOW"
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
    function _updateItemListed(
        address nftContract,
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount
    ) internal {
        ItemListed storage _item = itemListed[nftContract][tokenId];

        if (!_item.isFixedPrice) {
            require(
                _item.startTime > block.timestamp ||
                    _item.endTime < block.timestamp,
                "MarketListed: LISTING"
            );
        }
        // require(gap > 0, "MarketListed: GAP_ZERO");

        _item.startTime = startTime;
        _item.endTime = endTime;
        _item.paymentToken = paymentToken;
        _item.amount = amount;

        emit UpdateItemListed(nftContract, tokenId, _item);
    }

    /**
     * @notice Remove an NFT listed.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     */
    function _removeItemListed(address nftContract, uint256 tokenId) internal {
        ItemListed storage _item = itemListed[nftContract][tokenId];
        if (!_item.isFixedPrice) {
            require(
                _item.startTime > block.timestamp ||
                    _item.endTime < block.timestamp,
                "MarketListed: LISTING"
            );
        }
        delete itemListed[nftContract][tokenId];
        emit RemoveItemListed(nftContract, tokenId);
    }
}
