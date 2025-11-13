import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { verifyOwnership, isValidAddress, formatAddress } from '../utils/securityHelpers';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import './SecureSendModal.css';

function BatchTransferModal({ 
  isOpen, 
  onClose, 
  products, // Array of product objects
  provider, 
  signer, 
  account,
  onSuccess,
  onError 
}) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isValidRecipient, setIsValidRecipient] = useState(false);
  const [ownershipStatus, setOwnershipStatus] = useState({}); // { tokenId: { isOwner, checked } }
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState({}); // { tokenId: 'success' | 'failed' | 'pending' }
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [productEligibility, setProductEligibility] = useState({}); // { tokenId: { eligible, reason, status } }
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [recipientRole, setRecipientRole] = useState(null);

  useEffect(() => {
    if (isOpen && products && products.length > 0 && provider && account) {
      checkAllOwnership();
      setRecipientAddress('');
      setError('');
      setShowPreview(false);
      setTransferProgress({});
    }
  }, [isOpen, products, provider, account]);

  const checkAllOwnership = async () => {
    if (!products || products.length === 0 || !provider || !account) return;
    
    try {
      setCheckingOwnership(true);
      const status = {};
      
      for (const product of products) {
        try {
          const result = await verifyOwnership(provider, product.tokenId, account);
          status[product.tokenId] = {
            isOwner: result.isOwner,
            checked: true
          };
        } catch (err) {
          status[product.tokenId] = {
            isOwner: false,
            checked: true,
            error: err.message
          };
        }
      }
      
      setOwnershipStatus(status);
      
      const allOwned = Object.values(status).every(s => s.isOwner);
      if (!allOwned) {
        setError('Some products are not owned by you. Only owned products will be transferred.');
      }
    } catch (err) {
      console.error('Ownership check error:', err);
      setError(`Failed to verify ownership: ${err.message}`);
    } finally {
      setCheckingOwnership(false);
    }
  };

  const handleRecipientChange = async (e) => {
    const address = e.target.value.trim();
    setRecipientAddress(address);
    
    if (address === '') {
      setIsValidRecipient(false);
      setProductEligibility({});
      setRecipientRole(null);
      return;
    }
    
    const isValid = isValidAddress(address);
    setIsValidRecipient(isValid);
    
    if (!isValid && address !== '') {
      setError('Invalid Ethereum address format');
      setProductEligibility({});
      setRecipientRole(null);
    } else if (address.toLowerCase() === account?.toLowerCase()) {
      setError('Cannot transfer to your own address');
      setIsValidRecipient(false);
      setProductEligibility({});
      setRecipientRole(null);
    } else {
      setError('');
      // Pre-validate products when valid recipient is entered
      if (isValid && provider && account) {
        await checkProductEligibility(address);
      }
    }
  };

  const checkProductEligibility = async (recipientAddr) => {
    if (!provider || !account || !recipientAddr) return;
    
    try {
      setCheckingEligibility(true);
      const eligibility = {};
      
      // Get recipient role
      const { participantRegistryService } = await import('../utils/contractHelpers');
      let recipientParticipant;
      try {
        recipientParticipant = await participantRegistryService.getParticipant(provider, recipientAddr);
        const role = Number(recipientParticipant.role);
        setRecipientRole(role);
        
        const ownedProducts = getOwnedProducts();
        
        for (const product of ownedProducts) {
          try {
            // Check if product exists in SupplyChain
            let productData = null;
            let productStatus = null;
            let statusName = 'UNKNOWN';
            
            try {
              productData = await supplyChainService.getProduct(provider, product.tokenId);
              productStatus = Number(productData.status);
              
              const statusNames = {
                0: 'MANUFACTURED',
                1: 'WITH_DISTRIBUTOR',
                2: 'WITH_RETAILER',
                3: 'SOLD_TO_BUYER',
                4: 'RESOLD'
              };
              statusName = statusNames[productStatus] || `UNKNOWN(${productStatus})`;
            } catch (supplyChainErr) {
              // Product doesn't exist in SupplyChain - this is OK for eligibility
              // Products created with old contracts or direct NFT transfers might not be in SupplyChain
              console.log(`ℹ️ Product ${product.tokenId} not in SupplyChain, allowing transfer`);
              eligibility[product.tokenId] = {
                eligible: true, // Allow transfers for products not in SupplyChain
                reason: 'Eligible (not in SupplyChain - direct NFT transfer allowed)',
                status: 'N/A (Not in SupplyChain)',
                statusCode: null
              };
              continue;
            }
            
            // Product exists in SupplyChain - check status eligibility
            const statusNames = {
              0: 'MANUFACTURED',
              1: 'WITH_DISTRIBUTOR',
              2: 'WITH_RETAILER',
              3: 'SOLD_TO_BUYER',
              4: 'RESOLD'
            };
            statusName = statusNames[productStatus] || `UNKNOWN(${productStatus})`;
            
            // Check if status is valid for recipient role
            let isValidStatus = false;
            let requiredStatuses = [];
            
            if (role === 2) { // DISTRIBUTOR
              isValidStatus = productStatus === 0 || productStatus === 1;
              requiredStatuses = ['MANUFACTURED', 'WITH_DISTRIBUTOR'];
            } else if (role === 3) { // RETAILER
              isValidStatus = productStatus === 0 || productStatus === 1 || productStatus === 2;
              requiredStatuses = ['MANUFACTURED', 'WITH_DISTRIBUTOR', 'WITH_RETAILER'];
            } else if (role === 4) { // BUYER
              isValidStatus = productStatus === 0 || productStatus === 1 || productStatus === 2 || productStatus === 3;
              requiredStatuses = ['MANUFACTURED', 'WITH_DISTRIBUTOR', 'WITH_RETAILER', 'SOLD_TO_BUYER'];
            } else {
              // For other roles or unregistered recipients, allow if product exists
              isValidStatus = true;
            }
            
            eligibility[product.tokenId] = {
              eligible: isValidStatus,
              reason: isValidStatus ? 'Eligible' : `Invalid status: ${statusName}. Required: ${requiredStatuses.join(' or ')}`,
              status: statusName,
              statusCode: productStatus
            };
          } catch (err) {
            console.error(`Error checking eligibility for product ${product.tokenId}:`, err);
            // On error, mark as eligible to avoid blocking transfers
            eligibility[product.tokenId] = {
              eligible: true,
              reason: 'Eligible (error during check, allowing transfer)',
              status: 'Unknown',
              statusCode: null
            };
          }
        }
        
        setProductEligibility(eligibility);
        
        const eligibleCount = Object.values(eligibility).filter(e => e.eligible).length;
        const totalOwned = ownedProducts.length;
        
        if (eligibleCount === 0 && totalOwned > 0) {
          setError(`⚠️ None of your selected products are eligible for transfer. Check product statuses below.`);
        } else if (eligibleCount < totalOwned) {
          setError(`⚠️ ${totalOwned - eligibleCount} product(s) are not eligible for transfer. Only ${eligibleCount} product(s) can be transferred.`);
        }
      } catch (err) {
        console.error('Error checking recipient:', err);
        setError(`Failed to verify recipient: ${err.message}`);
        setProductEligibility({});
        setRecipientRole(null);
      }
    } catch (err) {
      console.error('Error checking product eligibility:', err);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handlePreview = () => {
    if (!isValidRecipient) return;
    setShowPreview(true);
  };

  const getOwnedProducts = () => {
    return products.filter(p => ownershipStatus[p.tokenId]?.isOwner === true);
  };

  const handleConfirmTransfer = async () => {
    if (!signer || !products || products.length === 0 || !recipientAddress || !isValidRecipient) return;
    
    const ownedProducts = getOwnedProducts();
    if (ownedProducts.length === 0) {
      setError('No products owned by you to transfer');
      return;
    }
    
    try {
      setTransferring(true);
      setError('');

      // Validate recipient is registered and verified
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      
      let recipientParticipant;
      try {
        recipientParticipant = await participantRegistryService.getParticipant(provider, recipientAddress);
      } catch (err) {
        throw new Error('Recipient is not registered. Only registered and verified participants can receive products.');
      }

      const recipientRole = Number(recipientParticipant.role);
      const recipientStatus = Number(recipientParticipant.status);

      if (recipientStatus !== 1) {
        throw new Error('Recipient is not verified. Only verified participants can receive products.');
      }

      // Initialize progress tracking
      const progress = {};
      ownedProducts.forEach(p => {
        progress[p.tokenId] = 'pending';
      });
      setTransferProgress(progress);

      // CRITICAL: Re-verify ownership right before transfer to ensure we're still the owner
      console.log(`📦 Preparing ${ownedProducts.length} batch transfers...`);
      console.log(`🔍 Re-verifying ownership for all products before transfer...`);
      
      // Log contract addresses for debugging
      const { loadContractAddresses } = await import('../contracts/config');
      const contractAddresses = await loadContractAddresses();
      console.log(`📍 Current contract addresses:`, contractAddresses);
      console.log(`📍 SupplyChain contract: ${contractAddresses.SupplyChain}`);
      console.log(`📍 ProductNFT contract: ${contractAddresses.ProductNFT}`);
      
      const stillOwnedProducts = [];
      const filteredProducts = {
        notOwned: [],
        notInSupplyChain: [],
        invalidStatus: []
      };
      
      console.log(`🔍 Starting validation for ${ownedProducts.length} products...`);
      console.log(`   Current account: ${account}`);
      console.log(`   Recipient role: ${recipientRole} (${recipientRole === 2 ? 'DISTRIBUTOR' : recipientRole === 3 ? 'RETAILER' : recipientRole === 4 ? 'BUYER' : 'UNKNOWN'})`);
      
      for (const product of ownedProducts) {
        try {
          setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'verifying' }));
          
          // CRITICAL: Re-verify ownership immediately before transfer
          const ownershipResult = await verifyOwnership(provider, product.tokenId, account);
          
          if (!ownershipResult.isOwner) {
            console.warn(`⚠️ Product ${product.tokenId} is no longer owned by ${account}. Current owner: ${ownershipResult.owner}`);
            setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'failed' }));
            filteredProducts.notOwned.push({
              tokenId: product.tokenId,
              currentOwner: ownershipResult.owner
            });
            setError(`Product ${product.tokenId} is no longer owned by you. Skipping...`);
            continue;
          }
          
          // CRITICAL: Verify product exists in SupplyChain contract
          // The batch function requires products to exist in SupplyChain (not just ProductNFT)
          try {
            const productData = await supplyChainService.getProduct(provider, product.tokenId);
            console.log(`✅ Product ${product.tokenId} exists in SupplyChain`);
            console.log(`   Product data:`, {
              tokenId: productData.tokenId?.toString(),
              currentOwner: productData.currentOwner,
              status: productData.status?.toString(),
              producer: productData.producer
            });
            
            // CRITICAL: Validate product status for the transfer type
            const productStatus = Number(productData.status);
            const statusNames = {
              0: 'MANUFACTURED',
              1: 'WITH_DISTRIBUTOR',
              2: 'WITH_RETAILER',
              3: 'SOLD_TO_BUYER',
              4: 'RESOLD'
            };
            const statusName = statusNames[productStatus] || `UNKNOWN(${productStatus})`;
            
            console.log(`   Product ${product.tokenId} status: ${statusName} (${productStatus})`);
            
            // Check if status is valid for the transfer type
            let isValidStatus = false;
            let requiredStatuses = [];
            
            // recipientRole is a number: 2=DISTRIBUTOR, 3=RETAILER, 4=BUYER
            if (recipientRole === 2) { // Role.DISTRIBUTOR
              // For distributor transfer: only MANUFACTURED (0) or WITH_DISTRIBUTOR (1) allowed
              isValidStatus = productStatus === 0 || productStatus === 1;
              requiredStatuses = ['MANUFACTURED', 'WITH_DISTRIBUTOR'];
            } else if (recipientRole === 3) { // Role.RETAILER
              // For retailer transfer: MANUFACTURED (0), WITH_DISTRIBUTOR (1), or WITH_RETAILER (2) allowed
              isValidStatus = productStatus === 0 || productStatus === 1 || productStatus === 2;
              requiredStatuses = ['MANUFACTURED', 'WITH_DISTRIBUTOR', 'WITH_RETAILER'];
            } else if (recipientRole === 4) { // Role.BUYER
              // For buyer sale: MANUFACTURED (0), WITH_DISTRIBUTOR (1), WITH_RETAILER (2), or SOLD_TO_BUYER (3) allowed
              isValidStatus = productStatus === 0 || productStatus === 1 || productStatus === 2 || productStatus === 3;
              requiredStatuses = ['MANUFACTURED', 'WITH_DISTRIBUTOR', 'WITH_RETAILER', 'SOLD_TO_BUYER'];
            } else {
              // Default: allow all statuses for other roles
              isValidStatus = true;
            }
            
            if (!isValidStatus) {
              console.error(`❌ Product ${product.tokenId} has invalid status for ${recipientRole} transfer`);
              console.error(`   Current status: ${statusName} (${productStatus})`);
              console.error(`   Required statuses: ${requiredStatuses.join(', ')}`);
              console.error(`   This product cannot be transferred to ${recipientRole} in its current state.`);
              setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'failed' }));
              filteredProducts.invalidStatus.push({
                tokenId: product.tokenId,
                currentStatus: statusName,
                requiredStatuses: requiredStatuses
              });
              setError(`Product ${product.tokenId} has invalid status (${statusName}) for ${recipientRole} transfer. Required: ${requiredStatuses.join(' or ')}.`);
              continue;
            }
            
            console.log(`✅ Product ${product.tokenId} status validated: ${statusName} is valid for ${recipientRole} transfer`);
          } catch (supplyChainErr) {
            if (supplyChainErr.message && supplyChainErr.message.includes('Product does not exist')) {
              console.error(`❌ Product ${product.tokenId} does NOT exist in SupplyChain contract`);
              console.error(`   Contract address: ${contractAddresses.SupplyChain}`);
              console.error(`   This product exists in ProductNFT but is not registered in SupplyChain.`);
              console.error(`   Possible causes:`);
              console.error(`   1. Product was created with an older SupplyChain contract`);
              console.error(`   2. Contract address changed after product creation`);
              console.error(`   3. Product was created directly in ProductNFT (shouldn't be possible)`);
              console.error(`   Only products created through SupplyChain.createProduct() can be batch transferred.`);
              setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'failed' }));
              filteredProducts.notInSupplyChain.push({
                tokenId: product.tokenId
              });
              setError(`Product ${product.tokenId} is not registered in SupplyChain contract at ${contractAddresses.SupplyChain}. Cannot batch transfer.`);
              continue;
            }
            // Re-throw other errors
            throw supplyChainErr;
          }
          
          stillOwnedProducts.push(product);
        } catch (err) {
          console.error(`Failed to verify product ${product.tokenId}:`, err);
          setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'failed' }));
          setError(`Failed to verify product ${product.tokenId}: ${err.message}`);
          continue;
        }
      }
      
      // Log summary
      console.log(`\n📊 Validation Summary:`);
      console.log(`   Total products checked: ${ownedProducts.length}`);
      console.log(`   ✅ Valid products: ${stillOwnedProducts.length}`);
      console.log(`   ❌ Filtered out: ${ownedProducts.length - stillOwnedProducts.length}`);
      if (filteredProducts.notOwned.length > 0) {
        console.log(`      - Not owned: ${filteredProducts.notOwned.length} products`);
        filteredProducts.notOwned.forEach(p => console.log(`        • Product ${p.tokenId}: owned by ${p.currentOwner}`));
      }
      if (filteredProducts.notInSupplyChain.length > 0) {
        console.log(`      - Not in SupplyChain: ${filteredProducts.notInSupplyChain.length} products`);
        filteredProducts.notInSupplyChain.forEach(p => console.log(`        • Product ${p.tokenId}`));
      }
      if (filteredProducts.invalidStatus.length > 0) {
        console.log(`      - Invalid status: ${filteredProducts.invalidStatus.length} products`);
        filteredProducts.invalidStatus.forEach(p => console.log(`        • Product ${p.tokenId}: ${p.currentStatus}, required: ${p.requiredStatuses.join(' or ')}`));
      }
      console.log(`\n`);
      
      if (stillOwnedProducts.length === 0) {
        const roleName = recipientRole === 2 ? 'distributor' : recipientRole === 3 ? 'retailer' : recipientRole === 4 ? 'buyer' : 'recipient';
        const requiredStatuses = recipientRole === 2 
          ? 'MANUFACTURED or WITH_DISTRIBUTOR'
          : recipientRole === 3
          ? 'MANUFACTURED, WITH_DISTRIBUTOR, or WITH_RETAILER'
          : recipientRole === 4
          ? 'MANUFACTURED, WITH_DISTRIBUTOR, WITH_RETAILER, or SOLD_TO_BUYER'
          : 'any valid status';
        
        // Build detailed error message
        let errorDetails = [];
        if (filteredProducts.notOwned.length > 0) {
          errorDetails.push(`\n❌ ${filteredProducts.notOwned.length} product(s) not owned by you:`);
          filteredProducts.notOwned.forEach(p => {
            errorDetails.push(`   - Product ${p.tokenId}: owned by ${p.currentOwner}`);
          });
        }
        if (filteredProducts.notInSupplyChain.length > 0) {
          errorDetails.push(`\n❌ ${filteredProducts.notInSupplyChain.length} product(s) not in SupplyChain:`);
          filteredProducts.notInSupplyChain.forEach(p => {
            errorDetails.push(`   - Product ${p.tokenId}: not registered in SupplyChain`);
          });
        }
        if (filteredProducts.invalidStatus.length > 0) {
          errorDetails.push(`\n❌ ${filteredProducts.invalidStatus.length} product(s) with invalid status:`);
          filteredProducts.invalidStatus.forEach(p => {
            errorDetails.push(`   - Product ${p.tokenId}: status ${p.currentStatus}, required: ${p.requiredStatuses.join(' or ')}`);
          });
        }
        
        const errorMsg = `No valid products found for batch transfer to ${roleName}.${errorDetails.join('\n')}

📊 Summary:
- Total products checked: ${ownedProducts.length}
- Products passed validation: ${stillOwnedProducts.length}
- Products filtered out: ${ownedProducts.length - stillOwnedProducts.length}

🔍 Check the browser console for detailed validation logs for each product.

✅ Solution: Select products that:
1. Are owned by you (current account: ${account})
2. Exist in SupplyChain contract at ${contractAddresses.SupplyChain}
3. Have status: ${requiredStatuses}`;
        throw new Error(errorMsg);
      }
      
      console.log(`✅ ${stillOwnedProducts.length} products verified and ready for transfer`);
      
      // Filter products based on pre-validation eligibility if available
      let productsToTransfer = stillOwnedProducts;
      if (Object.keys(productEligibility).length > 0) {
        productsToTransfer = stillOwnedProducts.filter(p => {
          const eligibility = productEligibility[p.tokenId];
          return eligibility && eligibility.eligible;
        });
        
        if (productsToTransfer.length < stillOwnedProducts.length) {
          console.log(`⚠️ Filtered ${stillOwnedProducts.length - productsToTransfer.length} products based on pre-validation`);
          console.log(`   Eligible products: ${productsToTransfer.map(p => p.tokenId).join(', ')}`);
        }
      }
      
      if (productsToTransfer.length === 0) {
        const roleName = recipientRole === 2 ? 'distributor' : recipientRole === 3 ? 'retailer' : recipientRole === 4 ? 'buyer' : 'recipient';
        throw new Error(`No eligible products found for batch transfer to ${roleName}. Please check product statuses above.`);
      }
      
      // Use batch transfer function for single signature
      const tokenIds = productsToTransfer.map(p => p.tokenId);
      const saleDetails = `Batch transfer - ${productsToTransfer.length} products`;
      
      setTransferProgress(prev => {
        const updated = { ...prev };
        productsToTransfer.forEach(p => {
          updated[p.tokenId] = 'preparing';
        });
        return updated;
      });
      
      let tx;
      try {
        console.log(`🚀 Attempting batch transfer for ${tokenIds.length} products...`);
        console.log(`📋 Products: ${tokenIds.join(', ')}`);
        console.log(`👤 Recipient: ${recipientAddress}`);
        console.log(`🏷️ Role: ${recipientRole}`);
        console.log(`⚠️ IMPORTANT: This should create ONE transaction requiring ONE MetaMask signature`);
        
        // Use appropriate batch SupplyChain method based on recipient role
        // recipientRole is a number: 2=DISTRIBUTOR, 3=RETAILER, 4=BUYER
        if (recipientRole === 2) { // Role.DISTRIBUTOR
          tx = await supplyChainService.batchTransferToDistributor(signer, tokenIds, recipientAddress, false);
        } else if (recipientRole === 3) { // Role.RETAILER
          tx = await supplyChainService.batchTransferToRetailer(signer, tokenIds, recipientAddress, false);
        } else if (recipientRole === 4) { // Role.BUYER
          tx = await supplyChainService.batchSellToBuyer(signer, tokenIds, recipientAddress, saleDetails, false);
        } else {
          // Fallback to batch sell to buyer for other roles
          tx = await supplyChainService.batchSellToBuyer(signer, tokenIds, recipientAddress, saleDetails, false);
        }
        
        console.log(`✅ Batch transfer transaction created! Hash: ${tx.hash}`);
        console.log(`✅ Transaction object:`, tx);
        console.log(`⚠️ CHECK METAMASK: You should see ONE transaction request`);
        console.log(`⚠️ If you see multiple requests, the batch function is not working`);
        
      } catch (err) {
        // Log the full error for debugging
        console.error('❌ Batch transfer error:', err);
        console.error('   Error code:', err.code);
        console.error('   Error message:', err.message);
        console.error('   Error data:', err.data);
        console.error('   Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        
        // Check if error indicates batch functions not available
        if (err.message && (
          err.message.includes('not available') || 
          err.message.includes('not deployed') ||
          err.message.includes('Please redeploy') ||
          err.message.includes('does not exist on contract')
        )) {
          // Batch function doesn't exist
          setError(`❌ Batch functions not available on deployed contract. You'll need to sign ${productsToTransfer.length} transactions. Please redeploy the SupplyChain contract with batch functions for single-signature batch transfers.`);
          setTransferring(false);
          return;
        }
        
        // Update all products to failed
        setTransferProgress(prev => {
          const updated = { ...prev };
          productsToTransfer.forEach(p => {
            updated[p.tokenId] = 'failed';
          });
          return updated;
        });
        
        const errorMessage = err.message || 'Failed to transfer products';
        setError(`Batch transfer failed: ${errorMessage}. Check console for details.`);
        if (onError) {
          onError(errorMessage);
        }
        return;
      }
      
      // Update all products to transferring
      setTransferProgress(prev => {
        const updated = { ...prev };
        stillOwnedProducts.forEach(p => {
          updated[p.tokenId] = 'transferring';
        });
        return updated;
      });
      
      // Wait for confirmation (single transaction in batch mode, multiple in fallback)
      try {
        await tx.wait();
        
        // All products transferred successfully
        setTransferProgress(prev => {
          const updated = { ...prev };
          productsToTransfer.forEach(p => {
            updated[p.tokenId] = 'success';
          });
          return updated;
        });
        
        if (onSuccess) {
          onSuccess(`${productsToTransfer.length} product(s) transferred successfully!`);
        }
        
        handleClose();
      } catch (waitErr) {
        console.error('Error waiting for transaction confirmation:', waitErr);
        setTransferProgress(prev => {
          const updated = { ...prev };
          productsToTransfer.forEach(p => {
            updated[p.tokenId] = 'failed';
          });
          return updated;
        });
        setError(`Transaction failed: ${waitErr.message}`);
        if (onError) {
          onError(`Transaction failed: ${waitErr.message}`);
        }
      }
    } catch (err) {
      console.error('Batch transfer error:', err);
      const errorMessage = err.message || 'Failed to transfer products';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setTransferring(false);
    }
  };

  const handleClose = () => {
      setRecipientAddress('');
      setError('');
      setShowPreview(false);
      setOwnershipStatus({});
      setTransferProgress({});
      setProductEligibility({});
      setRecipientRole(null);
      onClose();
  };

  if (!isOpen) return null;

  const ownedProducts = getOwnedProducts();

  return (
    <div className="secure-modal-overlay" onClick={handleClose}>
      <div className="secure-modal-content batch-transfer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="secure-modal-header">
          <h2>📦 Batch Transfer ({products.length} products)</h2>
          <button className="secure-modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="secure-modal-body">
          {/* Products List */}
          <div className="batch-products-list">
            <h3>Scanned Products</h3>
            <div className="products-list-container">
              {products.map((product) => {
                const status = ownershipStatus[product.tokenId];
                const progress = transferProgress[product.tokenId];
                const eligibility = productEligibility[product.tokenId];
                const productName = product.metadata?.name || `Product #${product.tokenId}`;
                
                return (
                  <div 
                    key={product.tokenId} 
                    className="batch-product-item"
                    style={{
                      opacity: eligibility && !eligibility.eligible ? 0.6 : 1,
                      borderLeft: eligibility && !eligibility.eligible ? '3px solid #ff9800' : eligibility && eligibility.eligible ? '3px solid #4CAF50' : undefined
                    }}
                  >
                    <div className="product-item-info">
                      <span className="product-name">{productName}</span>
                      <span className="product-token-id">Token ID: {product.tokenId}</span>
                      {eligibility && (
                        <span style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
                          Status: {eligibility.status}
                        </span>
                      )}
                    </div>
                    <div className="product-item-status">
                      {checkingOwnership ? (
                        <span className="status-checking">Checking...</span>
                      ) : status?.checked ? (
                        status.isOwner ? (
                          <span className="status-owner">✓ Owned</span>
                        ) : (
                          <span className="status-not-owner">✗ Not owned</span>
                        )
                      ) : (
                        <span className="status-unknown">?</span>
                      )}
                      {checkingEligibility && status?.isOwner && (
                        <span className="status-checking" style={{ marginLeft: '0.5rem' }}>Checking eligibility...</span>
                      )}
                      {eligibility && status?.isOwner && (
                        eligibility.eligible ? (
                          <span className="status-owner" style={{ marginLeft: '0.5rem' }}>✓ Eligible</span>
                        ) : (
                          <span className="status-not-owner" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }} title={eligibility.reason}>
                            ✗ {eligibility.reason.substring(0, 30)}...
                          </span>
                        )
                      )}
                      {progress === 'verifying' && <span className="status-verifying">Verifying...</span>}
                      {progress === 'transferring' && <span className="status-transferring">Transferring...</span>}
                      {progress === 'success' && <span className="status-success">✓ Transferred</span>}
                      {progress === 'failed' && <span className="status-failed">✗ Failed</span>}
                      {progress === 'preparing' && <span className="status-preparing">Preparing...</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="owned-count">
              {ownedProducts.length} of {products.length} products owned by you
              {recipientRole !== null && Object.keys(productEligibility).length > 0 && (
                <span style={{ marginLeft: '1rem', color: '#4CAF50' }}>
                  • {Object.values(productEligibility).filter(e => e.eligible).length} eligible for transfer
                </span>
              )}
            </div>
          </div>

          {!showPreview && ownedProducts.length > 0 && (
            <>
              {/* Recipient Input */}
              <div className="recipient-input-section">
                <label htmlFor="recipient-address">Recipient Address</label>
                <input
                  id="recipient-address"
                  type="text"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={handleRecipientChange}
                  className={isValidRecipient ? 'valid' : recipientAddress ? 'invalid' : ''}
                />
                {recipientAddress && (
                  <div className="address-preview">
                    {formatAddress(recipientAddress)}
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="secure-modal-actions">
                <button className="btn btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handlePreview}
                  disabled={!isValidRecipient || transferring || ownedProducts.length === 0 || checkingEligibility || (Object.keys(productEligibility).length > 0 && Object.values(productEligibility).filter(e => e.eligible).length === 0)}
                >
                  {checkingEligibility ? 'Checking Eligibility...' : 'Preview Transfer'}
                </button>
              </div>
            </>
          )}

          {showPreview && (
            <>
              {/* Transaction Preview */}
              <div className="transaction-preview">
                <h3>Batch Transfer Preview</h3>
                <div className="preview-grid">
                  <div className="preview-item">
                    <span className="preview-label">From:</span>
                    <span className="preview-value">{formatAddress(account)}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">To:</span>
                    <span className="preview-value">{formatAddress(recipientAddress)}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Products:</span>
                    <span className="preview-value">
                      {Object.keys(productEligibility).length > 0 
                        ? `${Object.values(productEligibility).filter(e => e.eligible).length} eligible product(s)` 
                        : `${ownedProducts.length} product(s)`}
                    </span>
                  </div>
                </div>
                {(Object.keys(productEligibility).length > 0 ? Object.values(productEligibility).filter(e => e.eligible).length : ownedProducts.length) > 1 && (
                  <div className="preview-info" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9rem', color: '#000000' }}>
                    ✅ <strong>Batch Transfer:</strong> All {Object.keys(productEligibility).length > 0 ? Object.values(productEligibility).filter(e => e.eligible).length : ownedProducts.length} products will be transferred in a single transaction requiring 1 signature.
                  </div>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="secure-modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPreview(false)}
                  disabled={transferring}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmTransfer}
                  disabled={!isValidRecipient || transferring || ownedProducts.length === 0 || checkingEligibility || (Object.keys(productEligibility).length > 0 && Object.values(productEligibility).filter(e => e.eligible).length === 0)}
                >
                  {transferring ? (
                    <>
                      <span className="loading"></span> Transferring...
                    </>
                  ) : (
                    `Transfer ${Object.keys(productEligibility).length > 0 ? Object.values(productEligibility).filter(e => e.eligible).length : ownedProducts.length} Product(s)`
                  )}
                </button>
              </div>
            </>
          )}

          {ownedProducts.length === 0 && !checkingOwnership && (
            <div className="error-message">
              No products owned by you. Cannot proceed with transfer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchTransferModal;

