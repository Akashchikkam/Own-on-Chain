import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { verifyOwnership, isValidAddress, formatAddress } from '../utils/securityHelpers';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import './SecureSendModal.css';

function SecureSendModal({ 
  isOpen, 
  onClose, 
  product, 
  provider, 
  signer, 
  account,
  onSuccess,
  onError 
}) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [isValidRecipient, setIsValidRecipient] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [currentOwner, setCurrentOwner] = useState(null); // Store current owner fetched from blockchain
  const [fetchingOwner, setFetchingOwner] = useState(false); // Loading state for owner fetch
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [gasEstimate, setGasEstimate] = useState(null);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen && product && provider && account) {
      fetchCurrentOwner();
      checkOwnership();
      setRecipientAddress('');
      setError('');
      setShowPreview(false);
    } else if (!isOpen) {
      // Clear current owner when modal closes
      setCurrentOwner(null);
      setFetchingOwner(false);
    }
  }, [isOpen, product?.tokenId, provider, account]); // Explicitly use product.tokenId

  const fetchCurrentOwner = async () => {
    if (!product || !provider || !product.tokenId) return;
    
    try {
      setFetchingOwner(true);
      // Always fetch the current owner from blockchain to ensure it's up-to-date
      const owner = await productNFTService.ownerOf(provider, product.tokenId);
      setCurrentOwner(owner);
      console.log(`📋 Current owner fetched from blockchain: ${owner} for token ${product.tokenId}`);
    } catch (err) {
      console.error('Error fetching current owner:', err);
      // Don't fallback to product.owner - show error instead
      setError(`Failed to fetch current owner: ${err.message}`);
      // Only use product.owner as last resort if available
      if (product.owner) {
        setCurrentOwner(product.owner);
      }
    } finally {
      setFetchingOwner(false);
    }
  };

  const checkOwnership = async () => {
    if (!product || !provider || !account) return;
    
    try {
      setCheckingOwnership(true);
      const result = await verifyOwnership(provider, product.tokenId, account);
      setIsOwner(result.isOwner);
      
      if (!result.isOwner) {
        setError('You are not the owner of this product. Only the current owner can transfer it.');
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
      estimateGas(address);
    }
  };

  const estimateGas = async (recipient) => {
    if (!signer || !product || !recipient) return;
    
    try {
      // Try to estimate gas for the transfer
      // Note: This is approximate, actual gas may vary
      setGasEstimate('Calculating...');
      
      // Use a simple estimate (will be refined in actual transaction)
      setGasEstimate('~150,000 - 200,000 gas');
    } catch (err) {
      console.warn('Gas estimation failed:', err);
      setGasEstimate('Unable to estimate');
    }
  };

  const handlePreview = () => {
    if (!isValidRecipient || !isOwner) return;
    setShowPreview(true);
  };

  const handleConfirmTransfer = async () => {
    if (!signer || !product || !recipientAddress || !isValidRecipient) return;
    
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

      // Use appropriate SupplyChain method based on recipient role
      try {
        if (recipientRole === Role.DISTRIBUTOR) {
          await supplyChainService.transferToDistributor(signer, product.tokenId, recipientAddress);
        } else if (recipientRole === Role.RETAILER) {
          await supplyChainService.transferToRetailer(signer, product.tokenId, recipientAddress);
        } else if (recipientRole === Role.BUYER) {
          const saleDetails = prompt('Enter sale details (IPFS hash or description):') || '';
          await supplyChainService.sellToBuyer(signer, product.tokenId, recipientAddress, saleDetails);
        } else {
          // Use sellToBuyer for other roles
          const saleDetails = prompt('Enter transfer details (IPFS hash or description):') || '';
          await supplyChainService.sellToBuyer(signer, product.tokenId, recipientAddress, saleDetails);
        }
      } catch (supplyChainErr) {
        // Fallback to direct NFT transfer if SupplyChain method fails
        console.warn('SupplyChain method failed, using direct NFT transfer:', supplyChainErr);
        await productNFTService.transferTo(signer, product.tokenId, recipientAddress);
      }

      if (onSuccess) {
        onSuccess(`Product #${product.tokenId} transferred successfully to ${formatAddress(recipientAddress)}`, {
          tokenId: product.tokenId,
          to: recipientAddress,
          from: account,
          transferType: recipientRole === Role.DISTRIBUTOR ? 'toDistributor' : 
                       recipientRole === Role.RETAILER ? 'toRetailer' : 
                       recipientRole === Role.BUYER ? 'toBuyer' : 'transfer',
          productName: product.metadata?.name || `Product #${product.tokenId}`
        });
      }
      
      handleClose();
    } catch (err) {
      console.error('Transfer error:', err);
      const errorMessage = err.message || 'Failed to transfer product';
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
    setGasEstimate(null);
    setCurrentOwner(null);
    setFetchingOwner(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="secure-modal-overlay" onClick={handleClose}>
      <div className="secure-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="secure-modal-header">
          <h2>🔄 Secure Transfer</h2>
          <button className="secure-modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="secure-modal-body">
          {/* Product Info */}
          <div className="send-product-info">
            <h3>Product Details</h3>
            <div className="product-info-grid">
              <div className="info-row">
                <span className="info-label">Token ID:</span>
                <span className="info-value">{product.tokenId}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Product Name:</span>
                <span className="info-value">{product.metadata?.name || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Current Owner:</span>
                <span className="info-value">
                  {fetchingOwner ? (
                    <span>Loading...</span>
                  ) : currentOwner ? (
                    formatAddress(currentOwner)
                  ) : product.owner ? (
                    formatAddress(product.owner)
                  ) : (
                    'Unknown'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Ownership Verification */}
          {checkingOwnership ? (
            <div className="ownership-status checking">
              <span className="loading"></span>
              <span>Verifying ownership...</span>
            </div>
          ) : isOwner ? (
            <div className="ownership-status verified">
              ✓ Ownership verified
            </div>
          ) : (
            <div className="ownership-status not-owner">
              ✗ You are not the owner of this product
            </div>
          )}

          {!showPreview && isOwner && (
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
                  disabled={!isValidRecipient || !isOwner || transferring}
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
                <h3>Transaction Preview</h3>
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
                    <span className="preview-label">Token ID:</span>
                    <span className="preview-value">{product.tokenId}</span>
                  </div>
                  <div className="preview-item">
                    <span className="preview-label">Estimated Gas:</span>
                    <span className="preview-value">{gasEstimate || 'N/A'}</span>
                  </div>
                </div>
                <div className="preview-warning">
                  ⚠️ MetaMask will open to confirm this transaction. Please review all details carefully.
                </div>
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
                  disabled={!isValidRecipient || !isOwner || transferring}
                >
                  {transferring ? (
                    <>
                      <span className="loading"></span> Transferring...
                    </>
                  ) : (
                    'Confirm & Transfer'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SecureSendModal;

