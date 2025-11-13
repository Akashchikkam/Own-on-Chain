// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProductIdentifier
 * @dev Modular contract for blockchain-native product IDs
 * Independent module - can be used or removed without affecting other features
 */
contract ProductIdentifier {
    
    // SupplyChain contract address (set during deployment)
    address public supplyChainContract;
    
    struct BlockchainProductId {
        uint256 chainId;
        address contractAddress;  // SupplyChain contract address
        uint256 tokenId;
        address manufacturer;
        string productModel;
        string serialNumber;
    }
    
    // Mapping from tokenId to BlockchainProductId
    mapping(uint256 => BlockchainProductId) public productIds;
    
    // Mapping from manufacturer+model+serial to tokenId (for lookup)
    mapping(address => mapping(string => mapping(string => uint256))) public lookupByManufacturer;
    
    event ProductIdRegistered(
        uint256 indexed tokenId,
        address indexed manufacturer,
        string productModel,
        string serialNumber
    );
    
    constructor(address _supplyChainContract) {
        supplyChainContract = _supplyChainContract;
    }
    
    /**
     * @dev Register blockchain product ID (called when product is created)
     * @param _tokenId Token ID
     * @param _manufacturer Manufacturer address
     * @param _productModel Product model/SKU
     * @param _serialNumber Serial number
     */
    function registerProductId(
        uint256 _tokenId,
        address _manufacturer,
        string memory _productModel,
        string memory _serialNumber
    ) external {
        require(productIds[_tokenId].tokenId == 0, "Product ID already registered");
        
        productIds[_tokenId] = BlockchainProductId({
            chainId: block.chainid,
            contractAddress: supplyChainContract,  // Use SupplyChain contract address
            tokenId: _tokenId,
            manufacturer: _manufacturer,
            productModel: _productModel,
            serialNumber: _serialNumber
        });
        
        lookupByManufacturer[_manufacturer][_productModel][_serialNumber] = _tokenId;
        
        emit ProductIdRegistered(_tokenId, _manufacturer, _productModel, _serialNumber);
    }
    
    /**
     * @dev Get blockchain product ID as string
     * @param _tokenId Token ID
     * @return blockchainId Formatted blockchain ID string
     */
    function getBlockchainId(uint256 _tokenId) external view returns (string memory) {
        BlockchainProductId memory id = productIds[_tokenId];
        require(id.tokenId != 0, "Product ID not registered");
        
        return string(abi.encodePacked(
            _uintToString(id.chainId),
            ":",
            _addressToString(id.contractAddress),
            ":",
            _uintToString(id.tokenId),
            ":",
            _addressToString(id.manufacturer),
            ":",
            id.productModel,
            ":",
            id.serialNumber
        ));
    }
    
    /**
     * @dev Lookup token ID by manufacturer, model, and serial
     * @param _manufacturer Manufacturer address
     * @param _productModel Product model
     * @param _serialNumber Serial number
     * @return tokenId Token ID
     */
    function lookupTokenId(
        address _manufacturer,
        string memory _productModel,
        string memory _serialNumber
    ) external view returns (uint256) {
        uint256 tokenId = lookupByManufacturer[_manufacturer][_productModel][_serialNumber];
        require(tokenId != 0, "Product not found");
        return tokenId;
    }
    
    /**
     * @dev Get product ID details
     * @param _tokenId Token ID
     * @return id BlockchainProductId struct
     */
    function getProductIdDetails(uint256 _tokenId) external view returns (BlockchainProductId memory) {
        require(productIds[_tokenId].tokenId != 0, "Product ID not registered");
        return productIds[_tokenId];
    }
    
    // Helper functions
    function _uintToString(uint256 _i) private pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
    
    function _addressToString(address _addr) private pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }
}

