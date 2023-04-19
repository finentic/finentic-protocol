// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../access/ControlCenter.sol";

contract Treasury is Context {
    ControlCenter public immutable controlCenter;

    constructor(ControlCenter _controlCenter) {
        controlCenter = _controlCenter;
    }

    modifier onlyTreasurer() {
        controlCenter.onlyTreasurer(_msgSender());
        _;
    }

    receive() external payable {}

    function transferNative(
        address payable to,
        uint amount
    ) external onlyTreasurer {
        to.transfer(amount);
    }

    function transferERC20(
        IERC20 token,
        address to,
        uint amount
    ) external onlyTreasurer {
        token.transfer(to, amount);
    }

    function transferERC721(
        IERC721 token,
        uint tokenId,
        address from,
        address to
    ) external onlyTreasurer {
        token.safeTransferFrom(from, to, tokenId);
    }

    function approveERC20(
        IERC20 token,
        address spender,
        uint amount
    ) external onlyTreasurer {
        token.approve(spender, amount);
    }

    function approveERC721(
        IERC721 token,
        address spender,
        uint tokenId
    ) external onlyTreasurer {
        token.approve(spender, tokenId);
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
