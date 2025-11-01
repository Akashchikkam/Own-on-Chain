# Product Metadata

This directory contains schemas, examples, and utilities for managing product metadata on IPFS.

## Schema

The `product-schema.json` file defines the structure for product metadata. It supports both physical and digital products.

### Required Fields
- `name`: Product name
- `productType`: "physical" or "digital"
- `manufacturer`: Manufacturer information
- `serialNumber`: Unique identifier
- `manufactureDate`: Manufacturing date
- `warrantyPeriod`: Warranty duration in days

### Optional Fields
- `specifications`: Product specs as key-value pairs
- `images`: Array of product images with IPFS URLs
- `documents`: Related documents (manuals, certificates)
- `certifications`: Product certifications
- `dimensions`: Physical dimensions (for physical products)
- `digitalDetails`: Software/license info (for digital products)
- `attributes`: Custom attributes

## Examples

### Physical Product
See `example-physical-product.json` for a smartphone example with:
- Complete specifications
- Warranty information
- Product images
- Certification details
- Physical dimensions

### Digital Product
See `example-digital-product.json` for software license example with:
- Version information
- License type
- Supported platforms
- Subscription details

## IPFS Utilities

The `utils/ipfs.js` module provides functions for:

### Upload Functions
```javascript
const { uploadProductMetadata } = require('./utils/ipfs');

const result = await uploadProductMetadata({
  name: "Product Name",
  productType: "physical",
  serialNumber: "SN123456",
  // ... other fields
});

console.log(result.ipfsUrl); // ipfs://Qm...
console.log(result.gatewayUrl); // https://gateway.pinata.cloud/ipfs/Qm...
```

### Retrieve Functions
```javascript
const { retrieveProductMetadata } = require('./utils/ipfs');

const metadata = await retrieveProductMetadata('ipfs://Qm...');
console.log(metadata.data);
```

### Helper Functions
```javascript
const { ipfsToGatewayUrl } = require('./utils/ipfs');

const gatewayUrl = ipfsToGatewayUrl('ipfs://QmHash');
// Returns: https://gateway.pinata.cloud/ipfs/QmHash
```

## Environment Setup

Create a `.env` file in the project root with:

```env
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

Get your Pinata API keys from: https://app.pinata.cloud/

## Usage in Frontend

The IPFS utilities can be used in the frontend to:
1. Upload product images and metadata when creating products
2. Retrieve and display product information
3. Convert IPFS URLs to gateway URLs for display

Example:
```javascript
import { uploadProductMetadata, ipfsToGatewayUrl } from './metadata/utils/ipfs';

// Create product
const metadata = await uploadProductMetadata(productData);
await supplyChainContract.createProduct(metadata.ipfsUrl, ...);

// Display product
const imageUrl = ipfsToGatewayUrl(product.images[0].url);
```

