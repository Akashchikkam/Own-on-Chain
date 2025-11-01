import axios from 'axios';

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY;
const PINATA_BASE_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

// Check if we're in local development mode without API keys
const isLocalMockMode = !PINATA_API_KEY || !PINATA_SECRET_KEY;

// In-memory storage for local testing
const localIPFSStorage = new Map();

// Log mode on initialization
if (isLocalMockMode) {
  console.log('🚀 IPFS Local Mock Mode Enabled - No API keys needed for testing');
  console.log('💡 Images and metadata will be stored in browser memory');
  console.log('ℹ️  To use real IPFS, add VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY to .env');
} else {
  console.log('✅ IPFS Connected to Pinata');
}

/**
 * Generate a mock IPFS hash for local testing
 */
function generateMockHash() {
  return 'Qm' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Upload JSON data to IPFS via Pinata (or mock for local testing)
 */
export async function uploadJSONToIPFS(jsonData, name = 'metadata.json') {
  // Local mock mode - simulate IPFS upload
  if (isLocalMockMode) {
    console.log('📦 Local Mode: Mocking IPFS upload for', name);
    const mockHash = generateMockHash();
    localIPFSStorage.set(mockHash, jsonData);
    
    return {
      success: true,
      ipfsHash: mockHash,
      ipfsUrl: `ipfs://${mockHash}`,
      gatewayUrl: `http://localhost:8080/ipfs/${mockHash}` // Mock gateway
    };
  }

  // Real Pinata upload
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
    console.error('Error uploading JSON to IPFS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload a file to IPFS via Pinata (or mock for local testing)
 */
export async function uploadFileToIPFS(file) {
  // Local mock mode - simulate file upload
  if (isLocalMockMode) {
    console.log('📦 Local Mode: Mocking file upload for', file.name);
    const mockHash = generateMockHash();
    
    // Convert file to base64 for local storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        localIPFSStorage.set(mockHash, reader.result);
        resolve({
          success: true,
          ipfsHash: mockHash,
          ipfsUrl: `ipfs://${mockHash}`,
          gatewayUrl: reader.result // Use data URL for local display
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Real Pinata upload
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({
      name: file.name
    }));

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
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
    console.error('Error uploading file to IPFS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Retrieve data from IPFS (or mock storage for local testing)
 */
export async function retrieveFromIPFS(ipfsHash) {
  const hash = ipfsHash.replace('ipfs://', '');
  
  // Local mock mode - retrieve from local storage
  if (isLocalMockMode && localIPFSStorage.has(hash)) {
    console.log('📦 Local Mode: Retrieving from mock storage');
    return {
      success: true,
      data: localIPFSStorage.get(hash)
    };
  }

  // Real IPFS retrieval
  try {
    const response = await axios.get(`${PINATA_GATEWAY}${hash}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error retrieving from IPFS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Convert IPFS URL to gateway URL
 */
export function ipfsToGatewayUrl(ipfsUrl) {
  if (!ipfsUrl) return '';
  
  // If it's already a data URL, return it directly
  if (ipfsUrl.startsWith('data:')) {
    return ipfsUrl;
  }
  
  const hash = ipfsUrl.replace('ipfs://', '');
  
  // In local mock mode, retrieve from storage
  if (isLocalMockMode && localIPFSStorage.has(hash)) {
    const data = localIPFSStorage.get(hash);
    // If it's a data URL, return it
    if (typeof data === 'string' && data.startsWith('data:')) {
      return data;
    }
  }
  
  // Real IPFS gateway URL
  return `${PINATA_GATEWAY}${hash}`;
}

/**
 * Upload product metadata to IPFS
 */
export async function uploadProductMetadata(productData) {
  // Ensure images are properly formatted with data URLs in local mode
  const processedImages = productData.images.map(img => {
    console.log('📸 Processing image:', img);
    return {
      url: img.url, // This should be the data URL in local mode
      type: img.type || 'main',
      description: img.description || ''
    };
  });
  
  const metadata = {
    name: productData.name,
    description: productData.description,
    productType: productData.productType,
    category: productData.category,
    manufacturer: productData.manufacturer,
    serialNumber: productData.serialNumber,
    model: productData.model,
    manufactureDate: new Date().toISOString(),
    warrantyPeriod: productData.warrantyPeriod,
    specifications: productData.specifications || {},
    images: processedImages,
    documents: productData.documents || [],
    certifications: productData.certifications || [],
    attributes: productData.attributes || {}
  };

  console.log('📦 Metadata to upload:', metadata);
  console.log('🖼️ Images in metadata:', metadata.images);

  if (productData.productType === 'physical' && productData.dimensions) {
    metadata.dimensions = productData.dimensions;
  }

  if (productData.productType === 'digital' && productData.digitalDetails) {
    metadata.digitalDetails = productData.digitalDetails;
  }

  return await uploadJSONToIPFS(metadata, `product-${productData.serialNumber}.json`);
}

/**
 * Upload verification document to IPFS
 */
export async function uploadVerificationDocument(documentData) {
  const metadata = {
    documentType: documentData.documentType, // 'GST', 'Aadhar', 'Business License', etc.
    issuer: documentData.issuer,
    documentNumber: documentData.documentNumber,
    issueDate: documentData.issueDate,
    expiryDate: documentData.expiryDate,
    holderName: documentData.holderName,
    holderAddress: documentData.holderAddress,
    uploadDate: new Date().toISOString()
  };

  return await uploadJSONToIPFS(metadata, `verification-${documentData.documentNumber}.json`);
}

/**
 * Check if we're in local mock mode
 */
export function isInMockMode() {
  return isLocalMockMode;
}

