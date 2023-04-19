// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/access/IControlCenter.sol";
import "./MarketCore.sol";
import "./MarketBuyNow.sol";
import "./MarketAuction.sol";

/**
 * @title Vietnamese Dong (VND) is a fiat-backed stablecoin launched by the Finentic.
 * @notice Only for who whitelisting (KYC)
 */

contract Marketplace is MarketBuyNow, MarketAuction, MarketCore {
    using Counters for Counters.Counter;

    enum PhygitalItemState {
        Sold,
        Delivered,
        Cancelled
    }

    struct PhygitalItem {
        PhygitalItemState state;
        uint256 nextUpdateDeadline;
    }

    event Invoice(
        address indexed buyer,
        address indexed seller,
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 costs
    );

    event PhygitalItemUpdated(
        address nftContract,
        uint256 tokenId,
        PhygitalItemState state,
        uint256 nextUpdateDeadline
    );

    /**
     * @notice Stores the current list price for each NFT.
     * @dev NFT contract address => token Id => ListPrice
     */
    mapping(address => mapping(uint256 => PhygitalItem)) public phygitalItem;

    constructor(
        IControlCenter _controlCenter,
        address _treasury
    ) MarketCore(_controlCenter, _treasury) {}

    /**
     * @notice Sets the list price for an NFT and escrows it in the market contract.
     * A 0 price is acceptable and valid price you can set, enabling a giveaway to the first collector that calls `buy`.
     * @dev If there is an offer for this amount or higher, that will be accepted instead of setting a buy price.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param isPhygital Is this NFT linked to a physical asset?
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param price The price at which someone could buy this NFT.
     */
    function listForBuyNow(
        address nftContract,
        uint256 tokenId,
        bool isPhygital,
        address paymentToken,
        uint256 price
    ) external whenNotPaused {
        require(isPaymentToken[paymentToken], "Marketplace: UNACCEPTED_TOKEN");
        IERC721(nftContract).safeTransferFrom(
            _msgSender(),
            address(this),
            tokenId
        );
        ItemBuyNow memory _itemBuyNow = ItemBuyNow(
            _msgSender(),
            address(0),
            isPhygital,
            paymentToken,
            price
        );
        _setItemForBuyNow(nftContract, tokenId, _itemBuyNow);
    }

    function buyNow(
        address nftContract,
        uint256 tokenId
    ) external whenNotPaused {
        ItemBuyNow memory _itemBuyNow = itemBuyNow[nftContract][tokenId];
        require(_itemBuyNow.buyer == address(0), "Marketplace: SOLD");
        IERC20 _paymentToken = IERC20(_itemBuyNow.paymentToken);
        _paymentToken.transferFrom(
            _msgSender(),
            address(this),
            _itemBuyNow.price
        );
        emit Invoice(
            _msgSender(),
            _itemBuyNow.seller,
            nftContract,
            tokenId,
            _itemBuyNow.paymentToken,
            _itemBuyNow.price
        );
        if (!_itemBuyNow.isPhygital) {
            return _takeOwnItemBuyNow(nftContract, tokenId);
        }
        itemBuyNow[nftContract][tokenId].buyer = _msgSender();
        uint256 nextUpdateDeadline = block.timestamp + deliveryDuration;
        phygitalItem[nftContract][tokenId] = PhygitalItem(
            PhygitalItemState.Sold,
            nextUpdateDeadline
        );
        emit Invoice(
            _msgSender(),
            _itemBuyNow.seller,
            nftContract,
            tokenId,
            _itemBuyNow.paymentToken,
            _itemBuyNow.price
        );
        emit PhygitalItemUpdated(
            nftContract,
            tokenId,
            PhygitalItemState.Sold,
            nextUpdateDeadline
        );
    }

    function confirmReceivedItemBuyNow(
        address nftContract,
        uint256 tokenId
    ) external {
        PhygitalItem memory _phygitalItem = phygitalItem[nftContract][tokenId];
        require(
            phygitalItem[nftContract][tokenId].state == PhygitalItemState.Sold,
            "Marketplace: UNSOLD"
        );
        require(
            _phygitalItem.nextUpdateDeadline > block.timestamp,
            "Marketplace: OVERDUE"
        );
        require(
            itemBuyNow[nftContract][tokenId].buyer == _msgSender(),
            "Marketplace: FORBIDDEN"
        );
        _takeOwnItemBuyNow(nftContract, tokenId);
        delete phygitalItem[nftContract][tokenId];
        emit PhygitalItemUpdated(
            nftContract,
            tokenId,
            PhygitalItemState.Delivered,
            0
        );
    }

    function cancelItemBuyNow(address nftContract, uint256 tokenId) external {
        ItemBuyNow memory _itemBuyNow = itemBuyNow[nftContract][tokenId];
        require(
            _itemBuyNow.buyer == _msgSender() ||
                _itemBuyNow.seller == _msgSender(),
            "Marketplace: FORBIDDEN"
        );
        require(
            phygitalItem[nftContract][tokenId].state == PhygitalItemState.Sold,
            "Marketplace: UNSOLD"
        );
        IERC20(_itemBuyNow.paymentToken).transfer(
            _itemBuyNow.buyer,
            _itemBuyNow.price
        );
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _itemBuyNow.seller,
            tokenId
        );
        _removeItemForBuyNow(nftContract, tokenId);
        delete phygitalItem[nftContract][tokenId];
        emit PhygitalItemUpdated(
            nftContract,
            tokenId,
            PhygitalItemState.Cancelled,
            0
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
    function updateItemForBuyNow(
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    ) external {
        ItemBuyNow memory _itemBuyNow = itemBuyNow[nftContract][tokenId];
        require(_itemBuyNow.seller == _msgSender(), "Marketplace: FORBIDDEN");
        _updateItemForBuyNow(nftContract, tokenId, paymentToken, price);
    }

    function cancelListItemForBuyNow(
        address nftContract,
        uint256 tokenId
    ) external {
        ItemBuyNow memory _itemBuyNow = itemBuyNow[nftContract][tokenId];
        require(_itemBuyNow.seller == _msgSender(), "Marketplace: FORBIDDEN");
        require(_itemBuyNow.buyer == address(0), "Marketplace: SOLD");
        _removeItemForAuction(nftContract, tokenId);
    }

    function _takeOwnItemBuyNow(address nftContract, uint256 tokenId) internal {
        ItemBuyNow memory _itemBuyNow = itemBuyNow[nftContract][tokenId];
        IERC20 _paymentToken = IERC20(_itemBuyNow.paymentToken);
        uint256 serviceFee = (_itemBuyNow.price * serviceFeePercent) /
            PERCENTAGE;
        _paymentToken.transfer(
            _itemBuyNow.seller,
            _itemBuyNow.price - serviceFee
        );
        _paymentToken.transfer(treasury, serviceFee);
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _msgSender(),
            tokenId
        );
        _removeItemForBuyNow(nftContract, tokenId);
    }

    /**
     * @notice Add the auction for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param isPhygital Is this NFT linked to a physical asset?
     * @param startTime The time at which this auction will accept new bids.
     * @param endTime The time at which this auction will not accept any new bids.
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param amount The price at which someone could buy this NFT.
     * @param gap The minimum price gap between two bids
     */
    function listForAuction(
        address nftContract,
        uint256 tokenId,
        bool isPhygital,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount,
        uint256 gap
    ) external whenNotPaused {
        require(isPaymentToken[paymentToken], "Marketplace: UNACCEPTED_TOKEN");
        ItemAuction memory _itemAuction = ItemAuction(
            _msgSender(),
            isPhygital,
            startTime,
            endTime,
            address(0),
            paymentToken,
            amount,
            gap
        );
        IERC721(nftContract).safeTransferFrom(
            _msgSender(),
            address(this),
            tokenId
        );
        _setItemForAuction(nftContract, tokenId, _itemAuction);
    }

    function biddingForAuction(
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external {
        ItemAuction memory _itemAuction = itemAuction[nftContract][tokenId];
        IERC20 _paymentToken = IERC20(_itemAuction.paymentToken);
        _paymentToken.transferFrom(_msgSender(), address(this), amount);
        if (_itemAuction.bidder != address(0)) {
            _paymentToken.transferFrom(
                address(this),
                _itemAuction.bidder,
                _itemAuction.amount
            );
        }
        _biddingForAuction(nftContract, tokenId, _msgSender(), amount);
    }

    function paymentProcessingItemAuction(
        address nftContract,
        uint256 tokenId
    ) external {
        ItemAuction memory _itemAuction = itemAuction[nftContract][tokenId];
        require(_itemAuction.bidder == _msgSender(), "Marketplace: FORBIDDEN");
        emit Invoice(
            _msgSender(),
            _itemAuction.seller,
            nftContract,
            tokenId,
            _itemAuction.paymentToken,
            _itemAuction.amount
        );
        if (!_itemAuction.isPhygital) {
            return _takeOwnItemAuction(nftContract, tokenId);
        }
        uint256 nextUpdateDeadline = block.timestamp + deliveryDuration;
        phygitalItem[nftContract][tokenId] = PhygitalItem(
            PhygitalItemState.Sold,
            nextUpdateDeadline
        );
        emit PhygitalItemUpdated(
            nftContract,
            tokenId,
            PhygitalItemState.Sold,
            nextUpdateDeadline
        );
    }

    function _takeOwnItemAuction(
        address nftContract,
        uint256 tokenId
    ) internal {
        ItemAuction memory _itemAuction = itemAuction[nftContract][tokenId];
        IERC20 _paymentToken = IERC20(_itemAuction.paymentToken);
        uint256 serviceFee = (_itemAuction.amount * serviceFeePercent) /
            PERCENTAGE;
        _paymentToken.transfer(
            _itemAuction.seller,
            _itemAuction.amount - serviceFee
        );
        _paymentToken.transfer(treasury, serviceFee);
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _msgSender(),
            tokenId
        );
        _removeItemForAuction(nftContract, tokenId);
    }

    function cancelItemAuction(address nftContract, uint256 tokenId) external {
        ItemAuction memory _itemAuction = itemAuction[nftContract][tokenId];
        require(
            _itemAuction.bidder == _msgSender() ||
                _itemAuction.seller == _msgSender(),
            "Marketplace: FORBIDDEN"
        );
        require(
            phygitalItem[nftContract][tokenId].state == PhygitalItemState.Sold,
            "Marketplace: UNSOLD"
        );
        IERC20(_itemAuction.paymentToken).transfer(
            _itemAuction.bidder,
            _itemAuction.amount
        );
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _itemAuction.seller,
            tokenId
        );
        _removeItemForAuction(nftContract, tokenId);
        delete phygitalItem[nftContract][tokenId];
        emit PhygitalItemUpdated(
            nftContract,
            tokenId,
            PhygitalItemState.Cancelled,
            0
        );
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
    function updateItemForAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount,
        uint256 gap
    ) external {
        ItemAuction storage _itemAuction = itemAuction[nftContract][tokenId];
        require(_itemAuction.seller == _msgSender(), "Marketplace: FORBIDDEN");
        _updateItemForAuction(
            nftContract,
            tokenId,
            startTime,
            endTime,
            paymentToken,
            amount,
            gap
        );
    }

    function cancelListItemForAuction(
        address nftContract,
        uint256 tokenId
    ) external {
        ItemAuction storage _itemAuction = itemAuction[nftContract][tokenId];
        require(_itemAuction.seller == _msgSender(), "Marketplace: FORBIDDEN");
        require(
            _itemAuction.startTime > block.timestamp,
            "Marketplace: AUCTION_STARTED"
        );
        _removeItemForAuction(nftContract, tokenId);
    }
}
