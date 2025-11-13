// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GtinLinker
 * @dev Modular contract for linking GS1/GTIN to products
 * Independent module - can be used or removed without affecting other features
 */
contract GtinLinker {
    
    // GTIN to Token ID mapping
    mapping(string => uint256) public gtinToTokenId;
    
    // Token ID to GTIN mapping
    mapping(uint256 => string) public tokenIdToGtin;
    
    // Interface to check if caller is product producer
    // This will be set to SupplyChain contract address
    address public supplyChainContract;
    
    // Interface to get product producer
    // This will be set to SupplyChain contract address
    address public productRegistry;
    
    event GtinLinked(uint256 indexed tokenId, string indexed gtin);
    event GtinUnlinked(uint256 indexed tokenId, string indexed gtin);
    
    constructor(address _supplyChainContract, address _productRegistry) {
        supplyChainContract = _supplyChainContract;
        productRegistry = _productRegistry;
    }
    
    /**
     * @dev Link GTIN to product (only producer can call)
     * @param _tokenId Token ID
     * @param _gtin GS1/GTIN identifier (8-14 digits)
     */
    function linkGtin(uint256 _tokenId, string memory _gtin) external {
        require(_isProducer(_tokenId, msg.sender), "Only producer can link GTIN");
        require(_validateGtin(_gtin), "Invalid GTIN format");
        require(gtinToTokenId[_gtin] == 0, "GTIN already linked");
        require(bytes(tokenIdToGtin[_tokenId]).length == 0, "Product already has GTIN");
        
        gtinToTokenId[_gtin] = _tokenId;
        tokenIdToGtin[_tokenId] = _gtin;
        
        emit GtinLinked(_tokenId, _gtin);
    }
    
    /**
     * @dev Batch link GTINs (only producer can call)
     * @param _tokenIds Array of token IDs
     * @param _gtins Array of GTINs
     */
    function batchLinkGtin(
        uint256[] memory _tokenIds,
        string[] memory _gtins
    ) external {
        require(_tokenIds.length == _gtins.length, "Arrays length mismatch");
        require(_tokenIds.length > 0, "Empty arrays");
        require(_tokenIds.length <= 500, "Too many items (max 500)");
        
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            require(_isProducer(_tokenIds[i], msg.sender), "Only producer can link GTIN");
            require(_validateGtin(_gtins[i]), "Invalid GTIN format");
            require(gtinToTokenId[_gtins[i]] == 0, "GTIN already linked");
            require(bytes(tokenIdToGtin[_tokenIds[i]]).length == 0, "Product already has GTIN");
            
            gtinToTokenId[_gtins[i]] = _tokenIds[i];
            tokenIdToGtin[_tokenIds[i]] = _gtins[i];
            
            emit GtinLinked(_tokenIds[i], _gtins[i]);
        }
    }
    
    /**
     * @dev Unlink GTIN from product (only producer can call)
     * @param _tokenId Token ID
     */
    function unlinkGtin(uint256 _tokenId) external {
        require(_isProducer(_tokenId, msg.sender), "Only producer can unlink GTIN");
        string memory gtin = tokenIdToGtin[_tokenId];
        require(bytes(gtin).length > 0, "Product has no GTIN");
        
        delete gtinToTokenId[gtin];
        delete tokenIdToGtin[_tokenId];
        
        emit GtinUnlinked(_tokenId, gtin);
    }
    
    /**
     * @dev Get token ID by GTIN
     * @param _gtin GS1/GTIN identifier
     * @return tokenId Token ID
     */
    function getTokenIdByGtin(string memory _gtin) external view returns (uint256) {
        uint256 tokenId = gtinToTokenId[_gtin];
        require(tokenId != 0, "GTIN not linked");
        return tokenId;
    }
    
    /**
     * @dev Get GTIN by token ID
     * @param _tokenId Token ID
     * @return gtin GTIN string
     */
    function getGtinByTokenId(uint256 _tokenId) external view returns (string memory) {
        return tokenIdToGtin[_tokenId];
    }
    
    /**
     * @dev Check if GTIN is linked
     * @param _gtin GS1/GTIN identifier
     * @return isLinked True if linked
     * @return tokenId Token ID if linked
     */
    function isGtinLinked(string memory _gtin) external view returns (bool isLinked, uint256 tokenId) {
        tokenId = gtinToTokenId[_gtin];
        isLinked = tokenId != 0;
    }
    
    /**
     * @dev Validate GTIN format (8-14 digits, numeric)
     * @param _gtin GTIN string
     * @return valid True if valid format
     */
    function _validateGtin(string memory _gtin) private pure returns (bool) {
        bytes memory gtinBytes = bytes(_gtin);
        if (gtinBytes.length < 8 || gtinBytes.length > 14) {
            return false;
        }
        
        for (uint256 i = 0; i < gtinBytes.length; i++) {
            if (gtinBytes[i] < 0x30 || gtinBytes[i] > 0x39) {
                return false; // Not a digit
            }
        }
        
        return true;
    }
    
    /**
     * @dev Check if address is producer of product
     * Calls SupplyChain contract to verify producer
     * @param _tokenId Token ID
     * @param _address Address to check
     * @return isProducer True if address is producer
     */
    function _isProducer(uint256 _tokenId, address _address) private view returns (bool) {
        // Call SupplyChain.products(tokenId) to get product struct
        // Then check if producer matches
        (bool success, bytes memory data) = supplyChainContract.staticcall(
            abi.encodeWithSignature("products(uint256)", _tokenId)
        );
        
        if (!success || data.length == 0) return false;
        
        // Decode product struct (tokenId, currentOwner, status, producer, ...)
        // Producer is at index 3 in the struct
        // We'll use a simpler approach: call a helper function on SupplyChain
        (bool producerCheck, bytes memory producerData) = supplyChainContract.staticcall(
            abi.encodeWithSignature("getProductProducer(uint256)", _tokenId)
        );
        
        if (!producerCheck || producerData.length == 0) {
            // Fallback: try to decode products() directly
            // Product struct: (uint256 tokenId, address currentOwner, uint8 status, address producer, ...)
            // Skip first 3 fields (96 bytes) to get producer (address = 20 bytes)
            if (data.length >= 128) {
                address decodedProducer;
                assembly {
                    decodedProducer := mload(add(data, 128)) // Skip tokenId (32) + currentOwner (32) + status (32) + padding (32)
                }
                return decodedProducer == _address;
            }
            return false;
        }
        
        address productProducer = abi.decode(producerData, (address));
        return productProducer == _address;
    }
}

