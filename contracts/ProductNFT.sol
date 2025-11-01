// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProductNFT
 * @dev ERC-721 token representing unique products with metadata and transfer history
 */
contract ProductNFT is ERC721, ERC721URIStorage, Ownable {
    
    uint256 private _nextTokenId;

    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
        string transferType; // "manufacture", "supply_chain", "sale", "secondary_sale"
    }

    struct ProductInfo {
        uint256 tokenId;
        address producer;
        uint256 creationDate;
        string productType; // "physical" or "digital"
        uint256 warrantyPeriod; // in seconds
        bool isActive;
    }

    // Mapping from tokenId to ProductInfo
    mapping(uint256 => ProductInfo) public productInfo;
    
    // Mapping from tokenId to array of transfer records
    mapping(uint256 => TransferRecord[]) public transferHistory;

    // Authorized contract that can call restricted functions (SupplyChain contract)
    address public supplyChainContract;

    // Events
    event ProductCreated(uint256 indexed tokenId, address indexed producer, string metadataURI);
    event ProductTransferred(uint256 indexed tokenId, address indexed from, address indexed to, string transferType);
    event SupplyChainContractUpdated(address indexed newContract);

    constructor() ERC721("ProductOwnership", "PROD") Ownable(msg.sender) {
        _nextTokenId = 1; // Start token IDs from 1
    }

    /**
     * @dev Set the supply chain contract address (only owner)
     * @param _supplyChainContract Address of the SupplyChain contract
     */
    function setSupplyChainContract(address _supplyChainContract) external onlyOwner {
        require(_supplyChainContract != address(0), "Invalid contract address");
        supplyChainContract = _supplyChainContract;
        emit SupplyChainContractUpdated(_supplyChainContract);
    }

    /**
     * @dev Modifier to restrict functions to only SupplyChain contract
     */
    modifier onlySupplyChain() {
        require(msg.sender == supplyChainContract, "Only SupplyChain contract can call this");
        _;
    }

    /**
     * @dev Mint a new product NFT (called by SupplyChain contract)
     * @param _producer Address of the producer
     * @param _metadataURI IPFS URI containing product metadata
     * @param _productType Type of product (physical/digital)
     * @param _warrantyPeriod Warranty period in seconds
     * @return tokenId The ID of the newly minted token
     */
    function mintProduct(
        address _producer,
        string memory _metadataURI,
        string memory _productType,
        uint256 _warrantyPeriod
    ) external onlySupplyChain returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        
        _safeMint(_producer, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        productInfo[tokenId] = ProductInfo({
            tokenId: tokenId,
            producer: _producer,
            creationDate: block.timestamp,
            productType: _productType,
            warrantyPeriod: _warrantyPeriod,
            isActive: true
        });

        // Record initial creation in transfer history
        transferHistory[tokenId].push(TransferRecord({
            from: address(0),
            to: _producer,
            timestamp: block.timestamp,
            transferType: "manufacture"
        }));

        emit ProductCreated(tokenId, _producer, _metadataURI);

        return tokenId;
    }

    /**
     * @dev Record a transfer in the history (called by SupplyChain contract)
     * @param _tokenId ID of the token being transferred
     * @param _from Address transferring from
     * @param _to Address transferring to
     * @param _transferType Type of transfer
     */
    function recordTransfer(
        uint256 _tokenId,
        address _from,
        address _to,
        string memory _transferType
    ) external onlySupplyChain {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");

        transferHistory[_tokenId].push(TransferRecord({
            from: _from,
            to: _to,
            timestamp: block.timestamp,
            transferType: _transferType
        }));

        emit ProductTransferred(_tokenId, _from, _to, _transferType);
    }

    /**
     * @dev Execute the actual NFT transfer (called by SupplyChain contract)
     * @param _from Address transferring from
     * @param _to Address transferring to
     * @param _tokenId ID of the token to transfer
     */
    function executeTransfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) external onlySupplyChain {
        require(_ownerOf(_tokenId) == _from, "From address must be current owner");
        _transfer(_from, _to, _tokenId);
    }

    /**
     * @dev Get the complete transfer history of a product
     * @param _tokenId ID of the token
     * @return Array of TransferRecord structs
     */
    function getTransferHistory(uint256 _tokenId) external view returns (TransferRecord[] memory) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");
        return transferHistory[_tokenId];
    }

    /**
     * @dev Get product information
     * @param _tokenId ID of the token
     * @return ProductInfo struct
     */
    function getProductInfo(uint256 _tokenId) external view returns (ProductInfo memory) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");
        return productInfo[_tokenId];
    }

    /**
     * @dev Check if product warranty is still valid
     * @param _tokenId ID of the token
     * @return bool True if warranty is still valid
     */
    function isWarrantyValid(uint256 _tokenId) external view returns (bool) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");
        ProductInfo memory info = productInfo[_tokenId];
        return block.timestamp <= (info.creationDate + info.warrantyPeriod);
    }

    /**
     * @dev Get all tokens owned by an address
     * @param _owner Address to query
     * @return Array of token IDs
     */
    function getTokensByOwner(address _owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(_owner);
        uint256[] memory tokens = new uint256[](balance);
        uint256 currentIndex = 0;

        for (uint256 i = 1; i < _nextTokenId; i++) {
            if (_ownerOf(i) == _owner) {
                tokens[currentIndex] = i;
                currentIndex++;
                if (currentIndex == balance) break;
            }
        }

        return tokens;
    }

    /**
     * @dev Get next token ID
     * @return Next token ID to be minted
     */
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

