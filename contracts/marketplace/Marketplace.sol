// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/access/IControlCenter.sol";
import "./MarketCore.sol";
import "./MarketItem.sol";

/**
 * @title Finentic Marketplace.
 */

contract Marketplace is MarketItem, MarketCore {
    using Counters for Counters.Counter;

    enum ShippingState {
        Cancelled,
        Sold,
        Delivered
    }

    struct ItemShipping {
        ShippingState state;
        uint256 nextUpdateDeadline;
    }

    event ShippingUpdated(
        address nftContract,
        uint256 tokenId,
        ShippingState state,
        uint256 nextUpdateDeadline
    );

    event Invoice(
        address nftContract,
        uint256 tokenId,
        address buyer,
        address seller,
        address paymentToken,
        uint256 costs
    );

    /**
     * @notice Stores the current shipping state for each NFT.
     * @dev NFT contract address => token Id => ItemShipping
     */
    mapping(address => mapping(uint256 => ItemShipping)) public itemShipping;

    constructor(
        IControlCenter _controlCenter,
        address _treasury
    ) MarketCore(_controlCenter, _treasury) {}

    /**
     * @notice Sets the fixed price for an NFT and escrows it in the market contract.
     * A 0 price is acceptable and valid price you can set, enabling a giveaway to the first collector that calls `buy`.
     * @dev If there is an offer for this amount or higher, that will be accepted instead of setting a buy price.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param isFixedPrice Is this NFT listing for fixed price?
     * @param isRequiredShipping Is this NFT required shipping?
     * @param startTime The time at which this auction will accept new bids.
     * @param endTime The time at which this auction will not accept any new bids.
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param amount The price at which someone could buy this NFT.
     */
    function listingItem(
        address nftContract,
        uint256 tokenId,
        bool isFixedPrice,
        bool isRequiredShipping,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount
    ) external whenNotPaused {
        require(
            isPaymentToken[paymentToken],
            "Marketplace: PAYMENT_UNACCEPTED"
        );
        IERC721(nftContract).safeTransferFrom(
            _msgSender(),
            address(this),
            tokenId
        );
        ItemListed memory _itemListed = ItemListed(
            _msgSender(),
            isFixedPrice,
            isRequiredShipping,
            startTime,
            endTime,
            address(0),
            paymentToken,
            amount
        );
        _listingItem(nftContract, tokenId, _itemListed);
    }

    function buyItemFixedPrice(
        address nftContract,
        uint256 tokenId
    ) external whenNotPaused {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        require(_itemListed.isFixedPrice, "Marketplace: AUCTION_ITEM");
        require(_itemListed.buyer == address(0), "Marketplace: SOLD");
        IERC20 _paymentToken = IERC20(_itemListed.paymentToken);
        _paymentToken.transferFrom(
            _msgSender(),
            address(this),
            _itemListed.amount
        );
        if (!_itemListed.isRequiredShipping) {
            return _takeOwnItem(nftContract, tokenId);
        }
        itemListed[nftContract][tokenId].buyer = _msgSender();
        uint256 nextUpdateDeadline = block.timestamp + deliveryDuration;
        itemShipping[nftContract][tokenId] = ItemShipping(
            ShippingState.Sold,
            nextUpdateDeadline
        );
        emit ShippingUpdated(
            nftContract,
            tokenId,
            ShippingState.Sold,
            nextUpdateDeadline
        );
    }

    function bidding(
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        require(!_itemListed.isFixedPrice, "Marketplace: FIXED_PRICE_ITEM");
        IERC20 _paymentToken = IERC20(_itemListed.paymentToken);
        _paymentToken.transferFrom(_msgSender(), address(this), amount);
        if (_itemListed.buyer != address(0)) {
            _paymentToken.transfer(_itemListed.buyer, _itemListed.amount);
        }
        _bidding(nftContract, tokenId, _msgSender(), amount);
    }

    function paymentProcessing(address nftContract, uint256 tokenId) external {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        require(_itemListed.buyer == _msgSender(), "Marketplace: FORBIDDEN");
        require(!_itemListed.isFixedPrice, "Marketplace: FIXED_PRICE_ITEM");
        if (!_itemListed.isRequiredShipping) {
            return _takeOwnItem(nftContract, tokenId);
        }
        uint256 nextUpdateDeadline = block.timestamp + deliveryDuration;
        itemShipping[nftContract][tokenId] = ItemShipping(
            ShippingState.Sold,
            nextUpdateDeadline
        );
        emit ShippingUpdated(
            nftContract,
            tokenId,
            ShippingState.Sold,
            nextUpdateDeadline
        );
    }

    function confirmReceivedItem(
        address nftContract,
        uint256 tokenId
    ) external {
        ItemShipping memory _itemShipping = itemShipping[nftContract][tokenId];
        require(
            _itemShipping.state == ShippingState.Sold,
            "Marketplace: UNSOLD"
        );
        require(
            _itemShipping.nextUpdateDeadline > block.timestamp,
            "Marketplace: OVERDUE"
        );
        require(
            itemListed[nftContract][tokenId].buyer == _msgSender(),
            "Marketplace: FORBIDDEN"
        );
        _takeOwnItem(nftContract, tokenId);
        delete itemShipping[nftContract][tokenId];
        emit ShippingUpdated(nftContract, tokenId, ShippingState.Delivered, 0);
    }

    /**
     * @notice Update the auction for an NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The id of the NFT.
     * @param startTime The time at which this auction will accept new bids.
     * @param endTime The time at which this auction will not accept any new bids.
     * @param paymentToken The address of the token payment contract for this NFT.
     * @param amount The price at which someone could buy this NFT.
     */
    function updateItemListed(
        address nftContract,
        uint256 tokenId,
        uint256 startTime,
        uint256 endTime,
        address paymentToken,
        uint256 amount
    ) external {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        require(_itemListed.seller == _msgSender(), "Marketplace: FORBIDDEN");
        require(_itemListed.buyer == address(0), "Marketplace: SOLD");
        require(
            isPaymentToken[paymentToken],
            "Marketplace: PAYMENT_UNACCEPTED"
        );
        _updateItemListed(
            nftContract,
            tokenId,
            startTime,
            endTime,
            paymentToken,
            amount
        );
    }

    function cancelItemDelivering(
        address nftContract,
        uint256 tokenId
    ) external {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        require(
            _itemListed.buyer == _msgSender() ||
                _itemListed.seller == _msgSender(),
            "Marketplace: FORBIDDEN"
        );
        require(
            itemShipping[nftContract][tokenId].state == ShippingState.Sold,
            "Marketplace: UNSOLD"
        );
        IERC20(_itemListed.paymentToken).transfer(
            _itemListed.buyer,
            _itemListed.amount
        );
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _itemListed.seller,
            tokenId
        );
        _removeItemListed(nftContract, tokenId);
        delete itemShipping[nftContract][tokenId];
        emit ShippingUpdated(nftContract, tokenId, ShippingState.Cancelled, 0);
    }

    function cancelListItem(address nftContract, uint256 tokenId) external {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        require(_itemListed.seller == _msgSender(), "Marketplace: FORBIDDEN");
        require(_itemListed.buyer == address(0), "Marketplace: SOLD");
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _itemListed.seller,
            tokenId
        );
        _removeItemListed(nftContract, tokenId);
    }

    function _takeOwnItem(address nftContract, uint256 tokenId) internal {
        ItemListed memory _itemListed = itemListed[nftContract][tokenId];
        IERC20 _paymentToken = IERC20(_itemListed.paymentToken);
        uint256 serviceFee = (_itemListed.amount * serviceFeePercent) /
            PERCENTAGE;
        _paymentToken.transfer(
            _itemListed.seller,
            _itemListed.amount - serviceFee
        );
        _paymentToken.transfer(treasury, serviceFee);
        IERC721(nftContract).safeTransferFrom(
            address(this),
            _msgSender(),
            tokenId
        );
        _removeItemListed(nftContract, tokenId);
    }
}
