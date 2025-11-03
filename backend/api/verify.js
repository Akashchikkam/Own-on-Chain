import express from 'express';
import { ethers } from 'ethers';
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

    // Fetch all data in parallel with error handling
    const [owner, tokenURI, transferHistory, warrantyValid] = await Promise.all([
      contract.ownerOf(tokenId).catch(err => {
        throw new Error(`Failed to get owner: ${err.message}`);
      }),
      contract.tokenURI(tokenId).catch(() => ''), // Return empty if fails
      contract.getTransferHistory(tokenId).catch(() => []), // Return empty array if fails
      contract.isWarrantyValid(tokenId).catch(() => false)
    ]);

    const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
    const isBurned = owner.toLowerCase() === BURN_ADDRESS.toLowerCase();

    // Format history
    const history = transferHistory.map(t => ({
      from: t.from,
      to: t.to,
      timestamp: t.timestamp.toString(),
      transactionHash: t.transactionHash || ''
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

export { router };

