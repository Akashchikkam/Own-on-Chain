import { ethers } from 'ethers';
import { loadContractAddresses, CONTRACT_ADDRESSES, LOCALHOST_ADDRESSES, SEPOLIA_ADDRESSES } from '../contracts/config';

// Import ABIs as JavaScript modules
import ParticipantRegistryABI from '../contracts/ParticipantRegistry.js';
import ProductNFTABI from '../contracts/ProductNFT.js';
import SupplyChainABI from '../contracts/SupplyChain.js';

let contractAddresses = null;
let addressesPromise = null;

// Initialize contract addresses (cached to avoid repeated calls)
export async function initAddresses() {
  // Return cached addresses if available
  if (contractAddresses) {
    return contractAddresses;
  }
  
  // If already loading, wait for that promise
  if (addressesPromise) {
    return addressesPromise;
  }
  
  // Start loading addresses
  addressesPromise = (async () => {
    // loadContractAddresses will detect the actual network from chainId
    // So we don't need to pass network here
    contractAddresses = await loadContractAddresses();
    const detectedNetwork = (contractAddresses.SupplyChain === LOCALHOST_ADDRESSES.SupplyChain) ? 'localhost' : 
                           (contractAddresses.SupplyChain === SEPOLIA_ADDRESSES.SupplyChain) ? 'sepolia' : 'unknown';
    console.log(`🔍 [initAddresses] Detected network: ${detectedNetwork}`);
    console.log('🔗 Contract addresses initialized:', contractAddresses);
    console.log(`🔗 SupplyChain address: ${contractAddresses.SupplyChain}`);
    
    // Validate addresses
    if (!contractAddresses.ParticipantRegistry || 
        !contractAddresses.ProductNFT || 
        !contractAddresses.SupplyChain) {
      console.error('❌ Invalid contract addresses:', contractAddresses);
      throw new Error('Contract addresses not properly configured. Please deploy contracts first.');
    }
    
    // CRITICAL: Verify SupplyChain address matches expected new contract
    const expectedSepoliaAddress = '0xfef50a2a46C7E89B108F9d5986B5BC72767B8c6B';
    if (detectedNetwork === 'sepolia' && contractAddresses.SupplyChain.toLowerCase() !== expectedSepoliaAddress.toLowerCase()) {
      console.error(`❌ [initAddresses] WRONG SUPPLYCHAIN ADDRESS!`);
      console.error(`   Current: ${contractAddresses.SupplyChain}`);
      console.error(`   Expected: ${expectedSepoliaAddress}`);
      console.error(`   This will cause products to be created in the wrong contract!`);
    }
    
    return contractAddresses;
  })();
  
  return addressesPromise;
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

  // Get transfer history (from SupplyChain recorded transfers + ERC721 Transfer events)
  async getTransferHistory(provider, tokenId) {
    const contract = await getProductNFTContract(provider);
    
    // Get recorded transfers from SupplyChain
    let recordedTransfers = [];
    try {
      recordedTransfers = await contract.getTransferHistory(tokenId);
      console.log('📋 Recorded transfers from SupplyChain:', recordedTransfers.length);
    } catch (err) {
      console.warn('⚠️ Could not get recorded transfers:', err);
    }
    
    // Also get ERC721 Transfer events (catches all transfers, including direct ones)
    let events = [];
    try {
      // Transfer event signature: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
      const filter = contract.filters.Transfer(null, null, tokenId);
      events = await contract.queryFilter(filter);
      console.log('📋 ERC721 Transfer events found:', events.length);
    } catch (err) {
      console.warn('⚠️ Could not query Transfer events:', err);
    }
    
    // Combine both sources, avoiding duplicates
    const transferMap = new Map();
    
    // Add recorded transfers first
    for (const transfer of recordedTransfers) {
      const key = `${transfer.from.toLowerCase()}-${transfer.to.toLowerCase()}-${transfer.timestamp.toString()}`;
      transferMap.set(key, {
        from: transfer.from,
        to: transfer.to,
        timestamp: transfer.timestamp,
        transferType: transfer.transferType || 'transfer'
      });
    }
    
    // Add ERC721 Transfer events (these catch direct transfers)
    for (const event of events) {
      try {
        const from = event.args.from;
        const to = event.args.to;
        const tokenIdFromEvent = event.args.tokenId;
        
        // Only process if it's for this token
        if (tokenIdFromEvent && tokenIdFromEvent.toString() === tokenId.toString()) {
          const block = await event.getBlock();
          const timestamp = block.timestamp;
          const key = `${from.toLowerCase()}-${to.toLowerCase()}-${timestamp.toString()}`;
          
          // Only add if not already in recorded transfers
          if (!transferMap.has(key)) {
            transferMap.set(key, {
              from: from,
              to: to,
              timestamp: timestamp,
              transferType: 'transfer',
              transactionHash: event.transactionHash
            });
          }
        }
      } catch (eventErr) {
        console.warn('⚠️ Error processing transfer event:', eventErr);
      }
    }
    
    // Sort by timestamp
    const allTransfers = Array.from(transferMap.values()).sort((a, b) => 
      Number(a.timestamp) - Number(b.timestamp)
    );
    
    console.log('📋 Combined transfer history (total):', allTransfers.length);
    
    return allTransfers;
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

  // Generic transfer to any address (returns transaction without waiting)
  async transferTo(signer, tokenId, toAddress, waitForConfirmation = true) {
    const contract = await getProductNFTContract(signer);
    const fromAddress = await signer.getAddress();
    console.log(`🔄 Transferring token ${tokenId} from ${fromAddress} to ${toAddress}`);
    const tx = await contract.transferFrom(fromAddress, toAddress, tokenId);
    if (waitForConfirmation) {
      await tx.wait();
    }
    return tx;
  },
};

// Supply Chain Functions
export const supplyChainService = {
  // Create product (producer only)
  async createProduct(signer, metadataURI, productType, warrantyPeriodDays) {
    // CRITICAL: Log contract address being used
    const addresses = await initAddresses();
    console.log(`🔍 [createProduct] Using SupplyChain contract address: ${addresses.SupplyChain}`);
    console.log(`🔍 [createProduct] Current network: ${import.meta.env.VITE_NETWORK_NAME || 'localhost'}`);
    console.log(`🔍 [createProduct] Contract addresses:`, addresses);
    
    const contract = await getSupplyChainContract(signer);
    
    // Verify contract address matches expected address
    const expectedAddress = addresses.SupplyChain;
    console.log(`🔍 [createProduct] Contract instance address: ${contract.target || contract.address || 'N/A'}`);
    console.log(`🔍 [createProduct] Expected address: ${expectedAddress}`);
    
    if (contract.target && contract.target.toLowerCase() !== expectedAddress.toLowerCase()) {
      console.error(`❌ [createProduct] CONTRACT ADDRESS MISMATCH!`);
      console.error(`   Contract instance: ${contract.target}`);
      console.error(`   Expected: ${expectedAddress}`);
      console.error(`   This means product will be created in wrong contract!`);
    }
    
    const warrantySeconds = warrantyPeriodDays * 24 * 60 * 60;
    console.log(`🔍 [createProduct] Calling createProduct with:`, {
      metadataURI,
      productType,
      warrantySeconds
    });
    
    const tx = await contract.createProduct(metadataURI, productType, warrantySeconds);
    console.log(`✅ [createProduct] Transaction created: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`✅ [createProduct] Transaction confirmed in block: ${receipt.blockNumber}`);
    
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
      const tokenId = parsed.args.tokenId;
      console.log(`✅ [createProduct] Product created with Token ID: ${tokenId}`);
      console.log(`✅ [createProduct] Created in SupplyChain contract at: ${contract.target || contract.address}`);
      return { tx, tokenId };
    }
    
    console.warn(`⚠️ [createProduct] ProductManufactured event not found in logs`);
    return { tx, tokenId: null };
  },

  // Get product details
  async getProduct(provider, tokenId) {
    const contract = await getSupplyChainContract(provider);
    return await contract.getProduct(tokenId);
  },

  // Transfer to distributor (returns transaction without waiting)
  async transferToDistributor(signer, tokenId, distributorAddress, waitForConfirmation = true) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.transferToDistributor(tokenId, distributorAddress);
    if (waitForConfirmation) {
      await tx.wait();
    }
    return tx;
  },

  // Transfer to retailer (returns transaction without waiting)
  async transferToRetailer(signer, tokenId, retailerAddress, waitForConfirmation = true) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.transferToRetailer(tokenId, retailerAddress);
    if (waitForConfirmation) {
      await tx.wait();
    }
    return tx;
  },

  // Sell to buyer (returns transaction without waiting)
  async sellToBuyer(signer, tokenId, buyerAddress, saleDetailsIpfs, waitForConfirmation = true) {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.sellToBuyer(tokenId, buyerAddress, saleDetailsIpfs);
    if (waitForConfirmation) {
      await tx.wait();
    }
    return tx;
  },

  // Batch transfer to distributor (single transaction for multiple products)
  async batchTransferToDistributor(signer, tokenIds, distributorAddress, waitForConfirmation = true) {
    const addresses = await initAddresses();
    const contract = await getSupplyChainContract(signer);
    
    console.log(`🚀 Batch Transfer to Distributor`);
    console.log(`   Contract: ${addresses.SupplyChain}`);
    console.log(`   Products: ${tokenIds.length} (${tokenIds.join(', ')})`);
    console.log(`   Recipient: ${distributorAddress}`);
    
    try {
      // Verify ABI has batch function
      const hasBatchInABI = SupplyChainABI?.abi?.some(item => 
        item.type === 'function' && item.name === 'batchTransferToDistributor'
      );
      
      if (!hasBatchInABI) {
        console.error('❌ Batch function not found in ABI');
        throw new Error('Batch function not available in contract ABI. Please update SupplyChain.js with latest ABI.');
      }
      
      // Call the batch function directly
      const tx = await contract.batchTransferToDistributor(tokenIds, distributorAddress);
      
      console.log(`✅ Transaction created: ${tx.hash}`);
      console.log(`   ⚠️ MetaMask should show ONE transaction request`);
      
      if (waitForConfirmation) {
        await tx.wait();
        console.log(`✅ Transaction confirmed`);
      }
      
      return tx;
    } catch (err) {
      console.error('❌ Batch transfer error:', err);
      
      // Check if it's a "function doesn't exist" error
      const isMissingFunction = (
        err.message?.includes('is not a function') ||
        err.message?.includes('function does not exist') ||
        err.code === 'UNSUPPORTED_OPERATION' ||
        (err.code === 'BAD_DATA' && err.message?.includes('batchTransferToDistributor'))
      ) && !err.message?.includes('Product does not exist') && !err.message?.includes('Invalid product status');
      
      if (isMissingFunction) {
        throw new Error(`Batch function not available at contract ${addresses.SupplyChain}. Please deploy contract with batchTransferToDistributor function.`);
      }
      
      // Handle contract revert errors
      if (err.code === 3 || err.code === 'CALL_EXCEPTION') {
        let revertReason = err.reason || err.message || 'Transaction reverted';
        
        // Try to decode error data
        if (err.data && typeof err.data === 'string' && err.data.startsWith('0x08c379a0')) {
          try {
            const decoded = contract.interface.parseError(err.data);
            if (decoded) {
              revertReason = decoded.args[0] || decoded.name || revertReason;
            }
          } catch (decodeErr) {
            // Use original reason if decoding fails
          }
        }
        
        throw new Error(`Batch transfer failed: ${revertReason}`);
      }
      
      // Re-throw other errors
      throw err;
    }
  },

  // Batch transfer to retailer (single transaction for multiple products)
  async batchTransferToRetailer(signer, tokenIds, retailerAddress, waitForConfirmation = true) {
    const addresses = await initAddresses();
    const contract = await getSupplyChainContract(signer);
    
    console.log(`🚀 Batch Transfer to Retailer`);
    console.log(`   Contract: ${addresses.SupplyChain}`);
    console.log(`   Products: ${tokenIds.length} (${tokenIds.join(', ')})`);
    console.log(`   Recipient: ${retailerAddress}`);
    
    try {
      const tx = await contract.batchTransferToRetailer(tokenIds, retailerAddress);
      console.log(`✅ Transaction created: ${tx.hash}`);
      
      if (waitForConfirmation) {
        await tx.wait();
      }
      
      return tx;
    } catch (err) {
      const isMissingFunction = (
        err.message?.includes('is not a function') ||
        err.code === 'UNSUPPORTED_OPERATION' ||
        (err.code === 'BAD_DATA' && err.message?.includes('batchTransferToRetailer'))
      ) && !err.message?.includes('Product does not exist') && !err.message?.includes('Invalid product status');
      
      if (isMissingFunction) {
        throw new Error(`Batch function not available at contract ${addresses.SupplyChain}. Please deploy contract with batchTransferToRetailer function.`);
      }
      
      if (err.code === 3 || err.code === 'CALL_EXCEPTION') {
        const revertReason = err.reason || err.message || 'Transaction reverted';
        throw new Error(`Batch transfer failed: ${revertReason}`);
      }
      
      throw err;
    }
  },

  // Batch sell to buyer (single transaction for multiple products)
  async batchSellToBuyer(signer, tokenIds, buyerAddress, saleDetailsIpfs, waitForConfirmation = true) {
    const addresses = await initAddresses();
    const contract = await getSupplyChainContract(signer);
    
    console.log(`🚀 Batch Sell to Buyer`);
    console.log(`   Contract: ${addresses.SupplyChain}`);
    console.log(`   Products: ${tokenIds.length} (${tokenIds.join(', ')})`);
    console.log(`   Recipient: ${buyerAddress}`);
    
    try {
      const tx = await contract.batchSellToBuyer(tokenIds, buyerAddress, saleDetailsIpfs);
      console.log(`✅ Transaction created: ${tx.hash}`);
      
      if (waitForConfirmation) {
        await tx.wait();
      }
      
      return tx;
    } catch (err) {
      const isMissingFunction = (
        err.message?.includes('is not a function') ||
        err.code === 'UNSUPPORTED_OPERATION' ||
        (err.code === 'BAD_DATA' && err.message?.includes('batchSellToBuyer'))
      ) && !err.message?.includes('Product does not exist') && !err.message?.includes('Invalid product status');
      
      if (isMissingFunction) {
        throw new Error(`Batch function not available at contract ${addresses.SupplyChain}. Please deploy contract with batchSellToBuyer function.`);
      }
      
      if (err.code === 3 || err.code === 'CALL_EXCEPTION') {
        const revertReason = err.reason || err.message || 'Transaction reverted';
        throw new Error(`Batch transfer failed: ${revertReason}`);
      }
      
      throw err;
    }
  },

  // Fallback: Perform individual transfers (MetaMask will queue them)
  // OPTIMIZED: Always tries batch first for single signature, falls back only if needed
  async _fallbackBatchTransfer(signer, tokenIds, recipientAddress, recipientType, waitForConfirmation = true, saleDetails = null, provider = null) {
    console.log(`📦 Processing ${tokenIds.length} transfers - attempting single signature batch...`);
    
    const senderAddress = await signer.getAddress();
    
    // Get provider from signer if not provided
    const checkProvider = provider || signer.provider;
    if (!checkProvider) {
      throw new Error('Provider is required for ownership checks');
    }
    
    // FIRST: Try batch SupplyChain function if available (SINGLE SIGNATURE!)
    // This will work if batch functions exist, even if some products don't match SupplyChain
    // (The batch function will fail for mismatched products, but we'll handle that)
    try {
      const contract = await getSupplyChainContract(signer);
      let batchFunctionExists = false;
      let batchFunctionName = '';
      
      // Check which batch function exists
      if (recipientType === 'distributor' && contract.batchTransferToDistributor) {
        batchFunctionExists = true;
        batchFunctionName = 'batchTransferToDistributor';
      } else if (recipientType === 'retailer' && contract.batchTransferToRetailer) {
        batchFunctionExists = true;
        batchFunctionName = 'batchTransferToRetailer';
      } else if (recipientType === 'buyer' && contract.batchSellToBuyer) {
        batchFunctionExists = true;
        batchFunctionName = 'batchSellToBuyer';
      }
      
      if (batchFunctionExists) {
        console.log(`✅ Batch function exists! Attempting single-signature batch transfer for all ${tokenIds.length} products...`);
        
        try {
          let batchTx;
          const batchSaleDetails = saleDetails || `Batch transfer - ${tokenIds.length} products`;
          
          if (recipientType === 'distributor') {
            batchTx = await supplyChainService.batchTransferToDistributor(signer, tokenIds, recipientAddress, false);
          } else if (recipientType === 'retailer') {
            batchTx = await supplyChainService.batchTransferToRetailer(signer, tokenIds, recipientAddress, false);
          } else if (recipientType === 'buyer') {
            batchTx = await supplyChainService.batchSellToBuyer(signer, tokenIds, recipientAddress, batchSaleDetails, false);
          }
          
          if (batchTx) {
            console.log(`✅ Batch transfer successful! Single signature for ${tokenIds.length} products.`);
            // Wait for confirmation if requested
            if (waitForConfirmation) {
              await batchTx.wait();
            }
            return batchTx;
          }
        } catch (batchErr) {
          // Batch transfer failed - check if it's due to ownership mismatch
          console.warn(`⚠️ Batch transfer failed: ${batchErr.message}`);
          
          // If it's an ownership error, check each product individually
          if (batchErr.message && batchErr.message.includes('Not current owner')) {
            console.log(`🔍 Ownership mismatch detected. Checking each product individually...`);
            // Fall through to individual transfer logic below
          } else {
            // Other error - rethrow
            throw batchErr;
          }
        }
      } else {
        console.log(`ℹ️ Batch functions not available on deployed contract`);
      }
    } catch (err) {
      console.warn(`⚠️ Batch function check failed: ${err.message}`);
    }
    
    // FALLBACK: Individual transfers (if batch doesn't exist or failed)
    console.log(`📦 Using individual transfers (${tokenIds.length} signatures required)`);
    
    const transactions = [];
    
    // Check all products and group them
    const matchingTokens = [];
    const mismatchedTokens = [];
    
    for (const tokenId of tokenIds) {
      try {
        const supplyChainOwner = await supplyChainService.getCurrentOwner(checkProvider, tokenId);
        const nftOwner = await productNFTService.ownerOf(checkProvider, tokenId);
        
        if (supplyChainOwner.toLowerCase() === nftOwner.toLowerCase() && 
            supplyChainOwner.toLowerCase() === senderAddress.toLowerCase()) {
          matchingTokens.push(tokenId);
        } else {
          mismatchedTokens.push(tokenId);
        }
      } catch (err) {
        mismatchedTokens.push(tokenId);
      }
    }
    
    // Use SupplyChain transfers for matching tokens
    matchingTokens.forEach(tokenId => {
      try {
        let txPromise;
        if (recipientType === 'distributor') {
          txPromise = supplyChainService.transferToDistributor(signer, tokenId, recipientAddress, false);
        } else if (recipientType === 'retailer') {
          txPromise = supplyChainService.transferToRetailer(signer, tokenId, recipientAddress, false);
        } else if (recipientType === 'buyer') {
          const details = saleDetails || `Batch transfer - Product #${tokenId}`;
          txPromise = supplyChainService.sellToBuyer(signer, tokenId, recipientAddress, details, false);
        }
        if (txPromise) {
          transactions.push({ tokenIds: [tokenId], txPromise });
        }
      } catch (err) {
        console.error(`❌ Token ${tokenId} - Failed:`, err);
        mismatchedTokens.push(tokenId);
      }
    });
    
    // Use direct NFT transfers for mismatched tokens
    mismatchedTokens.forEach(tokenId => {
      try {
        const txPromise = productNFTService.transferTo(signer, tokenId, recipientAddress, false);
        transactions.push({ tokenIds: [tokenId], txPromise });
      } catch (err) {
        console.error(`❌ Token ${tokenId} - Failed:`, err);
        transactions.push({ 
          tokenIds: [tokenId], 
          txPromise: Promise.reject(err) 
        });
      }
    });
    
    if (transactions.length === 0) {
      throw new Error('Failed to prepare any transactions');
    }
    
    // Execute all transactions
    const txPromises = transactions.map(t => 
      t.txPromise.then(result => ({ 
        tx: result.tx || result, 
        tokenIds: result.tokenIds || t.tokenIds 
      }))
        .catch(err => ({ err, tokenIds: t.tokenIds }))
    );
    
    const results = await Promise.allSettled(txPromises);
    
    // Check failures
    const failed = results.filter((r, i) => {
      if (r.status === 'rejected') return true;
      if (r.status === 'fulfilled' && r.value.err) return true;
      return false;
    });
    
    if (failed.length > 0) {
      const errorMessages = [];
      results.forEach((result, index) => {
        const { tokenIds } = transactions[index];
        if (result.status === 'rejected') {
          errorMessages.push(`Tokens ${tokenIds.join(', ')}: ${result.reason?.message || result.reason}`);
        } else if (result.status === 'fulfilled' && result.value.err) {
          errorMessages.push(`Tokens ${tokenIds.join(', ')}: ${result.value.err.message || result.value.err}`);
        }
      });
      throw new Error(`Some transfers failed: ${errorMessages.join('; ')}`);
    }
    
    // Get transaction objects and wait for confirmations
    const txObjects = results
      .filter(r => r.status === 'fulfilled' && r.value.tx)
      .map(r => r.value.tx);
    
    if (waitForConfirmation && txObjects.length > 0) {
      await Promise.all(txObjects.map(tx => tx.wait()));
    }
    
    return txObjects[0];
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

