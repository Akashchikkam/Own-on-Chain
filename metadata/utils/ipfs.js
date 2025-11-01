const axios = require('axios');
require('dotenv').config();

/**
 * IPFS utility functions for uploading and retrieving data using Pinata
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_BASE_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/**
 * Upload JSON data to IPFS via Pinata
 * @param {Object} jsonData - JSON object to upload
 * @param {string} name - Optional name for the file
 * @returns {Promise<Object>} - Object containing IPFS hash and gateway URL
 */
async function uploadJSONToIPFS(jsonData, name = 'metadata.json') {
  try {
    const data = JSON.stringify({
      pinataContent: jsonData,
      pinataMetadata: {
        name: name
      }
    });

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      }
    );

    const ipfsHash = response.data.IpfsHash;
    
    return {
      success: true,
      ipfsHash: ipfsHash,
      ipfsUrl: `ipfs://${ipfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY}${ipfsHash}`
    };
  } catch (error) {
    console.error('Error uploading JSON to IPFS:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload a file to IPFS via Pinata
 * @param {Buffer|File} file - File buffer or file object
 * @param {string} fileName - Name of the file
 * @returns {Promise<Object>} - Object containing IPFS hash and gateway URL
 */
async function uploadFileToIPFS(file, fileName) {
  try {
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('file', file, fileName);
    formData.append('pinataMetadata', JSON.stringify({
      name: fileName
    }));

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        },
        maxBodyLength: Infinity
      }
    );

    const ipfsHash = response.data.IpfsHash;
    
    return {
      success: true,
      ipfsHash: ipfsHash,
      ipfsUrl: `ipfs://${ipfsHash}`,
      gatewayUrl: `${PINATA_GATEWAY}${ipfsHash}`
    };
  } catch (error) {
    console.error('Error uploading file to IPFS:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Retrieve data from IPFS using the hash
 * @param {string} ipfsHash - IPFS hash (with or without ipfs:// prefix)
 * @returns {Promise<Object>} - Retrieved data
 */
async function retrieveFromIPFS(ipfsHash) {
  try {
    // Remove ipfs:// prefix if present
    const hash = ipfsHash.replace('ipfs://', '');
    
    const response = await axios.get(`${PINATA_GATEWAY}${hash}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error retrieving from IPFS:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create product metadata object
 * @param {Object} productData - Product information
 * @returns {Object} - Formatted metadata object
 */
function createProductMetadata(productData) {
  const {
    name,
    description,
    productType,
    category,
    manufacturer,
    serialNumber,
    model,
    warrantyPeriod,
    specifications = {},
    images = [],
    documents = [],
    certifications = [],
    dimensions = null,
    digitalDetails = null,
    attributes = {}
  } = productData;

  const metadata = {
    name,
    description,
    productType,
    category,
    manufacturer,
    serialNumber,
    model,
    manufactureDate: new Date().toISOString(),
    warrantyPeriod,
    specifications,
    images,
    documents,
    certifications,
    attributes
  };

  if (productType === 'physical' && dimensions) {
    metadata.dimensions = dimensions;
  }

  if (productType === 'digital' && digitalDetails) {
    metadata.digitalDetails = digitalDetails;
  }

  return metadata;
}

/**
 * Upload product metadata to IPFS
 * @param {Object} productData - Product information
 * @returns {Promise<Object>} - Upload result with IPFS hash
 */
async function uploadProductMetadata(productData) {
  const metadata = createProductMetadata(productData);
  const result = await uploadJSONToIPFS(
    metadata, 
    `product-${productData.serialNumber}.json`
  );
  return result;
}

/**
 * Retrieve product metadata from IPFS
 * @param {string} ipfsHash - IPFS hash
 * @returns {Promise<Object>} - Product metadata
 */
async function retrieveProductMetadata(ipfsHash) {
  return await retrieveFromIPFS(ipfsHash);
}

/**
 * Convert IPFS URL to gateway URL for display
 * @param {string} ipfsUrl - IPFS URL (ipfs://hash)
 * @returns {string} - Gateway URL
 */
function ipfsToGatewayUrl(ipfsUrl) {
  if (!ipfsUrl) return '';
  const hash = ipfsUrl.replace('ipfs://', '');
  return `${PINATA_GATEWAY}${hash}`;
}

module.exports = {
  uploadJSONToIPFS,
  uploadFileToIPFS,
  retrieveFromIPFS,
  createProductMetadata,
  uploadProductMetadata,
  retrieveProductMetadata,
  ipfsToGatewayUrl
};

