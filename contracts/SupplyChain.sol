// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ParticipantRegistry.sol";
import "./ProductNFT.sol";

/**
 * @title SupplyChain
 * @dev Main contract orchestrating product lifecycle and supply chain management
 */
contract SupplyChain {
    
    ParticipantRegistry public participantRegistry;
    ProductNFT public productNFT;
    
    // Optional modules (can be address(0) if not used)
    address public productIdentifier;  // Blockchain ID module
    address public gtinLinker;         // GTIN linking module

    enum ProductStatus {
        MANUFACTURED,
        WITH_DISTRIBUTOR,
        WITH_RETAILER,
        SOLD_TO_BUYER,
        RESOLD
    }

    struct Product {
        uint256 tokenId;
        address currentOwner;
        ProductStatus status;
        address producer;
        address distributor;
        address retailer;
        address buyer;
        uint256 manufactureDate;
        uint256 saleDate;
        string saleDetails; // IPFS hash of sale receipt/details
    }

    // Mapping from tokenId to Product
    mapping(uint256 => Product) public products;

    // Events
    event ProductManufactured(uint256 indexed tokenId, address indexed producer, string metadataURI);
    event ProductTransferredToDistributor(uint256 indexed tokenId, address indexed distributor);
    event ProductTransferredToRetailer(uint256 indexed tokenId, address indexed retailer);
    event ProductSoldToBuyer(uint256 indexed tokenId, address indexed buyer, string saleDetails);
    event ProductResold(uint256 indexed tokenId, address indexed from, address indexed to);

    constructor(
        address _participantRegistry, 
        address _productNFT,
        address _productIdentifier,  // Optional: Blockchain ID module
        address _gtinLinker          // Optional: GTIN linking module
    ) {
        require(_participantRegistry != address(0), "Invalid ParticipantRegistry address");
        require(_productNFT != address(0), "Invalid ProductNFT address");
        
        participantRegistry = ParticipantRegistry(_participantRegistry);
        productNFT = ProductNFT(_productNFT);
        productIdentifier = _productIdentifier;
        gtinLinker = _gtinLinker;
    }
    
    /**
     * @dev Set product identifier module (only owner or can be set during deployment)
     */
    function setProductIdentifier(address _productIdentifier) external {
        // In production, add onlyOwner modifier
        productIdentifier = _productIdentifier;
    }
    
    /**
     * @dev Set GTIN linker module (only owner or can be set during deployment)
     */
    function setGtinLinker(address _gtinLinker) external {
        // In production, add onlyOwner modifier
        gtinLinker = _gtinLinker;
    }

    /**
     * @dev Modifier to check if caller has a specific role
     */
    modifier onlyRole(ParticipantRegistry.Role _role) {
        require(
            participantRegistry.hasRole(msg.sender, _role),
            "Unauthorized: Invalid role or not verified"
        );
        _;
    }

    /**
     * @dev Modifier to check if caller is a verified participant (any role)
     */
    modifier onlyVerified() {
        require(
            participantRegistry.isVerifiedParticipant(msg.sender),
            "Unauthorized: Not a verified participant"
        );
        _;
    }

    /**
     * @dev Create a new product (only producers can call this)
     * @param _metadataURI IPFS URI containing product metadata
     * @param _productType Type of product (physical/digital)
     * @param _warrantyPeriod Warranty period in seconds
     * @return tokenId The ID of the created product
     */
    function createProduct(
        string memory _metadataURI,
        string memory _productType,
        uint256 _warrantyPeriod
    ) external onlyRole(ParticipantRegistry.Role.PRODUCER) returns (uint256) {
        require(bytes(_metadataURI).length > 0, "Metadata URI required");
        
        // Mint the NFT
        uint256 tokenId = productNFT.mintProduct(
            msg.sender,
            _metadataURI,
            _productType,
            _warrantyPeriod
        );

        // Initialize product tracking
        products[tokenId] = Product({
            tokenId: tokenId,
            currentOwner: msg.sender,
            status: ProductStatus.MANUFACTURED,
            producer: msg.sender,
            distributor: address(0),
            retailer: address(0),
            buyer: address(0),
            manufactureDate: block.timestamp,
            saleDate: 0,
            saleDetails: ""
        });

        emit ProductManufactured(tokenId, msg.sender, _metadataURI);

        return tokenId;
    }

    /**
     * @dev Transfer product to distributor (producer or distributor can call)
     * @param _tokenId ID of the product
     * @param _distributor Address of the distributor
     */
    function transferToDistributor(uint256 _tokenId, address _distributor) external onlyVerified {
        Product storage product = products[_tokenId];
        
        require(product.tokenId != 0, "Product does not exist");
        require(product.currentOwner == msg.sender, "Not current owner");
        require(
            participantRegistry.hasRole(_distributor, ParticipantRegistry.Role.DISTRIBUTOR),
            "Recipient is not a verified distributor"
        );
        require(
            product.status == ProductStatus.MANUFACTURED || 
            product.status == ProductStatus.WITH_DISTRIBUTOR,
            "Invalid product status for this transfer"
        );

        // Record and execute transfer
        productNFT.recordTransfer(_tokenId, msg.sender, _distributor, "supply_chain");
        productNFT.executeTransfer(msg.sender, _distributor, _tokenId);

        // Update product tracking
        product.currentOwner = _distributor;
        product.distributor = _distributor;
        product.status = ProductStatus.WITH_DISTRIBUTOR;

        emit ProductTransferredToDistributor(_tokenId, _distributor);
    }

    /**
     * @dev Transfer product to retailer (producer, distributor, or retailer can call)
     * @param _tokenId ID of the product
     * @param _retailer Address of the retailer
     */
    function transferToRetailer(uint256 _tokenId, address _retailer) external onlyVerified {
        Product storage product = products[_tokenId];
        
        require(product.tokenId != 0, "Product does not exist");
        require(product.currentOwner == msg.sender, "Not current owner");
        require(
            participantRegistry.hasRole(_retailer, ParticipantRegistry.Role.RETAILER),
            "Recipient is not a verified retailer"
        );
        require(
            product.status == ProductStatus.MANUFACTURED || 
            product.status == ProductStatus.WITH_DISTRIBUTOR ||
            product.status == ProductStatus.WITH_RETAILER,
            "Invalid product status for this transfer"
        );

        // Record and execute transfer
        productNFT.recordTransfer(_tokenId, msg.sender, _retailer, "supply_chain");
        productNFT.executeTransfer(msg.sender, _retailer, _tokenId);

        // Update product tracking
        product.currentOwner = _retailer;
        product.retailer = _retailer;
        product.status = ProductStatus.WITH_RETAILER;

        emit ProductTransferredToRetailer(_tokenId, _retailer);
    }

    /**
     * @dev Sell product to buyer (producer or retailer can call)
     * @param _tokenId ID of the product
     * @param _buyer Address of the buyer
     * @param _saleDetails IPFS hash of sale details/receipt
     */
    function sellToBuyer(uint256 _tokenId, address _buyer, string memory _saleDetails) external onlyVerified {
        Product storage product = products[_tokenId];
        
        require(product.tokenId != 0, "Product does not exist");
        require(product.currentOwner == msg.sender, "Not current owner");
        require(_buyer != address(0), "Invalid buyer address");
        require(
            participantRegistry.isVerifiedParticipant(_buyer),
            "Buyer must be a verified participant"
        );
        require(
            product.status == ProductStatus.MANUFACTURED || 
            product.status == ProductStatus.WITH_DISTRIBUTOR ||
            product.status == ProductStatus.WITH_RETAILER,
            "Product already sold"
        );

        // Record and execute transfer
        productNFT.recordTransfer(_tokenId, msg.sender, _buyer, "sale");
        productNFT.executeTransfer(msg.sender, _buyer, _tokenId);

        // Update product tracking
        product.currentOwner = _buyer;
        product.buyer = _buyer;
        product.status = ProductStatus.SOLD_TO_BUYER;
        product.saleDate = block.timestamp;
        product.saleDetails = _saleDetails;

        emit ProductSoldToBuyer(_tokenId, _buyer, _saleDetails);
    }

    /**
     * @dev Resell product in secondary market (buyer to buyer transfer)
     * @param _tokenId ID of the product
     * @param _newBuyer Address of the new buyer
     */
    function resellProduct(uint256 _tokenId, address _newBuyer) external onlyVerified {
        Product storage product = products[_tokenId];
        
        require(product.tokenId != 0, "Product does not exist");
        require(product.currentOwner == msg.sender, "Not current owner");
        require(_newBuyer != address(0), "Invalid buyer address");
        require(
            participantRegistry.isVerifiedParticipant(_newBuyer),
            "New buyer must be a verified participant"
        );
        require(
            product.status == ProductStatus.SOLD_TO_BUYER || 
            product.status == ProductStatus.RESOLD,
            "Product not in secondary market state"
        );

        // Record and execute transfer
        productNFT.recordTransfer(_tokenId, msg.sender, _newBuyer, "secondary_sale");
        productNFT.executeTransfer(msg.sender, _newBuyer, _tokenId);

        // Update product tracking
        product.currentOwner = _newBuyer;
        product.status = ProductStatus.RESOLD;

        emit ProductResold(_tokenId, msg.sender, _newBuyer);
    }

    /**
     * @dev Get product details
     * @param _tokenId ID of the product
     * @return Product struct
     */
    function getProduct(uint256 _tokenId) external view returns (Product memory) {
        require(products[_tokenId].tokenId != 0, "Product does not exist");
        return products[_tokenId];
    }

    /**
     * @dev Get current owner of a product
     * @param _tokenId ID of the product
     * @return Address of current owner
     */
    function getCurrentOwner(uint256 _tokenId) external view returns (address) {
        require(products[_tokenId].tokenId != 0, "Product does not exist");
        return products[_tokenId].currentOwner;
    }

    /**
     * @dev Get product status
     * @param _tokenId ID of the product
     * @return ProductStatus enum value
     */
    function getProductStatus(uint256 _tokenId) external view returns (ProductStatus) {
        require(products[_tokenId].tokenId != 0, "Product does not exist");
        return products[_tokenId].status;
    }

    /**
     * @dev Verify product authenticity by checking if it was created by a verified producer
     * @param _tokenId ID of the product
     * @return bool True if product is authentic
     */
    function verifyAuthenticity(uint256 _tokenId) external view returns (bool) {
        Product memory product = products[_tokenId];
        if (product.tokenId == 0) return false;
        
        return participantRegistry.hasRole(product.producer, ParticipantRegistry.Role.PRODUCER);
    }

    /**
     * @dev Check warranty validity
     * @param _tokenId ID of the product
     * @return bool True if warranty is valid
     */
    function checkWarranty(uint256 _tokenId) external view returns (bool) {
        require(products[_tokenId].tokenId != 0, "Product does not exist");
        return productNFT.isWarrantyValid(_tokenId);
    }

    /**
     * @dev Batch transfer products to distributor (single transaction)
     * @param _tokenIds Array of product token IDs
     * @param _distributor Address of the distributor
     */
    function batchTransferToDistributor(uint256[] memory _tokenIds, address _distributor) external onlyVerified {
        require(_tokenIds.length > 0, "No tokens provided");
        require(
            participantRegistry.hasRole(_distributor, ParticipantRegistry.Role.DISTRIBUTOR),
            "Recipient is not a verified distributor"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            Product storage product = products[tokenId];
            
            require(product.tokenId != 0, "Product does not exist");
            require(product.currentOwner == msg.sender, "Not current owner");
            require(
                product.status == ProductStatus.MANUFACTURED || 
                product.status == ProductStatus.WITH_DISTRIBUTOR,
                "Invalid product status for this transfer"
            );

            // Record and execute transfer
            productNFT.recordTransfer(tokenId, msg.sender, _distributor, "supply_chain");
            productNFT.executeTransfer(msg.sender, _distributor, tokenId);

            // Update product tracking
            product.currentOwner = _distributor;
            product.distributor = _distributor;
            product.status = ProductStatus.WITH_DISTRIBUTOR;

            emit ProductTransferredToDistributor(tokenId, _distributor);
        }
    }

    /**
     * @dev Batch transfer products to retailer (single transaction)
     * @param _tokenIds Array of product token IDs
     * @param _retailer Address of the retailer
     */
    function batchTransferToRetailer(uint256[] memory _tokenIds, address _retailer) external onlyVerified {
        require(_tokenIds.length > 0, "No tokens provided");
        require(
            participantRegistry.hasRole(_retailer, ParticipantRegistry.Role.RETAILER),
            "Recipient is not a verified retailer"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            Product storage product = products[tokenId];
            
            require(product.tokenId != 0, "Product does not exist");
            require(product.currentOwner == msg.sender, "Not current owner");
            require(
                product.status == ProductStatus.MANUFACTURED || 
                product.status == ProductStatus.WITH_DISTRIBUTOR ||
                product.status == ProductStatus.WITH_RETAILER,
                "Invalid product status for this transfer"
            );

            // Record and execute transfer
            productNFT.recordTransfer(tokenId, msg.sender, _retailer, "supply_chain");
            productNFT.executeTransfer(msg.sender, _retailer, tokenId);

            // Update product tracking
            product.currentOwner = _retailer;
            product.retailer = _retailer;
            product.status = ProductStatus.WITH_RETAILER;

            emit ProductTransferredToRetailer(tokenId, _retailer);
        }
    }

    /**
     * @dev Batch sell products to buyer (single transaction)
     * @param _tokenIds Array of product token IDs
     * @param _buyer Address of the buyer
     * @param _saleDetails IPFS hash of sale details/receipt (same for all products)
     */
    function batchSellToBuyer(uint256[] memory _tokenIds, address _buyer, string memory _saleDetails) external onlyVerified {
        require(_tokenIds.length > 0, "No tokens provided");
        require(_buyer != address(0), "Invalid buyer address");
        require(
            participantRegistry.isVerifiedParticipant(_buyer),
            "Buyer must be a verified participant"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            Product storage product = products[tokenId];
            
            require(product.tokenId != 0, "Product does not exist");
            require(product.currentOwner == msg.sender, "Not current owner");
            require(
                product.status == ProductStatus.MANUFACTURED || 
                product.status == ProductStatus.WITH_DISTRIBUTOR ||
                product.status == ProductStatus.WITH_RETAILER,
                "Product already sold"
            );

            // Record and execute transfer
            productNFT.recordTransfer(tokenId, msg.sender, _buyer, "sale");
            productNFT.executeTransfer(msg.sender, _buyer, tokenId);

            // Update product tracking
            product.currentOwner = _buyer;
            product.buyer = _buyer;
            product.status = ProductStatus.SOLD_TO_BUYER;
            product.saleDate = block.timestamp;
            product.saleDetails = _saleDetails;

            emit ProductSoldToBuyer(tokenId, _buyer, _saleDetails);
        }
    }
    
    /**
     * @dev Get product producer (helper for GtinLinker)
     * @param _tokenId Token ID
     * @return producer Producer address
     */
    function getProductProducer(uint256 _tokenId) external view returns (address) {
        require(products[_tokenId].tokenId != 0, "Product does not exist");
        return products[_tokenId].producer;
    }
}

