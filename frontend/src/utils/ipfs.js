import axios from 'axios';

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY;
const PINATA_BASE_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

// Check if we're in local development mode without API keys
const isLocalMockMode = !PINATA_API_KEY || !PINATA_SECRET_KEY;

// Persistent storage for local testing (survives page refresh)
const localIPFSStorage = {
  get: (key) => {
    const item = localStorage.getItem(`ipfs_${key}`);
    return item ? JSON.parse(item) : null;
  },
  set: (key, value) => {
    localStorage.setItem(`ipfs_${key}`, JSON.stringify(value));
  },
  has: (key) => {
    return localStorage.getItem(`ipfs_${key}`) !== null;
  }
};

// Log mode on initialization
if (isLocalMockMode) {
  console.log('🚀 IPFS Local Mock Mode Enabled - No API keys needed for testing');
  console.log('💡 Images and metadata will be stored in browser localStorage (persists on refresh)');
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
  if (isLocalMockMode) {
    if (localIPFSStorage.has(hash)) {
      console.log('✅ Found in localStorage:', hash);
      return {
        success: true,
        data: localIPFSStorage.get(hash)
      };
    } else {
      console.warn('❌ NOT found in localStorage:', hash);
      console.log('💡 Available keys:', Object.keys(localStorage).filter(k => k.startsWith('ipfs_')));
      return {
        success: false,
        error: 'Metadata not found in localStorage. This product was created before the persistence fix. Please recreate the product.'
      };
    }
  }

  // Real IPFS retrieval with multiple gateway fallbacks
  const gateways = [
    PINATA_GATEWAY, // Primary: Pinata gateway
    `https://ipfs.io/ipfs/${hash}`, // Public IPFS gateway
    `https://gateway.pinata.cloud/ipfs/${hash}`, // Alternative Pinata
    `https://cloudflare-ipfs.com/ipfs/${hash}`, // Cloudflare gateway
    `https://dweb.link/ipfs/${hash}` // Protocol Labs gateway
  ];

  for (const gateway of gateways) {
    try {
      console.log(`🔍 Trying IPFS gateway: ${gateway}`);
      const response = await axios.get(gateway, {
        timeout: 5000, // 5 second timeout per gateway
        validateStatus: (status) => status === 200
      });
      
      console.log(`✅ Successfully retrieved from: ${gateway}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.warn(`⚠️ Gateway failed (${gateway}):`, error.message);
      // Try next gateway
      continue;
    }
  }

  // All gateways failed
  console.error('❌ All IPFS gateways failed for hash:', hash);
  return {
    success: false,
    error: 'Failed to retrieve from all IPFS gateways'
  };
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

/**
 * Delete metadata from IPFS (unpin from Pinata or remove from localStorage)
 */
export async function deleteFromIPFS(ipfsHash) {
  const hash = ipfsHash.replace('ipfs://', '');
  
  // Local mock mode - remove from localStorage
  if (isLocalMockMode) {
    if (localIPFSStorage.has(hash)) {
      localStorage.removeItem(`ipfs_${hash}`);
      console.log('🗑️ Removed from localStorage:', hash);
      return { success: true };
    }
    return { success: false, error: 'Hash not found in localStorage' };
  }

  // Real Pinata - unpin the file
  try {
    await axios.delete(
      `${PINATA_BASE_URL}/pinning/unpin/${hash}`,
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      }
    );
    
    console.log('🗑️ Unpinned from Pinata:', hash);
    return { success: true };
  } catch (error) {
    console.error('Error unpinning from Pinata:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

