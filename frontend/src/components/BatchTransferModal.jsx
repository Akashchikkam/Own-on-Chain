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

  const handleRecipientChange = (e) => {
    const address = e.target.value.trim();
    setRecipientAddress(address);
    
    if (address === '') {
      setIsValidRecipient(false);
      return;
    }
    
    const isValid = isValidAddress(address);
    setIsValidRecipient(isValid);
    
    if (!isValid && address !== '') {
      setError('Invalid Ethereum address format');
    } else if (address.toLowerCase() === account?.toLowerCase()) {
      setError('Cannot transfer to your own address');
      setIsValidRecipient(false);
    } else {
      setError('');
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
      for (const product of ownedProducts) {
        try {
          setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'verifying' }));
          
          // CRITICAL: Re-verify ownership immediately before transfer
          const ownershipResult = await verifyOwnership(provider, product.tokenId, account);
          
          if (!ownershipResult.isOwner) {
            console.warn(`⚠️ Product ${product.tokenId} is no longer owned by ${account}. Current owner: ${ownershipResult.owner}`);
            setTransferProgress(prev => ({ ...prev, [product.tokenId]: 'failed' }));
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
      
      if (stillOwnedProducts.length === 0) {
        const errorMsg = `No valid products found for batch transfer. All products either:
- Are not owned by you
- Do not exist in SupplyChain contract at ${contractAddresses.SupplyChain}

🔍 IMPORTANT: Products created before the new SupplyChain contract deployment (${contractAddresses.SupplyChain}) cannot be batch transferred.

✅ Solution: Only products created AFTER the new contract deployment can be batch transferred. Please create new products or use products that were created after the contract was redeployed.`;
        throw new Error(errorMsg);
      }
      
      console.log(`✅ ${stillOwnedProducts.length} products verified and ready for transfer`);
      
      // Use batch transfer function for single signature
      const tokenIds = stillOwnedProducts.map(p => p.tokenId);
      const saleDetails = `Batch transfer - ${stillOwnedProducts.length} products`;
      
      setTransferProgress(prev => {
        const updated = { ...prev };
        stillOwnedProducts.forEach(p => {
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
        if (recipientRole === Role.DISTRIBUTOR) {
          tx = await supplyChainService.batchTransferToDistributor(signer, tokenIds, recipientAddress, false);
        } else if (recipientRole === Role.RETAILER) {
          tx = await supplyChainService.batchTransferToRetailer(signer, tokenIds, recipientAddress, false);
        } else if (recipientRole === Role.BUYER) {
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
          setError(`❌ Batch functions not available on deployed contract. You'll need to sign ${tokenIds.length} transactions. Please redeploy the SupplyChain contract with batch functions for single-signature batch transfers.`);
          setTransferring(false);
          return;
        }
        
        // Update all products to failed
        setTransferProgress(prev => {
          const updated = { ...prev };
          stillOwnedProducts.forEach(p => {
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
          stillOwnedProducts.forEach(p => {
            updated[p.tokenId] = 'success';
          });
          return updated;
        });
        
        if (onSuccess) {
          onSuccess(`${stillOwnedProducts.length} product(s) transferred successfully!`);
        }
        
        handleClose();
      } catch (waitErr) {
        console.error('Error waiting for transaction confirmation:', waitErr);
        setTransferProgress(prev => {
          const updated = { ...prev };
          stillOwnedProducts.forEach(p => {
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
                const productName = product.metadata?.name || `Product #${product.tokenId}`;
                
                return (
                  <div key={product.tokenId} className="batch-product-item">
                    <div className="product-item-info">
                      <span className="product-name">{productName}</span>
                      <span className="product-token-id">Token ID: {product.tokenId}</span>
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
                  disabled={!isValidRecipient || transferring || ownedProducts.length === 0}
                >
                  Preview Transfer
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
                    <span className="preview-value">{ownedProducts.length} product(s)</span>
                  </div>
                </div>
                {ownedProducts.length > 1 && (
                  <div className="preview-info" style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e3f2fd', borderRadius: '4px', fontSize: '0.9rem', color: '#000000' }}>
                    ✅ <strong>Batch Transfer:</strong> All {ownedProducts.length} products will be transferred in a single transaction requiring 1 signature.
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
                  disabled={!isValidRecipient || transferring || ownedProducts.length === 0}
                >
                  {transferring ? (
                    <>
                      <span className="loading"></span> Transferring...
                    </>
                  ) : (
                    `Transfer ${ownedProducts.length} Product(s)`
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

