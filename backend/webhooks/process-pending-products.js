import { ethers } from 'ethers';
import { getPendingProducts, updatePendingProduct } from './incoming-product-service.js';
import { uploadProductMetadata } from '../../frontend/src/utils/ipfs.js';

// Note: This is a simplified version. In production, you'd need to:
// 1. Get signer from wallet connection or relayer service
// 2. Import contract helpers properly
// 3. Handle errors more gracefully

/**
 * Process pending product creation requests
 * This should be called from the frontend when producer approves
 */
export async function processPendingProduct(pendingProductId, signer) {
  if (!signer) {
    throw new Error('Signer is required to create products on blockchain');
  }

  // Get pending product
  const { getAllPendingProducts } = await import('./incoming-product-service.js');
  const allPending = await getAllPendingProducts();
  const pendingProduct = allPending.find(p => p.id === pendingProductId);

  if (!pendingProduct) {
    throw new Error('Pending product not found');
  }

  if (pendingProduct.status !== 'pending') {
    throw new Error(`Product already processed (status: ${pendingProduct.status})`);
  }

  try {
    // Update status to processing
    await updatePendingProduct(pendingProductId, { status: 'processing' });

    // Upload metadata to IPFS
    console.log(`📤 Uploading metadata to IPFS for product: ${pendingProduct.productData.name}`);
    
    // Note: uploadProductMetadata is a frontend utility
    // In production, you might want to create a backend version or use a service
    // For now, we'll need to import it or recreate the logic
    const metadataResult = await uploadProductMetadata(pendingProduct.productData);
    
    if (!metadataResult.success) {
      throw new Error('Failed to upload metadata to IPFS');
    }

    // Create product on blockchain
    console.log(`⛓️ Creating product on blockchain...`);
    const { supplyChainService } = await import('../../frontend/src/utils/contractHelpers.js');
    
    const result = await supplyChainService.createProduct(
      signer,
      metadataResult.ipfsUrl,
      pendingProduct.productData.productType || 'physical',
      pendingProduct.productData.warrantyPeriod || 365
    );

    // Update status to completed
    await updatePendingProduct(pendingProductId, {
      status: 'completed',
      processedAt: new Date().toISOString(),
      tokenId: result.tokenId?.toString() || null,
      txHash: result.tx?.hash || null
    });

    console.log(`✅ Product created successfully: Token ID ${result.tokenId}`);

    return {
      success: true,
      tokenId: result.tokenId,
      txHash: result.tx?.hash,
      pendingProduct
    };
  } catch (error) {
    console.error(`❌ Error processing pending product ${pendingProductId}:`, error);
    
    // Update status to failed
    await updatePendingProduct(pendingProductId, {
      status: 'failed',
      processedAt: new Date().toISOString(),
      error: error.message
    });

    throw error;
  }
}

