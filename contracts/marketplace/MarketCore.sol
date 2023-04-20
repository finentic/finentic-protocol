// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/access/IControlCenter.sol";

/**
 * @title A place for common modifiers and functions used by various Markets, if any.
 * @dev This also leaves a gap which can be used to add a new Market to the top of the inheritance tree.
 */
abstract contract MarketCore is Pausable {
    IControlCenter public immutable controlCenter;
    address public immutable treasury;
    uint public constant PERCENTAGE = 10000; // x100 percent precision (100.00%)
    uint public serviceFeePercent;
    // uint public reimbursementFeePercent;
    uint public deliveryDuration;

    mapping(address => bool) public isPaymentToken;

    event RescuesTokenStuck(address token, uint256 amount);
    event UpdatePaymentToken(address token, bool isAllowed);
    event UpdateReimbursementFee(uint oldFee, uint newFee);
    event UpdateServiceFeePercent(uint oldFee, uint newFee);
    event UpdateDeliveryDuration(uint oldDuration, uint newDuration);

    constructor(IControlCenter _controlCenter, address _treasury) {
        controlCenter = _controlCenter;
        treasury = _treasury;
        serviceFeePercent = 1; // 0.01%
        // reimbursementFeePercent = 500; // 5.00%
        deliveryDuration = 2 weeks;
    }

    modifier onlyModerator() {
        controlCenter.onlyModerator(_msgSender());
        _;
    }

    modifier onlyTreasurer() {
        controlCenter.onlyTreasurer(_msgSender());
        _;
    }

    function updatePaymentToken(
        address token,
        bool isAllowed
    ) external onlyTreasurer {
        isPaymentToken[token] = isAllowed;
        emit UpdatePaymentToken(token, isAllowed);
    }

    function updateServiceFeePercent(uint percent) external onlyTreasurer {
        require(percent < PERCENTAGE, "MarketCore: FEE_TOO_HIGH");
        emit UpdateServiceFeePercent(serviceFeePercent, percent);
        serviceFeePercent = percent;
    }

    // function setReimbursementFeePercent(uint percent) external onlyTreasurer {
    //     emit UpdateReimbursementFee(reimbursementFeePercent, percent);
    //     reimbursementFeePercent = percent;
    // }

    function updateDeliveryDuration(uint newDuration) external onlyModerator {
        emit UpdateDeliveryDuration(deliveryDuration, newDuration);
        deliveryDuration = newDuration;
    }

    function pause() public onlyModerator {
        _pause();
    }

    function unpause() external onlyModerator {
        _unpause();
    }

    /**
     * @dev Rescue random funds stuck can't handle.
     * @param token address of the token to rescue.
     */
    function inCaseTokensGetStuck(address token) external onlyTreasurer {
        require(!isPaymentToken[token], "MarketCore: STUCK_TOKEN_ONLY");
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(treasury, amount);
        emit RescuesTokenStuck(token, amount);
    }

    // Confirmation required for receiving ERC721 to smart contract
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
