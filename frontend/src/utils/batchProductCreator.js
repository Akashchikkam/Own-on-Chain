import { uploadProductMetadata } from './ipfs';
import { supplyChainService } from './contractHelpers';

/**
 * Batch Product Creator - Optimized for high-speed creation (50+ products/minute)
 * 
 * Features:
 * - Parallel IPFS uploads
 * - Transaction queue (no waiting for confirmations)
 * - Progress tracking
 * - Error recovery
 */

/**
 * Create multiple products in batch
 * @param {Object} signer - Ethers signer
 * @param {Array} productDataArray - Array of product data objects
 * @param {Function} onProgress - Progress callback (index, total, status, result)
 * @returns {Promise<Array>} Array of results
 */
export async function createProductsBatch(signer, productDataArray, onProgress) {
  const results = [];
  const total = productDataArray.length;
  
  console.log(`🚀 Starting batch creation of ${total} products...`);
  
  // Step 1: Upload all metadata to IPFS in parallel
  console.log('📤 Step 1: Uploading metadata to IPFS (parallel)...');
  const ipfsPromises = productDataArray.map(async (productData, index) => {
    try {
      const result = await uploadProductMetadata(productData);
      if (onProgress) {
        onProgress(index, total, 'ipfs_uploaded', { success: result.success, ipfsUrl: result.ipfsUrl });
      }
      return { index, success: result.success, ipfsUrl: result.ipfsUrl, productData, error: null };
    } catch (error) {
      console.error(`❌ IPFS upload failed for product ${index}:`, error);
      if (onProgress) {
        onProgress(index, total, 'ipfs_failed', { error: error.message });
      }
      return { index, success: false, ipfsUrl: null, productData, error: error.message };
    }
  });
  
  const ipfsResults = await Promise.all(ipfsPromises);
  console.log(`✅ IPFS uploads complete: ${ipfsResults.filter(r => r.success).length}/${total} successful`);
  
  // Step 2: Create products on blockchain (queue transactions, don't wait)
  console.log('⛓️ Step 2: Creating products on blockchain (queued)...');
  
  // Create transactions sequentially (required for nonce management)
  // But don't wait for confirmations - just send and track
  for (let index = 0; index < ipfsResults.length; index++) {
    const ipfsResult = ipfsResults[index];
    if (!ipfsResult.success) {
      results[index] = {
        index,
        success: false,
        tokenId: null,
        txHash: null,
        error: `IPFS upload failed: ${ipfsResult.error}`,
        ipfsUrl: null
      };
      if (onProgress) {
        onProgress(index, total, 'blockchain_skipped', results[index]);
      }
      continue; // Skip to next product
    }
    
    try {
      // Create product without waiting for confirmation
      const { getSupplyChainContract } = await import('./contractHelpers');
      const contract = await getSupplyChainContract(signer);
      const warrantySeconds = (ipfsResult.productData.warrantyPeriod || 365) * 24 * 60 * 60;
      
      // Send transaction (ethers.js handles nonce automatically)
      const tx = await contract.createProduct(
        ipfsResult.ipfsUrl,
        ipfsResult.productData.productType || 'physical',
        warrantySeconds
      );
      
      console.log(`✅ Transaction ${index} sent: ${tx.hash}`);
      
      results[index] = {
        index,
        success: true,
        tokenId: null, // Will be extracted from receipt later
        txHash: tx.hash,
        error: null,
        ipfsUrl: ipfsResult.ipfsUrl,
        tx: tx
      };
      
      if (onProgress) {
        onProgress(index, total, 'blockchain_sent', results[index]);
      }
      
      // Wait for confirmation in background (non-blocking)
      tx.wait()
        .then((receipt) => {
          // Extract tokenId from event
          const event = receipt.logs.find(log => {
            try {
              const parsed = contract.interface.parseLog(log);
              return parsed && parsed.name === 'ProductManufactured';
            } catch (e) {
              return false;
            }
          });
          
          if (event) {
            const parsed = contract.interface.parseLog(event);
            const tokenId = parsed.args.tokenId;
            results[index].tokenId = tokenId.toString();
            console.log(`✅ Product ${index} confirmed: Token ID ${tokenId}`);
            if (onProgress) {
              onProgress(index, total, 'blockchain_confirmed', results[index]);
            }
          }
        })
        .catch((error) => {
          console.error(`❌ Transaction ${index} failed:`, error);
          results[index].success = false;
          results[index].error = error.message;
          if (onProgress) {
            onProgress(index, total, 'blockchain_failed', results[index]);
          }
        });
    } catch (error) {
      console.error(`❌ Blockchain creation failed for product ${index}:`, error);
      results[index] = {
        index,
        success: false,
        tokenId: null,
        txHash: null,
        error: error.message,
        ipfsUrl: ipfsResult.ipfsUrl
      };
      if (onProgress) {
        onProgress(index, total, 'blockchain_failed', results[index]);
      }
    }
  }
  
  console.log(`✅ Batch creation complete: ${results.filter(r => r.success).length}/${total} products created`);
  
  return results;
}

/**
 * Create products with template data (for rapid creation)
 * @param {Object} signer - Ethers signer
 * @param {Object} template - Template product data
 * @param {Number} count - Number of products to create
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Results
 */
export async function createProductsFromTemplate(signer, template, count, onProgress) {
  const productDataArray = [];
  
  for (let i = 0; i < count; i++) {
    productDataArray.push({
      ...template,
      name: `${template.name} #${i + 1}`,
      serialNumber: `${template.serialNumber || 'SN'}-${String(i + 1).padStart(6, '0')}`,
      description: template.description || `Product ${i + 1} created via batch creation`
    });
  }
  
  return await createProductsBatch(signer, productDataArray, onProgress);
}

