// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/access/IControlCenter.sol";

/**
 * @title Finentic Shared NFT (FxNFT) is a single contract allowing any creator to mint an NFT.
 */

contract Shared is ERC721, Pausable {
    using Counters for Counters.Counter;

    IControlCenter public immutable controlCenter;
    Counters.Counter private _tokenIdCounter;

    string public baseURI;

    // Mapping from token identity to hashed metadata
    mapping(uint => bytes) public hashedMetadata;

    event BaseURIUpdated(string oldBaseURI, string newBaseURI);

    constructor(
        IControlCenter _controlCenter
    ) ERC721("Finentic Shared NFT", "FxNFT") {
        controlCenter = _controlCenter;
    }

    function currentTokenId() external view returns (uint) {
        return _tokenIdCounter.current();
    }

    /**
     * @param to The owner of the NFT to mint.
     * @param _hashedMetadata The hashed (keccak256) of metadata
     * @return tokenId The tokenId of the newly minted NFT.
     */
    function mint(
        address to,
        bytes calldata _hashedMetadata
    ) external returns (uint tokenId) {
        controlCenter.notInBlacklisted(_msgSender());
        tokenId = _tokenIdCounter.current();
        _mint(to, tokenId);
        hashedMetadata[tokenId] = _hashedMetadata;
        _tokenIdCounter.increment();
    }

    /**
     * @notice Mint an NFT and approves the provided operator address.
     * @dev It can be used the first time they mint to save having to issue a separate approval transaction before listing the NFT for sale.
     * @param to The owner of the NFT to mint.
     * @param operator The address to set as an approved operator for the creator's account.
     * @param _hashedMetadata The hashed (keccak256) of metadata
     * @return tokenId The tokenId of the newly minted NFT.
     */
    function mintAndApprove(
        address to,
        address operator,
        bytes calldata _hashedMetadata
    ) external returns (uint tokenId) {
        controlCenter.notInBlacklisted(_msgSender());
        tokenId = _tokenIdCounter.current();
        _mint(to, tokenId);
        _approve(operator, tokenId);
        hashedMetadata[tokenId] = _hashedMetadata;
        _tokenIdCounter.increment();
    }

    /**
     * @notice Allows the owner to burn a specific token if they currently own the NFT.
     * @param tokenId The ID of the NFT to burn.
     */
    function burn(uint256 tokenId) external {
        require(_ownerOf(tokenId) == _msgSender(), "Shared: ONLY_OWNER");
        _burn(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function updateBaseURI(string calldata newBaseURI) external {
        controlCenter.onlyModerator(_msgSender());
        emit BaseURIUpdated(baseURI, newBaseURI);
        baseURI = newBaseURI;
    }

    function pause() external {
        controlCenter.onlyModerator(_msgSender());
        _pause();
    }

    function unpause() external {
        controlCenter.onlyModerator(_msgSender());
        _unpause();
    }

    /**
     * @dev Prevent blacklisting accounts transfer or own NFT.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256,
        uint256
    ) internal view override whenNotPaused {
        controlCenter.notInBlacklisted(from);
        controlCenter.notInBlacklisted(to);
    }
}
