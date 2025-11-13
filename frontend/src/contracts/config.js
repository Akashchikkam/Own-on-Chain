// Detect network based on environment or default to localhost
const network = import.meta.env.VITE_NETWORK_NAME || 'localhost';

// Hardcoded addresses for localhost (from deployment)
// These will be overridden by deployment-localhost.json if it exists
export const LOCALHOST_ADDRESSES = {
  ParticipantRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  ProductNFT: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  SupplyChain: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  ProductIdentifier: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707', // Optional module
  GtinLinker: '0x0165878A594ca255338adfa4d48449f69242Eb8F' // Optional module
};

// Hardcoded addresses for Sepolia (from deployment)
export const SEPOLIA_ADDRESSES = {
  ParticipantRegistry: '0xB882B408727c752bEb54D7CA91750f2BDe38AAa0',
  ProductNFT: '0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59',
  SupplyChain: '0xfef50a2a46C7E89B108F9d5986B5BC72767B8c6B',
  ProductIdentifier: '0x777780878118E392f0258dbeF9fb30D49Bb8ae92',
  GtinLinker: '0x568148eed30595FDB0526773D62701EFb8eA8484'
};

// Hardcoded addresses for Polygon Amoy Testnet (will be filled after deployment)
const AMOY_ADDRESSES = {
  ParticipantRegistry: '',
  ProductNFT: '',
  SupplyChain: '',
  ProductIdentifier: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707', // Optional module
  GtinLinker: '0x0165878A594ca255338adfa4d48449f69242Eb8F' // Optional module
};

// Hardcoded addresses for Polygon Mainnet (will be filled after deployment)
const POLYGON_ADDRESSES = {
  ParticipantRegistry: '',
  ProductNFT: '',
  SupplyChain: '',
  ProductIdentifier: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707', // Optional module
  GtinLinker: '0x0165878A594ca255338adfa4d48449f69242Eb8F' // Optional module
};

// Contract addresses - use hardcoded for localhost/sepolia/amoy/polygon or environment variables
export const CONTRACT_ADDRESSES = network === 'localhost'
  ? LOCALHOST_ADDRESSES
  : network === 'sepolia'
  ? SEPOLIA_ADDRESSES
  : network === 'amoy'
  ? AMOY_ADDRESSES
  : network === 'polygon'
  ? POLYGON_ADDRESSES
  : {
      ParticipantRegistry: import.meta.env.VITE_PARTICIPANT_REGISTRY_ADDRESS || '',
      ProductNFT: import.meta.env.VITE_PRODUCT_NFT_ADDRESS || '',
      SupplyChain: import.meta.env.VITE_SUPPLY_CHAIN_ADDRESS || '',
      ProductIdentifier: import.meta.env.VITE_PRODUCT_IDENTIFIER_ADDRESS || '0x0000000000000000000000000000000000000000',
      GtinLinker: import.meta.env.VITE_GTIN_LINKER_ADDRESS || '0x0000000000000000000000000000000000000000'
    };

// Load addresses from deployment file if available
export async function loadContractAddresses() {
  // Check if we're actually on localhost by checking chainId from provider
  // This is more reliable than just checking VITE_NETWORK_NAME
  let detectedNetwork = network;
  
  // Try to detect actual network from window.ethereum if available
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const provider = new (await import('ethers')).BrowserProvider(window.ethereum);
      const networkInfo = await provider.getNetwork();
      const chainId = Number(networkInfo.chainId);
      
      // If chainId is 1337, we're definitely on localhost
      if (chainId === 1337) {
        detectedNetwork = 'localhost';
        console.log('🔍 Detected localhost network from chainId:', chainId);
      } else if (chainId === 11155111) {
        detectedNetwork = 'sepolia';
        console.log('🔍 Detected Sepolia network from chainId:', chainId);
      }
    } catch (err) {
      // If we can't detect, fall back to env var or default
      console.log('⚠️ Could not detect network from provider, using:', detectedNetwork);
    }
  }
  
  // For localhost, use hardcoded addresses (updated with latest deployment)
  // This avoids JSON import issues with Vite
  if (detectedNetwork === 'localhost') {
    console.log('📍 Using localhost contract addresses:', LOCALHOST_ADDRESSES);
    return LOCALHOST_ADDRESSES;
  }

  // For Sepolia, use hardcoded addresses (updated with latest deployment)
  // This avoids JSON import issues with Vite
  if (detectedNetwork === 'sepolia') {
    console.log('📍 Using Sepolia contract addresses:', SEPOLIA_ADDRESSES);
    return SEPOLIA_ADDRESSES;
  }

  // For Polygon Amoy Testnet, use hardcoded addresses
  if (detectedNetwork === 'amoy') {
    console.log('📍 Using Polygon Amoy testnet contract addresses:', AMOY_ADDRESSES);
    return AMOY_ADDRESSES;
  }

  // For Polygon Mainnet, use hardcoded addresses
  if (detectedNetwork === 'polygon') {
    console.log('📍 Using Polygon mainnet contract addresses:', POLYGON_ADDRESSES);
    return POLYGON_ADDRESSES;
  }

  // For other networks, try to load from environment or dynamic import
  if (CONTRACT_ADDRESSES.ParticipantRegistry) {
    console.log('📍 Using contract addresses from environment variables');
    return CONTRACT_ADDRESSES;
  }

  // Try dynamic import as fallback (only for networks without hardcoded addresses)
  try {
    const deployment = await import(`./deployment-${detectedNetwork}.json`);
    console.log('📍 Loaded contract addresses from deployment file:', deployment.default.contracts);
    return deployment.default.contracts;
  } catch (error) {
    console.warn('⚠️ Could not load deployment file:', error.message);
    return CONTRACT_ADDRESSES;
  }
}

// Role enum matching smart contract
export const Role = {
  NONE: 0,
  PRODUCER: 1,
  DISTRIBUTOR: 2,
  RETAILER: 3,
  BUYER: 4,
};

export const RoleName = {
  0: 'None',
  1: 'Producer',
  2: 'Distributor',
  3: 'Retailer',
  4: 'Buyer',
};

// Product Status enum
export const ProductStatus = {
  MANUFACTURED: 0,
  WITH_DISTRIBUTOR: 1,
  WITH_RETAILER: 2,
  SOLD_TO_BUYER: 3,
  RESOLD: 4,
};

export const ProductStatusName = {
  0: 'Manufactured',
  1: 'With Distributor',
  2: 'With Retailer',
  3: 'Sold to Buyer',
  4: 'Resold',
};

// Verification Status enum
export const VerificationStatus = {
  PENDING: 0,
  VERIFIED: 1,
  REJECTED: 2,
};

export const VerificationStatusName = {
  0: 'Pending',
  1: 'Verified',
  2: 'Rejected',
};

