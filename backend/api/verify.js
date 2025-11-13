import express from 'express';
import { ethers } from 'ethers';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract addresses
const CONTRACTS = {
  sepolia: {
    ProductNFT: '0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59'
  },
  localhost: {
    ProductNFT: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE'
  }
};

// Get RPC URL with fallbacks
function getRpcUrl() {
  const network = process.env.VITE_NETWORK_NAME || 'sepolia';
  if (network === 'localhost') return 'http://127.0.0.1:8545';
  
  // Multiple fallback RPC endpoints for Sepolia
  const rpcEndpoints = [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.publicnode.com'
  ];
  
  // Return first one (we'll add retry logic if needed)
  return rpcEndpoints[0];
}

// Load ABI
let ProductNFTABI = null;
async function getABI() {
  if (!ProductNFTABI) {
    try {
      const abiPath = path.join(__dirname, '../../frontend/src/contracts/ProductNFT.js');
      const module = await import(abiPath);
      ProductNFTABI = module.default;
    } catch (err) {
      throw new Error('Failed to load ABI: ' + err.message);
    }
  }
  return ProductNFTABI;
}

// Get contract address
function getContractAddress() {
  const network = process.env.VITE_NETWORK_NAME || 'sepolia';
  return CONTRACTS[network]?.ProductNFT || CONTRACTS.sepolia.ProductNFT;
}

// Single endpoint: verify product
router.get('/:tokenId', async (req, res) => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    
    if (isNaN(tokenId) || tokenId < 0) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Try multiple RPC endpoints if first fails
    let provider;
    const rpcUrls = [
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.publicnode.com'
    ];
    
    const network = process.env.VITE_NETWORK_NAME || 'sepolia';
    if (network === 'localhost') {
      provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    } else {
      // Try first RPC, if it fails try others
      let lastError;
      for (const rpcUrl of rpcUrls) {
        try {
          provider = new ethers.JsonRpcProvider(rpcUrl);
          // Test connection
          await provider.getBlockNumber();
          console.log(`✅ Connected to RPC: ${rpcUrl}`);
          break;
        } catch (err) {
          console.warn(`⚠️ RPC failed (${rpcUrl}):`, err.message);
          lastError = err;
          continue;
        }
      }
      if (!provider) {
        throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
      }
    }

    const abi = await getABI();
    const contractAddress = getContractAddress();
    const contract = new ethers.Contract(contractAddress, abi.abi, provider);

    // Fetch basic data first
    const [owner, tokenURI, warrantyValid] = await Promise.all([
      contract.ownerOf(tokenId).catch(err => {
        throw new Error(`Failed to get owner: ${err.message}`);
      }),
      contract.tokenURI(tokenId).catch(() => ''), // Return empty if fails
      contract.isWarrantyValid(tokenId).catch(() => false)
    ]);

    // Get comprehensive transfer history (combine SupplyChain records + ERC721 events)
    let recordedTransfers = [];
    try {
      recordedTransfers = await contract.getTransferHistory(tokenId);
      console.log(`📋 Backend: Recorded transfers from SupplyChain: ${recordedTransfers.length}`);
    } catch (err) {
      console.warn('⚠️ Backend: Could not get recorded transfers:', err.message);
    }

    // Also get ERC721 Transfer events (catches ALL transfers, including direct ones)
    let events = [];
    try {
      const filter = contract.filters.Transfer(null, null, tokenId);
      events = await contract.queryFilter(filter);
      console.log(`📋 Backend: ERC721 Transfer events found: ${events.length}`);
    } catch (err) {
      console.warn('⚠️ Backend: Could not query Transfer events:', err.message);
    }

    // Combine both sources, avoiding duplicates
    const transferMap = new Map();

    // Add recorded transfers first
    for (const transfer of recordedTransfers) {
      const key = `${transfer.from?.toLowerCase() || '0x0'}-${transfer.to?.toLowerCase() || '0x0'}-${transfer.timestamp?.toString() || '0'}`;
      transferMap.set(key, {
        from: transfer.from,
        to: transfer.to,
        timestamp: transfer.timestamp?.toString() || '0',
        transferType: transfer.transferType || 'transfer',
        transactionHash: transfer.transactionHash || ''
      });
    }

    // Add ERC721 Transfer events (these catch direct transfers not in SupplyChain)
    for (const event of events) {
      try {
        const from = event.args.from;
        const to = event.args.to;
        const tokenIdFromEvent = event.args.tokenId;

        // Only process if it's for this token
        if (tokenIdFromEvent && tokenIdFromEvent.toString() === tokenId.toString()) {
          const block = await event.getBlock();
          const timestamp = block.timestamp.toString();
          const key = `${from.toLowerCase()}-${to.toLowerCase()}-${timestamp}`;

          // Only add if not already in recorded transfers
          if (!transferMap.has(key)) {
            transferMap.set(key, {
              from: from,
              to: to,
              timestamp: timestamp,
              transferType: 'transfer',
              transactionHash: event.transactionHash
            });
            console.log(`📋 Backend: Added ERC721 event transfer: ${from.substring(0, 10)}... → ${to.substring(0, 10)}... at ${timestamp}`);
          }
        }
      } catch (eventErr) {
        console.warn('⚠️ Backend: Error processing transfer event:', eventErr.message);
      }
    }

    // Sort by timestamp
    const allTransfers = Array.from(transferMap.values()).sort((a, b) =>
      Number(a.timestamp) - Number(b.timestamp)
    );

    console.log(`📋 Backend: Combined transfer history (total): ${allTransfers.length}`);

    const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
    const isBurned = owner.toLowerCase() === BURN_ADDRESS.toLowerCase();

    // Format history
    const history = allTransfers.map(t => ({
      from: t.from,
      to: t.to,
      timestamp: t.timestamp,
      transactionHash: t.transactionHash || '',
      transferType: t.transferType || 'transfer'
    }));

    res.json({
      success: true,
      data: {
        tokenId,
        owner,
        tokenURI,
        isBurned,
        warrantyValid,
        transferHistory: history
      }
    });

  } catch (error) {
    console.error('Verify error:', error);
    
    if (error.message?.includes('ERC721: invalid token ID') || 
        error.message?.includes('call revert') ||
        error.message?.includes('nonexistent token')) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }

    res.status(500).json({ 
      success: false,
      error: error.message || 'Verification failed' 
    });
  }
});

// Lookup endpoint: Find token ID by product ID + serial number
router.get('/lookup/:productId/:serialNumber', async (req, res) => {
  try {
    const { productId, serialNumber } = req.params;
    
    if (!productId || !serialNumber) {
      return res.status(400).json({ 
        success: false,
        error: 'Product ID and serial number are required' 
      });
    }

    // Get provider
    let provider;
    const rpcUrls = [
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.publicnode.com'
    ];
    
    const network = process.env.VITE_NETWORK_NAME || 'sepolia';
    if (network === 'localhost') {
      provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    } else {
      let lastError;
      for (const rpcUrl of rpcUrls) {
        try {
          provider = new ethers.JsonRpcProvider(rpcUrl);
          await provider.getBlockNumber();
          console.log(`✅ Connected to RPC: ${rpcUrl}`);
          break;
        } catch (err) {
          console.warn(`⚠️ RPC failed (${rpcUrl}):`, err.message);
          lastError = err;
          continue;
        }
      }
      if (!provider) {
        throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
      }
    }

    const abi = await getABI();
    const contractAddress = getContractAddress();
    const contract = new ethers.Contract(contractAddress, abi.abi, provider);

    // Try to get total supply or search a reasonable range
    // For now, search up to token ID 10000 (adjust based on your needs)
    const MAX_SEARCH = 10000;
    let foundTokenId = null;

    console.log(`🔍 Searching for product: productId=${productId}, serialNumber=${serialNumber}`);

    // Search in batches to avoid timeout
    const BATCH_SIZE = 50;
    for (let start = 0; start < MAX_SEARCH && !foundTokenId; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE, MAX_SEARCH);
      const promises = [];

      for (let tokenId = start; tokenId < end; tokenId++) {
        promises.push(
          contract.tokenURI(tokenId)
            .then(tokenURI => ({ tokenId, tokenURI }))
            .catch(() => null) // Skip invalid tokens
        );
      }

      const results = await Promise.all(promises);
      
      // Check each valid token URI
      for (const result of results) {
        if (!result || !result.tokenURI) continue;

        try {
          // Fetch metadata from IPFS
          const metadataUrl = result.tokenURI.startsWith('ipfs://') 
            ? `https://gateway.pinata.cloud/ipfs/${result.tokenURI.replace('ipfs://', '')}`
            : result.tokenURI;

          const metadataResponse = await axios.get(metadataUrl, { 
            timeout: 5000,
            validateStatus: (status) => status === 200
          });
          const metadata = metadataResponse.data;
          
          // Check if productId and serialNumber match
          const matchesProductId = metadata.productId && 
            metadata.productId.toLowerCase() === productId.toLowerCase();
          const matchesSerial = metadata.serialNumber && 
            metadata.serialNumber.toLowerCase() === serialNumber.toLowerCase();

          if (matchesProductId && matchesSerial) {
            foundTokenId = result.tokenId;
            console.log(`✅ Found matching product: Token ID ${foundTokenId}`);
            break;
          }
        } catch (err) {
          // Skip metadata fetch errors (product might not exist or IPFS unavailable)
          continue;
        }
      }

      if (foundTokenId) break;
    }

    if (!foundTokenId) {
      return res.status(404).json({
        success: false,
        error: 'Product not found with the provided Product ID and Serial Number'
      });
    }

    res.json({
      success: true,
      data: {
        tokenId: foundTokenId.toString(),
        productId,
        serialNumber
      }
    });

  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lookup failed'
    });
  }
});

export { router };

