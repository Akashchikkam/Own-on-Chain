import { ethers } from 'ethers';
import { loadContractAddresses, CONTRACT_ADDRESSES } from '../contracts/config';

// Import ABIs as JavaScript modules
import ParticipantRegistryABI from '../contracts/ParticipantRegistry.js';
import ProductNFTABI from '../contracts/ProductNFT.js';
import SupplyChainABI from '../contracts/SupplyChain.js';

let contractAddresses = null;

// Initialize contract addresses
async function initAddresses() {
  if (!contractAddresses) {
    contractAddresses = await loadContractAddresses();
    console.log('🔗 Contract addresses initialized:', contractAddresses);
    
    // Validate addresses
    if (!contractAddresses.ParticipantRegistry || 
        !contractAddresses.ProductNFT || 
        !contractAddresses.SupplyChain) {
      console.error('❌ Invalid contract addresses:', contractAddresses);
      throw new Error('Contract addresses not properly configured. Please deploy contracts first.');
    }
  }
  return contractAddresses;
}

// Get ParticipantRegistry contract instance
export async function getParticipantRegistryContract(signerOrProvider) {
  const addresses = await initAddresses();
  console.log('📄 Creating ParticipantRegistry contract at:', addresses.ParticipantRegistry);
  return new ethers.Contract(
    addresses.ParticipantRegistry,
    ParticipantRegistryABI.abi,
    signerOrProvider
  );
}

// Get ProductNFT contract instance
export async function getProductNFTContract(signerOrProvider) {
  const addresses = await initAddresses();
  console.log('📄 Creating ProductNFT contract at:', addresses.ProductNFT);
  return new ethers.Contract(
    addresses.ProductNFT,
    ProductNFTABI.abi,
    signerOrProvider
  );
}

// Get SupplyChain contract instance
export async function getSupplyChainContract(signerOrProvider) {
  const addresses = await initAddresses();
  console.log('📄 Creating SupplyChain contract at:', addresses.SupplyChain);
  return new ethers.Contract(
    addresses.SupplyChain,
    SupplyChainABI.abi,
    signerOrProvider
  );
}

// Participant Registry Functions
export const participantRegistryService = {
  // Register a new participant
  async register(signer, role, verificationDocumentIpfs) {
    const contract = await getParticipantRegistryContract(signer);
    const tx = await contract.registerParticipant(role, verificationDocumentIpfs);
    await tx.wait();
    return tx;
  },

  // Get participant details
  async getParticipant(provider, address) {
    try {
      const contract = await getParticipantRegistryContract(provider);
      const result = await contract.getParticipant(address);
      
      // Convert struct to JavaScript object
      const participant = {
        participantAddress: result[0] || result.participantAddress,
        role: result[1] !== undefined ? result[1] : result.role,
        status: result[2] !== undefined ? result[2] : result.status,
        verificationDocument: result[3] || result.verificationDocument,
        registrationDate: result[4] || result.registrationDate,
        isActive: result[5] !== undefined ? result[5] : result.isActive,
      };
      
      // Check if participant actually exists (not a zero address)
      if (!participant.participantAddress || 
          participant.participantAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Participant not found');
      }
      
      console.log('📋 Participant data:', {
        address,
        role: Number(participant.role),
        status: Number(participant.status),
        registrationDate: Number(participant.registrationDate),
        isActive: participant.isActive
      });
      
      return participant;
    } catch (error) {
      // If it's a revert reason about participant not found, throw specific error
      if (error.reason && error.reason.includes('Participant not found')) {
        throw new Error('Participant not found');
      }
      // Re-throw other errors
      throw error;
    }
  },

  // Check if address has specific role
  async hasRole(provider, address, role) {
    const contract = await getParticipantRegistryContract(provider);
    return await contract.hasRole(address, role);
  },

  // Get pending participants (admin only)
  async getPendingParticipants(provider) {
    const contract = await getParticipantRegistryContract(provider);
    return await contract.getPendingParticipants();
  },

  // Verify participant (admin only)
  async verifyParticipant(signer, participantAddress) {
    try {
      console.log('🔐 Verifying participant:', participantAddress);
      const contract = await getParticipantRegistryContract(signer);
      
      // Check signer address
      const signerAddress = await signer.getAddress();
      console.log('👤 Signer address:', signerAddress);
      
      // Get contract owner
      const owner = await contract.owner();
      console.log('👑 Contract owner:', owner);
      
      if (signerAddress.toLowerCase() !== owner.toLowerCase()) {
        throw new Error(`Only admin can verify. Admin: ${owner}, You: ${signerAddress}`);
      }
      
      const tx = await contract.verifyParticipant(participantAddress);
      console.log('📝 Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.hash);
      
      return tx;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  },

  // Reject participant (admin only)
  async rejectParticipant(signer, participantAddress, reason) {
    const contract = await getParticipantRegistryContract(signer);
    const tx = await contract.rejectParticipant(participantAddress, reason);
    await tx.wait();
    return tx;
  },
};

// Product NFT Functions
export const productNFTService = {
  // Get product info
  async getProductInfo(provider, tokenId) {
    const contract = await getProductNFTContract(provider);
    return await contract.getProductInfo(tokenId);
  },

  // Get transfer history
  async getTransferHistory(provider, tokenId) {
    const contract = await getProductNFTContract(provider);
    return await contract.getTransferHistory(tokenId);
  },

  // Get tokens owned by address
  async getTokensByOwner(provider, ownerAddress) {
    const contract = await getProductNFTContract(provider);
    return await contract.getTokensByOwner(ownerAddress);
  },

  // Get token URI (metadata)
  async getTokenURI(provider, tokenId) {
    const contract = await getProductNFTContract(provider);
    return await contract.tokenURI(tokenId);
  },

  // Check warranty validity
  async isWarrantyValid(provider, tokenId) {
    const contract = await getProductNFTContract(provider);
    return await contract.isWarrantyValid(tokenId);
  },

  // Get owner of token
  async ownerOf(provider, tokenId) {
    const contract = await getProductNFTContract(provider);
    return await contract.ownerOf(tokenId);
  },

  // Generic transfer to any address (using ERC721 transferFrom)
  async transferTo(signer, tokenId, toAddress) {
    const contract = await getProductNFTContract(signer);
    const fromAddress = await signer.getAddress();
    console.log(`🔄 Transferring token ${tokenId} from ${fromAddress} to ${toAddress}`);
    const tx = await contract.transferFrom(fromAddress, toAddress, tokenId);
    await tx.wait();
    return tx;
  },
};

// Supply Chain Functions
export const supplyChainService = {
  // Create product (producer only)
  async createProduct(signer, metadataURI, productType, warrantyPeriodDays) {
    const contract = await getSupplyChainContract(signer);
    const warrantySeconds = warrantyPeriodDays * 24 * 60 * 60;
    const tx = await contract.createProduct(metadataURI, productType, warrantySeconds);
    const receipt = await tx.wait();
    
    // Extract tokenId from event
    const event = receipt.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed.name === 'ProductManufactured';
      } catch (e) {
        return false;
      }
    });
    
    if (event) {
      const parsed = contract.interface.parseLog(event);
      return { tx, tokenId: parsed.args.tokenId };
    }
    
    return { tx, tokenId: null };
  },

  // Get product details
  async getProduct(provider, tokenId) {
    const contract = await getSupplyChainContract(provider);
    return await contract.getProduct(tokenId);
  },

  // Transfer to distributor
  async transferToDistributor(signer, tokenId, distributorAddress) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.transferToDistributor(tokenId, distributorAddress);
    await tx.wait();
    return tx;
  },

  // Transfer to retailer
  async transferToRetailer(signer, tokenId, retailerAddress) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.transferToRetailer(tokenId, retailerAddress);
    await tx.wait();
    return tx;
  },

  // Sell to buyer
  async sellToBuyer(signer, tokenId, buyerAddress, saleDetailsIpfs) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.sellToBuyer(tokenId, buyerAddress, saleDetailsIpfs);
    await tx.wait();
    return tx;
  },

  // Resell product (secondary market)
  async resellProduct(signer, tokenId, newBuyerAddress) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.resellProduct(tokenId, newBuyerAddress);
    await tx.wait();
    return tx;
  },

  // Verify product authenticity
  async verifyAuthenticity(provider, tokenId) {
    const contract = await getSupplyChainContract(provider);
    return await contract.verifyAuthenticity(tokenId);
  },

  // Check warranty
  async checkWarranty(provider, tokenId) {
    const contract = await getSupplyChainContract(provider);
    return await contract.checkWarranty(tokenId);
  },

  // Get product status
  async getProductStatus(provider, tokenId) {
    const contract = await getSupplyChainContract(provider);
    return await contract.getProductStatus(tokenId);
  },

  // Get current owner
  async getCurrentOwner(provider, tokenId) {
    const contract = await getSupplyChainContract(provider);
    return await contract.getCurrentOwner(tokenId);
  },
};

// Helper function to format addresses
export function formatAddress(address) {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Helper function to handle contract errors
export function parseContractError(error) {
  if (error.reason) return error.reason;
  if (error.data?.message) return error.data.message;
  if (error.message) {
    // Extract revert reason from error message
    const match = error.message.match(/reason="([^"]+)"/);
    if (match) return match[1];
    return error.message;
  }
  return 'Transaction failed';
}

