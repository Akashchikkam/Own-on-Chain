import { productNFTService, supplyChainService } from './contractHelpers';

/**
 * Verify if an address owns a specific NFT token
 * Checks ProductNFT first (source of truth), then SupplyChain's currentOwner as secondary check
 * @param {ethers.Provider} provider - Ethers provider instance
 * @param {string|number} tokenId - Token ID to check
 * @param {string} address - Address to check ownership for
 * @returns {Promise<{isOwner: boolean, owner: string}>}
 */
export async function verifyOwnership(provider, tokenId, address) {
  try {
    // STEP 1: Check ProductNFT first (this is the actual NFT ownership, always valid)
    let owner;
    let usingSupplyChain = false;
    
    try {
      owner = await productNFTService.ownerOf(provider, tokenId);
      console.log(`🔍 [verifyOwnership] Token ${tokenId} - ProductNFT owner: ${owner}`);
    } catch (err) {
      console.error(`❌ [verifyOwnership] ProductNFT ownerOf failed for token ${tokenId}:`, err);
      throw new Error(`Failed to get NFT owner: ${err.message}`);
    }
    
    // STEP 2: Cross-check with SupplyChain if available (optional, for validation)
    try {
      const supplyChainOwner = await supplyChainService.getCurrentOwner(provider, tokenId);
      console.log(`🔍 [verifyOwnership] Token ${tokenId} - SupplyChain owner: ${supplyChainOwner}`);
      
      // If SupplyChain owner differs, log a warning but use ProductNFT owner (source of truth)
      if (supplyChainOwner.toLowerCase() !== owner.toLowerCase()) {
        console.warn(`⚠️ [verifyOwnership] Token ${tokenId} - Owner mismatch! ProductNFT: ${owner}, SupplyChain: ${supplyChainOwner}`);
        console.warn(`⚠️ Using ProductNFT owner (${owner}) as source of truth`);
      }
      usingSupplyChain = true;
    } catch (err) {
      // SupplyChain check failed - this is OK, product might not be in SupplyChain
      console.log(`ℹ️ [verifyOwnership] Token ${tokenId} - SupplyChain not available (product may not be registered): ${err.message}`);
      // Continue with ProductNFT owner
    }
    
    const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    
    // Check if burned or zero address
    if (owner.toLowerCase() === BURN_ADDRESS.toLowerCase() || 
        owner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      console.log(`⚠️ [verifyOwnership] Token ${tokenId} - Owner is ${owner === BURN_ADDRESS ? 'burned' : 'zero address'}`);
      return {
        isOwner: false,
        owner: owner,
        isBurned: owner.toLowerCase() === BURN_ADDRESS.toLowerCase()
      };
    }
    
    // Check ownership (case-insensitive)
    const isOwner = owner.toLowerCase() === address.toLowerCase();
    
    console.log(`✅ [verifyOwnership] Token ${tokenId} - Address ${address} isOwner: ${isOwner} (owner: ${owner})`);
    
    return {
      isOwner,
      owner: owner,
      isBurned: false
    };
  } catch (err) {
    console.error(`❌ [verifyOwnership] Error verifying ownership for token ${tokenId}:`, err);
    throw new Error(`Failed to verify ownership: ${err.message}`);
  }
}

/**
 * Verify if an address is the recipient of a product (i.e., current owner)
 * Also retrieves sender information from transfer history
 * @param {ethers.Provider} provider - Ethers provider instance
 * @param {string|number} tokenId - Token ID to check
 * @param {string} recipientAddress - Address to check if they're the recipient
 * @returns {Promise<{isRecipient: boolean, sender: string|null, transferTimestamp: number|null, currentOwner: string}>}
 */
export async function verifyReceipt(provider, tokenId, recipientAddress) {
  try {
    const owner = await productNFTService.ownerOf(provider, tokenId);
    const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
    
    // Check if burned
    if (owner.toLowerCase() === BURN_ADDRESS.toLowerCase()) {
      return {
        isRecipient: false,
        sender: null,
        transferTimestamp: null,
        currentOwner: owner,
        isBurned: true
      };
    }
    
    // Check if recipient is the current owner
    const isRecipient = owner.toLowerCase() === recipientAddress.toLowerCase();
    
    if (!isRecipient) {
      return {
        isRecipient: false,
        sender: null,
        transferTimestamp: null,
        currentOwner: owner
      };
    }
    
    // Get transfer history to find the sender
    const transferHistory = await productNFTService.getTransferHistory(provider, tokenId);
    
    // Find the most recent transfer TO this recipient
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    let sender = null;
    let transferTimestamp = null;
    
    // Sort by timestamp descending to get most recent first
    const sortedHistory = [...transferHistory].sort((a, b) => 
      Number(b.timestamp) - Number(a.timestamp)
    );
    
    for (const transfer of sortedHistory) {
      // Find the transfer where this address is the recipient (to field)
      if (transfer.to && transfer.to.toLowerCase() === recipientAddress.toLowerCase()) {
        // Skip mint transfers (from zero address)
        if (transfer.from && transfer.from.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
          sender = transfer.from;
          transferTimestamp = Number(transfer.timestamp);
          break;
        }
      }
    }
    
    return {
      isRecipient: true,
      sender: sender,
      transferTimestamp: transferTimestamp,
      currentOwner: owner,
      isBurned: false
    };
  } catch (err) {
    console.error('Error verifying receipt:', err);
    throw new Error(`Failed to verify receipt: ${err.message}`);
  }
}

/**
 * Validate Ethereum address format
 * @param {string} address - Address to validate
 * @returns {boolean}
 */
export function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Format address for display
 * @param {string} address - Address to format
 * @param {number} startChars - Number of start characters to show (default: 6)
 * @param {number} endChars - Number of end characters to show (default: 4)
 * @returns {string}
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
  if (!address) return 'N/A';
  if (address.length <= startChars + endChars) return address;
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

