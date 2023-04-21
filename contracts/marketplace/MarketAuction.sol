// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

/**
 * @title Allows the owner of an NFT to list it in auction.
 * @dev NFTs in auction are escrowed in the market contract.
 */

abstract contract MarketAuction {
    /**
     * @notice The auction configuration for a specific NFT.
     */
    struct ItemAuction {
        /**
         * @notice The owner of the NFT which listed it in auction.
         */
        address seller;
        /**
         * @notice Is this NFT linked to a physical asset?
         */
        bool isPhygital;
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
        address bidder;
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
        uint256 gap;
    }

    /**
     * @notice Stores the auction for each NFT.
     * @dev NFT contract address => token Id => ItemAuction
     */
    mapping(address => mapping(uint256 => ItemAuction)) public itemAuction;

    event ListForAuction(
        address nftContract,
        uint256 tokenId,
        ItemAuction _itemAuction
    );

    event BiddingForAuction(
        address nftContract,
        uint256 tokenId,
        address bidder,
        uint256 amount
    );

    event UpdateItemForAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount,
        uint256 gap
    );

    event RemoveItemForAuction(address nftContract, uint256 tokenId);

    /**
     * @notice Sets the auction for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param _itemAuction The ListPrice struct of the NFT.
     */
    function _setItemForAuction(
        address nftContract,
        uint256 tokenId,
        ItemAuction memory _itemAuction
    ) internal {
        require(
            _itemAuction.startTime > block.timestamp,
            "MarketAuction: AUCTION_STARTED"
        );
        require(
            (_itemAuction.startTime + 1 hours) < _itemAuction.endTime,
            "MarketAuction: INVALID_END_TIME"
        );
        require(_itemAuction.gap > 0, "MarketAuction: GAP_ZERO");
        itemAuction[nftContract][tokenId] = _itemAuction;
        emit ListForAuction(nftContract, tokenId, _itemAuction);
    }

    function _biddingForAuction(
        address nftContract,
        uint256 tokenId,
        address bidder,
        uint256 amount
    ) internal {
        ItemAuction memory _itemAuction = itemAuction[nftContract][tokenId];
        require(
            _itemAuction.startTime < block.timestamp,
            "MarketAuction: NOT_STARTED"
        );
        require(
            _itemAuction.endTime > block.timestamp,
            "MarketAuction: AUCTION_ENDED"
        );
        require(
            _itemAuction.amount + _itemAuction.gap <= amount,
            "MarketAuction: AMOUNT_TOO_LOW"
        );

        itemAuction[nftContract][tokenId].bidder = bidder;
        itemAuction[nftContract][tokenId].amount = amount;

        emit BiddingForAuction(nftContract, tokenId, bidder, amount);
    }

    /**
     * @notice Update the auction for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param startTime The time at which this auction will accept new bids.
     * @param endTime The time at which this auction will not accept any new bids.
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param amount The price at which someone could buy this NFT.
     * @param gap The minimum price gap between two bids
     */
    function _updateItemForAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount,
        uint256 gap
    ) internal {
        ItemAuction storage _itemAuction = itemAuction[nftContract][tokenId];
        require(gap > 0, "MarketAuction: GAP_ZERO");
        _itemAuction.startTime = startTime;
        _itemAuction.endTime = endTime;
        _itemAuction.paymentToken = paymentToken;
        _itemAuction.amount = amount;
        _itemAuction.gap = gap;
        emit UpdateItemForAuction(
            nftContract,
            tokenId,
            startTime,
            endTime,
            paymentToken,
            amount,
            gap
        );
    }

    /**
     * @notice Remove the auction for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     */
    function _removeItemForAuction(
        address nftContract,
        uint256 tokenId
    ) internal {
        ItemAuction storage _itemAuction = itemAuction[nftContract][tokenId];
        require(
            _itemAuction.startTime > block.timestamp ||
                _itemAuction.endTime < block.timestamp,
            "MarketAuction: AUCTION_ACTIVE"
        );
        delete itemAuction[nftContract][tokenId];
        emit RemoveItemForAuction(nftContract, tokenId);
    }
}
