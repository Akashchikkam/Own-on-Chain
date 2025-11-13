import { ethers } from 'ethers';
import { loadContractAddresses } from '../contracts/config';

/**
 * ProductIdentifier Module - Blockchain ID Service
 * Independent module for generating blockchain-native product IDs
 */

let ProductIdentifierABI = null;

async function getProductIdentifierABI() {
  if (ProductIdentifierABI) return ProductIdentifierABI;
  
  try {
    const module = await import('../contracts/ProductIdentifier.js');
    ProductIdentifierABI = module.default || module;
    
    // Check if ABI is empty (placeholder)
    if (!ProductIdentifierABI.abi || ProductIdentifierABI.abi.length === 0) {
      console.warn('ProductIdentifier ABI is placeholder, module may not be compiled yet');
      return null;
    }
    
    return ProductIdentifierABI;
  } catch (err) {
    console.warn('ProductIdentifier ABI not found, module may not be deployed');
    return null;
  }
}

export async function getProductIdentifierContract(signerOrProvider) {
  const addresses = await loadContractAddresses();
  
  if (!addresses.ProductIdentifier || addresses.ProductIdentifier === '0x0000000000000000000000000000000000000000') {
    throw new Error('ProductIdentifier module not deployed');
  }
  
  const abi = await getProductIdentifierABI();
  if (!abi) {
    throw new Error('ProductIdentifier ABI not available');
  }
  
  return new ethers.Contract(
    addresses.ProductIdentifier,
    abi.abi || abi,
    signerOrProvider
  );
}

export const productIdentifierService = {
  /**
   * Register blockchain product ID
   * @param {Object} signer - Ethers signer
   * @param {number} tokenId - Token ID
   * @param {string} productModel - Product model/SKU
   * @param {string} serialNumber - Serial number
   */
  async registerProductId(signer, tokenId, productModel, serialNumber) {
    const contract = await getProductIdentifierContract(signer);
    const manufacturer = await signer.getAddress();
    
    const tx = await contract.registerProductId(
      tokenId,
      manufacturer,
      productModel || 'UNKNOWN',
      serialNumber || `SN-${tokenId}`
    );
    
    await tx.wait();
    return tx;
  },
  
  /**
   * Get blockchain product ID
   * @param {Object} provider - Ethers provider
   * @param {number} tokenId - Token ID
   * @returns {Promise<string>} Blockchain ID string
   */
  async getBlockchainId(provider, tokenId) {
    try {
      const contract = await getProductIdentifierContract(provider);
      return await contract.getBlockchainId(tokenId);
    } catch (err) {
      if (err.message?.includes('not deployed') || err.message?.includes('not available')) {
        return null; // Module not available
      }
      throw err;
    }
  },
  
  /**
   * Get product ID details
   * @param {Object} provider - Ethers provider
   * @param {number} tokenId - Token ID
   * @returns {Promise<Object>} Product ID details
   */
  async getProductIdDetails(provider, tokenId) {
    const contract = await getProductIdentifierContract(provider);
    const details = await contract.getProductIdDetails(tokenId);
    return {
      chainId: details.chainId.toString(),
      contractAddress: details.contractAddress,
      tokenId: details.tokenId.toString(),
      manufacturer: details.manufacturer,
      productModel: details.productModel,
      serialNumber: details.serialNumber
    };
  },
  
  /**
   * Lookup token ID by manufacturer, model, and serial
   * @param {Object} provider - Ethers provider
   * @param {string} manufacturer - Manufacturer address
   * @param {string} productModel - Product model
   * @param {string} serialNumber - Serial number
   * @returns {Promise<number>} Token ID
   */
  async lookupTokenId(provider, manufacturer, productModel, serialNumber) {
    const contract = await getProductIdentifierContract(provider);
    const tokenId = await contract.lookupTokenId(manufacturer, productModel, serialNumber);
    return tokenId.toString();
  },
  
  /**
   * Check if module is available
   * @param {Object} provider - Ethers provider
   * @returns {Promise<boolean>} True if module is deployed
   */
  async isAvailable(provider) {
    try {
      const addresses = await loadContractAddresses();
      return addresses.ProductIdentifier && 
             addresses.ProductIdentifier !== '0x0000000000000000000000000000000000000000';
    } catch (err) {
      return false;
    }
  }
};

