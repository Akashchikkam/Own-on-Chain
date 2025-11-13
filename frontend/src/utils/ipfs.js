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

// Check if we're in production mode
const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

// Log mode on initialization
if (isLocalMockMode) {
  console.log('🚀 IPFS Local Mock Mode Enabled - No API keys needed for testing');
  console.log('💡 Images and metadata will be stored in browser localStorage (persists on refresh)');
  console.log('ℹ️  To use real IPFS, add VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY to .env');
} else {
  console.log('✅ IPFS Connected to Pinata');
  if (!isProduction) {
    console.log('   API Key:', PINATA_API_KEY ? `${PINATA_API_KEY.substring(0, 8)}...` : 'NOT SET');
    console.log('   Secret Key:', PINATA_SECRET_KEY ? 'SET' : 'NOT SET');
  }
  
  // Test Pinata connection (only in development)
  if (!isProduction) {
    (async () => {
      try {
        const testResponse = await axios.get(`${PINATA_BASE_URL}/data/testAuthentication`, {
          headers: {
            'pinata_api_key': PINATA_API_KEY,
            'pinata_secret_api_key': PINATA_SECRET_KEY
          },
          timeout: 5000
        });
        console.log('✅ Pinata connection test successful');
      } catch (error) {
        console.warn('⚠️ Pinata connection test failed:', error.message);
        console.warn('   This might be normal if you just set the keys. Try uploading a file to verify.');
      }
    })();
  }
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
  if (!ipfsHash || ipfsHash.trim() === '') {
    console.warn('❌ Empty IPFS hash provided');
    return {
      success: false,
      error: 'Empty IPFS hash provided'
    };
  }

  // If it's already a full HTTP/HTTPS URL (gateway URL), extract the hash from it
  if (ipfsHash.startsWith('http://') || ipfsHash.startsWith('https://')) {
    // Extract hash from gateway URL (e.g., https://gateway.pinata.cloud/ipfs/Qm...)
    const urlMatch = ipfsHash.match(/\/ipfs\/([^/?]+)/);
    if (urlMatch && urlMatch[1]) {
      ipfsHash = urlMatch[1];
    } else {
      // If we can't extract hash, try to use the URL directly
      console.log('🔍 Using provided gateway URL directly:', ipfsHash);
      try {
        const response = await axios.get(ipfsHash, {
          timeout: 5000,
          validateStatus: (status) => status === 200
        });
        return {
          success: true,
          data: response.data
        };
      } catch (error) {
        console.warn('⚠️ Failed to fetch from provided URL:', error.message);
        return {
          success: false,
          error: 'Failed to retrieve from provided URL'
        };
      }
    }
  }

  // Extract hash - handle both ipfs:// and plain hash formats
  let hash = ipfsHash.replace('ipfs://', '').trim();
  
  // Remove leading/trailing slashes and any whitespace
  hash = hash.replace(/^\/+|\/+$/g, '').trim();
  
  // Validate hash is not empty after cleaning and has minimum length
  // IPFS v0 hashes (Qm...) are 46 characters, v1 hashes (bafy...) are longer
  // But we'll accept anything reasonable (at least 20 chars to catch obvious truncation)
  if (!hash || hash === '' || hash.length < 20) {
    console.warn('❌ Invalid IPFS hash (empty or too short after cleaning):', {
      original: ipfsHash,
      cleaned: hash,
      length: hash?.length || 0,
      expected: 'IPFS hashes should be at least 46 characters (Qm...) or 59+ characters (bafy...)'
    });
    return {
      success: false,
      error: `Invalid IPFS hash format: hash appears truncated (${hash.length} chars, expected 46+)`
    };
  }
  
  // Warn if hash looks truncated (Qm... hashes should be exactly 46 chars)
  if (hash.startsWith('Qm') && hash.length < 46) {
    console.warn('⚠️ IPFS hash appears truncated:', {
      hash: hash,
      length: hash.length,
      expected: 46,
      truncated: hash.substring(0, 20) + '...'
    });
  }
  
  console.log('🔍 Retrieving IPFS content for hash:', hash, '(original:', ipfsHash, ')');
  
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

  // Ensure PINATA_GATEWAY ends with / if it's a base URL
  const pinataBase = PINATA_GATEWAY.endsWith('/') ? PINATA_GATEWAY : `${PINATA_GATEWAY}/`;
  
  // Real IPFS retrieval with multiple gateway fallbacks
  // Prioritize Cloudflare first (more reliable, less rate-limited), then IPFS.io, then others
  const gateways = [
    `https://cloudflare-ipfs.com/ipfs/${hash}`, // Primary: Cloudflare gateway (most reliable)
    `https://ipfs.io/ipfs/${hash}`, // Public IPFS gateway
    `https://dweb.link/ipfs/${hash}`, // Protocol Labs gateway
    `${pinataBase}${hash}`, // Pinata gateway (rate-limited, use as fallback)
    `https://gateway.pinata.cloud/ipfs/${hash}` // Alternative Pinata format
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
 * Uses Cloudflare as primary gateway (more reliable than Pinata)
 */
export function ipfsToGatewayUrl(ipfsUrl) {
  if (!ipfsUrl) return '';
  
  // If it's already a data URL, return it directly
  if (ipfsUrl.startsWith('data:')) {
    return ipfsUrl;
  }
  
  // If it's already a full HTTP/HTTPS URL (gateway URL), extract hash and convert to Cloudflare
  if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
    // Extract hash from any IPFS gateway URL
    const ipfsMatch = ipfsUrl.match(/\/ipfs\/([^\/\s?]+)/);
    if (ipfsMatch && ipfsMatch[1]) {
      // Always convert to Cloudflare for consistency (will fallback in onError handler if needed)
      return `https://cloudflare-ipfs.com/ipfs/${ipfsMatch[1]}`;
    }
    // If we can't extract hash, return as is (might be a direct image URL)
    return ipfsUrl;
  }
  
  // Extract hash from ipfs:// or just use the string as hash
  let hash = ipfsUrl.replace('ipfs://', '').replace(/^\/+/, '');
  
  // In local mock mode, retrieve from storage
  if (isLocalMockMode && localIPFSStorage.has(hash)) {
    const data = localIPFSStorage.get(hash);
    // If it's a data URL, return it
    if (typeof data === 'string' && data.startsWith('data:')) {
      return data;
    }
  }
  
  // Use Cloudflare IPFS gateway as primary (more reliable, no rate limits)
  // Fallback order: Cloudflare > IPFS.io > Pinata > Protocol Labs
  return `https://cloudflare-ipfs.com/ipfs/${hash}`;
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
  if (!ipfsHash || ipfsHash.trim() === '') {
    console.warn('❌ Empty IPFS hash provided for deletion');
    return { success: false, error: 'Empty IPFS hash provided' };
  }

  // Extract hash from various formats:
  // - ipfs://Qm...
  // - https://gateway.pinata.cloud/ipfs/Qm...
  // - https://cloudflare-ipfs.com/ipfs/Qm...
  // - Qm... (plain hash)
  let hash = ipfsHash.trim();
  
  // Remove ipfs:// prefix
  hash = hash.replace(/^ipfs:\/\//, '');
  
  // Extract from gateway URLs
  if (hash.startsWith('http://') || hash.startsWith('https://')) {
    const urlMatch = hash.match(/\/ipfs\/([^\/\s?]+)/);
    if (urlMatch && urlMatch[1]) {
      hash = urlMatch[1];
    } else {
      console.warn('⚠️ Could not extract IPFS hash from URL:', ipfsHash);
      return { success: false, error: 'Could not extract IPFS hash from URL' };
    }
  }
  
  // Remove any trailing slashes or query parameters
  hash = hash.split('/')[0].split('?')[0].trim();
  
  if (!hash || hash.length < 20) {
    console.warn('❌ Invalid IPFS hash after extraction:', { original: ipfsHash, extracted: hash });
    return { success: false, error: 'Invalid IPFS hash format' };
  }
  
  console.log('🗑️ Deleting IPFS content:', { original: ipfsHash, hash: hash });
  
  // Local mock mode - remove from localStorage
  if (isLocalMockMode) {
    if (localIPFSStorage.has(hash)) {
      localStorage.removeItem(`ipfs_${hash}`);
      console.log('✅ Removed from localStorage:', hash);
      return { success: true };
    }
    console.warn('⚠️ Hash not found in localStorage:', hash);
    return { success: false, error: 'Hash not found in localStorage' };
  }

  // Real Pinata - unpin the file
  try {
    console.log('🗑️ Unpinning from Pinata:', hash);
    
    // Check if API keys are set
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      console.error('❌ Pinata API keys not configured');
      return { 
        success: false, 
        error: 'Pinata API keys not configured. Please set VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY in .env file' 
      };
    }
    
    const response = await axios.delete(
      `${PINATA_BASE_URL}/pinning/unpin/${hash}`,
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY
        }
      }
    );
    
    console.log('✅ Unpinned from Pinata successfully:', hash);
    return { success: true };
  } catch (error) {
    console.error('❌ Error unpinning from Pinata:', error);
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Unknown error';
    if (error.response) {
      errorMessage = error.response.data?.error?.details || error.response.data?.error?.message || errorMessage;
      console.error('   Status:', error.response.status);
      console.error('   Response:', error.response.data);
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

