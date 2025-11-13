import { ethers } from 'ethers';
import { loadContractAddresses } from '../contracts/config';

/**
 * GtinLinker Module - GTIN Linking Service
 * Independent module for linking GS1/GTIN to products
 */

let GtinLinkerABI = null;

async function getGtinLinkerABI() {
  if (GtinLinkerABI) return GtinLinkerABI;
  
  try {
    const module = await import('../contracts/GtinLinker.js');
    GtinLinkerABI = module.default || module;
    
    // Check if ABI is empty (placeholder)
    if (!GtinLinkerABI.abi || GtinLinkerABI.abi.length === 0) {
      console.warn('GtinLinker ABI is placeholder, module may not be compiled yet');
      return null;
    }
    
    return GtinLinkerABI;
  } catch (err) {
    console.warn('GtinLinker ABI not found, module may not be deployed');
    return null;
  }
}

export async function getGtinLinkerContract(signerOrProvider) {
  const addresses = await loadContractAddresses();
  
  if (!addresses.GtinLinker || addresses.GtinLinker === '0x0000000000000000000000000000000000000000') {
    throw new Error('GtinLinker module not deployed');
  }
  
  const abi = await getGtinLinkerABI();
  if (!abi) {
    throw new Error('GtinLinker ABI not available');
  }
  
  return new ethers.Contract(
    addresses.GtinLinker,
    abi.abi || abi,
    signerOrProvider
  );
}

export const gtinLinkerService = {
  /**
   * Link GTIN to product
   * @param {Object} signer - Ethers signer
   * @param {number} tokenId - Token ID
   * @param {string} gtin - GS1/GTIN (8-14 digits)
   * @returns {Promise<Object>} Transaction
   */
  async linkGtin(signer, tokenId, gtin) {
    // Validate GTIN format
    const gtinRegex = /^\d{8,14}$/;
    if (!gtinRegex.test(gtin)) {
      throw new Error('GTIN must be 8-14 digits');
    }
    
    const contract = await getGtinLinkerContract(signer);
    const tx = await contract.linkGtin(tokenId, gtin);
    await tx.wait();
    return tx;
  },
  
  /**
   * Batch link GTINs
   * @param {Object} signer - Ethers signer
   * @param {Array<number>} tokenIds - Array of token IDs
   * @param {Array<string>} gtins - Array of GTINs
   * @returns {Promise<Object>} Transaction
   */
  async batchLinkGtin(signer, tokenIds, gtins) {
    if (tokenIds.length !== gtins.length) {
      throw new Error('Token IDs and GTINs arrays must have same length');
    }
    
    if (tokenIds.length === 0) {
      throw new Error('Arrays cannot be empty');
    }
    
    if (tokenIds.length > 500) {
      throw new Error('Maximum 500 items per batch');
    }
    
    // Validate all GTINs
    const gtinRegex = /^\d{8,14}$/;
    for (const gtin of gtins) {
      if (!gtinRegex.test(gtin)) {
        throw new Error(`Invalid GTIN format: ${gtin}`);
      }
    }
    
    const contract = await getGtinLinkerContract(signer);
    const tx = await contract.batchLinkGtin(tokenIds, gtins);
    await tx.wait();
    return tx;
  },
  
  /**
   * Unlink GTIN from product
   * @param {Object} signer - Ethers signer
   * @param {number} tokenId - Token ID
   * @returns {Promise<Object>} Transaction
   */
  async unlinkGtin(signer, tokenId) {
    const contract = await getGtinLinkerContract(signer);
    const tx = await contract.unlinkGtin(tokenId);
    await tx.wait();
    return tx;
  },
  
  /**
   * Get token ID by GTIN
   * @param {Object} provider - Ethers provider
   * @param {string} gtin - GS1/GTIN
   * @returns {Promise<number>} Token ID
   */
  async getTokenIdByGtin(provider, gtin) {
    const contract = await getGtinLinkerContract(provider);
    const tokenId = await contract.getTokenIdByGtin(gtin);
    return tokenId.toString();
  },
  
  /**
   * Get GTIN by token ID
   * @param {Object} provider - Ethers provider
   * @param {number} tokenId - Token ID
   * @returns {Promise<string>} GTIN string (empty if not linked)
   */
  async getGtinByTokenId(provider, tokenId) {
    try {
      const contract = await getGtinLinkerContract(provider);
      const gtin = await contract.getGtinByTokenId(tokenId);
      return gtin || '';
    } catch (err) {
      if (err.message?.includes('not deployed') || err.message?.includes('not available')) {
        return ''; // Module not available
      }
      throw err;
    }
  },
  
  /**
   * Check if GTIN is linked
   * @param {Object} provider - Ethers provider
   * @param {string} gtin - GS1/GTIN
   * @returns {Promise<Object>} {isLinked: boolean, tokenId: number|null}
   */
  async isGtinLinked(provider, gtin) {
    try {
      const contract = await getGtinLinkerContract(provider);
      const [isLinked, tokenId] = await contract.isGtinLinked(gtin);
      return {
        isLinked,
        tokenId: isLinked ? tokenId.toString() : null
      };
    } catch (err) {
      if (err.message?.includes('not deployed') || err.message?.includes('not available')) {
        return { isLinked: false, tokenId: null };
      }
      throw err;
    }
  },
  
  /**
   * Check if module is available
   * @param {Object} provider - Ethers provider
   * @returns {Promise<boolean>} True if module is deployed
   */
  async isAvailable(provider) {
    try {
      const addresses = await loadContractAddresses();
      return addresses.GtinLinker && 
             addresses.GtinLinker !== '0x0000000000000000000000000000000000000000';
    } catch (err) {
      return false;
    }
  }
};

