// Detect network based on environment or default to localhost
const network = import.meta.env.VITE_NETWORK_NAME || 'localhost';

// Hardcoded addresses for localhost (from deployment)
// These will be overridden by deployment-localhost.json if it exists
const LOCALHOST_ADDRESSES = {
  ParticipantRegistry: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
  ProductNFT: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
  SupplyChain: '0x520DB859bA58bA94044F14C6ed5Ad01F05F30a04'
};

// Hardcoded addresses for Sepolia (from deployment)
const SEPOLIA_ADDRESSES = {
  ParticipantRegistry: '0xB882B408727c752bEb54D7CA91750f2BDe38AAa0',
  ProductNFT: '0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59',
  SupplyChain: '0xfef50a2a46C7E89B108F9d5986B5BC72767B8c6B'
};

// Hardcoded addresses for Polygon Amoy Testnet (will be filled after deployment)
const AMOY_ADDRESSES = {
  ParticipantRegistry: '',
  ProductNFT: '',
  SupplyChain: ''
};

// Hardcoded addresses for Polygon Mainnet (will be filled after deployment)
const POLYGON_ADDRESSES = {
  ParticipantRegistry: '',
  ProductNFT: '',
  SupplyChain: ''
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
    };

// Load addresses from deployment file if available
export async function loadContractAddresses() {
  // For localhost, use hardcoded addresses (updated with latest deployment)
  // This avoids JSON import issues with Vite
  if (network === 'localhost') {
    console.log('📍 Using localhost contract addresses:', LOCALHOST_ADDRESSES);
    return LOCALHOST_ADDRESSES;
  }

  // For Sepolia, use hardcoded addresses (updated with latest deployment)
  // This avoids JSON import issues with Vite
  if (network === 'sepolia') {
    console.log('📍 Using Sepolia contract addresses:', SEPOLIA_ADDRESSES);
    return SEPOLIA_ADDRESSES;
  }

  // For Polygon Amoy Testnet, use hardcoded addresses
  if (network === 'amoy') {
    console.log('📍 Using Polygon Amoy testnet contract addresses:', AMOY_ADDRESSES);
    return AMOY_ADDRESSES;
  }

  // For Polygon Mainnet, use hardcoded addresses
  if (network === 'polygon') {
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
    const deployment = await import(`./deployment-${network}.json`);
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

