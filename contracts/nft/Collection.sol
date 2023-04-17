// SPDX-License-Identifier: GPL-3.0
// Finentic Contracts (last updated v1.0)

pragma solidity 0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../interfaces/access/IControlCenter.sol";

/**
 * @title Finentic NFT Collection is a collection of NFTs by a single creator.
 * @notice All NFTs from this contract are minted by the same creator.
 * @dev A Collection NFT is the implementation template used byall collection contracts created with the Collection Factory.
 */

contract Collection is ERC721Upgradeable, PausableUpgradeable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    address public creator;
    string public baseURI;

    // Mapping from token identity to hashed metadata
    mapping(uint => bytes) public hashedMetadata;

    event BaseURIUpdated(string oldBaseURI, string newBaseURI);
    event ServiceFeeChange(uint oldServiceFee, uint newServiceFee);
    event RescuesTokenStuck(address token, uint amount);

    modifier onlyCreator() {
        require(creator == _msgSender(), "Collection: ONLY_CREATOR");
        _;
    }

    /**
     * @dev Initializes the contract after deployment via a minimal proxy
     */
    function initialize(
        address _creator,
        string calldata _name,
        string calldata _symbol,
        string calldata _newBaseURI
    ) external initializer {
        creator = _creator;
        __ERC721_init(_name, _symbol);
        baseURI = _newBaseURI;
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
    ) external onlyCreator returns (uint tokenId) {
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
    ) external onlyCreator returns (uint tokenId) {
        tokenId = _tokenIdCounter.current();
        _mint(to, tokenId);
        _approve(operator, tokenId);
        hashedMetadata[tokenId] = _hashedMetadata;
        _tokenIdCounter.increment();
    }

    /**
     * @notice Allows the creator to burn a specific token if they currently own the NFT.
     * @param tokenId The ID of the NFT to burn.
     */
    function burn(uint tokenId) external onlyCreator {
        require(_ownerOf(tokenId) == _msgSender(), "Collection: ONLY_OWNER");
        _burn(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function updateBaseURI(string calldata newBaseURI) external onlyCreator {
        emit BaseURIUpdated(baseURI, newBaseURI);
        baseURI = newBaseURI;
    }

}
