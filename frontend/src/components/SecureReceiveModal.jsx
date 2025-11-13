import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { verifyReceipt, formatAddress } from '../utils/securityHelpers';
import { getBackendApiUrl } from '../utils/api';
import { participantRegistryService, productNFTService } from '../utils/contractHelpers';
import { retrieveFromIPFS, ipfsToGatewayUrl } from '../utils/ipfs';
import './SecureReceiveModal.css';

function SecureReceiveModal({ 
  isOpen, 
  onClose, 
  product, 
  provider, 
  signer,
  account,
  onSuccess,
  onError 
}) {
  const [isRecipient, setIsRecipient] = useState(false);
  const [sender, setSender] = useState(null);
  const [senderCompany, setSenderCompany] = useState(null);
  const [currentOwner, setCurrentOwner] = useState(null); // Store current owner fetched from blockchain
  const [fetchingOwner, setFetchingOwner] = useState(false); // Loading state for owner fetch
  const [transferTimestamp, setTransferTimestamp] = useState(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && product && provider && account) {
      fetchCurrentOwner();
      checkReceipt();
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

  const checkReceipt = async () => {
    if (!product || !provider || !account) return;
    
    try {
      setChecking(true);
      setError('');
      
      const result = await verifyReceipt(provider, product.tokenId, account);
      setIsRecipient(result.isRecipient);
      setSender(result.sender);
      setTransferTimestamp(result.transferTimestamp);
      
      if (!result.isRecipient) {
        setError('You are not the recipient of this product. The product owner is different.');
      } else if (result.sender) {
        // Try to fetch sender company name
        await loadSenderCompany(result.sender);
      }
    } catch (err) {
      console.error('Receipt check error:', err);
      setError(`Failed to verify receipt: ${err.message}`);
    } finally {
      setChecking(false);
    }
  };

  const loadSenderCompany = async (senderAddress) => {
    try {
      const participant = await participantRegistryService.getParticipant(provider, senderAddress);
      if (participant && participant.verificationDoc) {
        const docResult = await retrieveFromIPFS(participant.verificationDoc);
        if (docResult?.success && docResult.data?.holderName) {
          setSenderCompany(docResult.data.holderName);
        }
      }
    } catch (err) {
      console.warn('Could not load sender company name:', err);
      // Non-critical, continue without company name
    }
  };

  const handleConfirmReceipt = async () => {
    if (!isRecipient || !signer || !account) return;
    
    try {
      setConfirming(true);
      setSigning(true);
      setError('');
      
      // Create message to sign
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `I confirm receipt of Product #${product.tokenId}\n\nToken ID: ${product.tokenId}\nTimestamp: ${timestamp}\nAddress: ${account}`;
      
      // Sign message with wallet
      console.log('📝 Signing receipt confirmation message...');
      const signature = await signer.signMessage(message);
      console.log('✅ Signature created:', signature);
      
      setSigning(false);
      
      // Send confirmation with signature to backend
      const response = await fetch(getBackendApiUrl('/confirmations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId: product.tokenId.toString(),
          confirmedBy: account,
          signature: signature,
          timestamp: timestamp,
          message: message
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || 'Failed to record confirmation');
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Receipt confirmation recorded with signature:', result.data);
        
        // Trigger webhook for product.received event
        // IMPORTANT: Trigger webhooks for the PRODUCER (who registered the webhook), not the recipient
        try {
          // Get producer address from product info
          let producerAddress = null;
          try {
            const productInfo = await productNFTService.getProductInfo(provider, product.tokenId);
            producerAddress = productInfo.producer;
            console.log('📋 Producer address for webhook:', producerAddress);
          } catch (err) {
            console.warn('⚠️ Could not get producer address:', err);
            // Fallback: try to get from sender (who transferred the product)
            producerAddress = sender;
          }

          // Only trigger if we have a producer address
          if (producerAddress) {
            const webhookData = {
              tokenId: product.tokenId.toString(),
              confirmedBy: account,
              signature: signature,
              timestamp: timestamp,
              productName: product.metadata?.name || `Product #${product.tokenId}`
            };

            const webhookResponse = await fetch(getBackendApiUrl('/webhooks/trigger'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                event: 'product.received',
                data: webhookData,
                walletAddress: producerAddress // Use producer's address, not recipient's
              })
            });

            if (webhookResponse.ok) {
              const webhookResult = await webhookResponse.json();
              console.log('✅ Receipt webhook triggered for producer:', webhookResult);
            } else {
              console.warn('⚠️ Receipt webhook trigger failed (non-critical)');
            }
          } else {
            console.warn('⚠️ No producer address found, skipping webhook trigger');
          }
        } catch (webhookErr) {
          console.warn('⚠️ Receipt webhook trigger error (non-critical):', webhookErr);
        }
        
        if (onSuccess) {
          onSuccess(`Receipt confirmed for Product #${product.tokenId}`);
        }
        handleClose();
      } else {
        throw new Error(result.error || 'Failed to confirm receipt');
      }
    } catch (err) {
      console.error('Receipt confirmation error:', err);
      setSigning(false);
      const errorMessage = err.message || 'Failed to confirm receipt';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSenderCompany(null);
    setCurrentOwner(null);
    setFetchingOwner(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="secure-modal-overlay" onClick={handleClose}>
      <div className="secure-modal-content receive-modal" onClick={(e) => e.stopPropagation()}>
        <div className="secure-modal-header">
          <h2>📦 Confirm Receipt</h2>
          <button className="secure-modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="secure-modal-body">
          {/* Product Info */}
          <div className="receive-product-info">
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

          {/* Receipt Verification */}
          {checking ? (
            <div className="receipt-status checking">
              <span className="loading"></span>
              <span>Verifying receipt...</span>
            </div>
          ) : isRecipient ? (
            <div className="receipt-status verified">
              ✓ You are the recipient of this product
            </div>
          ) : (
            <div className="receipt-status not-recipient">
              ✗ You are not the recipient of this product
            </div>
          )}

          {isRecipient && sender && (
            <div className="transfer-info">
              <h3>Transfer Information</h3>
              <div className="transfer-details">
                <div className="transfer-item">
                  <span className="transfer-label">From:</span>
                  <span className="transfer-value">
                    {senderCompany ? (
                      <><strong>{senderCompany}</strong> ({formatAddress(sender)})</>
                    ) : (
                      formatAddress(sender)
                    )}
                  </span>
                </div>
                <div className="transfer-item">
                  <span className="transfer-label">To:</span>
                  <span className="transfer-value">{formatAddress(account)}</span>
                </div>
                {transferTimestamp && (
                  <div className="transfer-item">
                    <span className="transfer-label">Transfer Date:</span>
                    <span className="transfer-value">
                      {new Date(Number(transferTimestamp) * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="receive-instructions">
            <p>
              {isRecipient 
                ? 'This product has been transferred to your address. Confirm receipt to acknowledge that you have received the physical product.'
                : 'This product belongs to a different address. You cannot confirm receipt.'
              }
            </p>
          </div>

          <div className="secure-modal-actions">
            <button className="btn btn-secondary" onClick={handleClose}>
              Close
            </button>
            {isRecipient && (
              <button
                className="btn btn-primary"
                onClick={handleConfirmReceipt}
                disabled={confirming || !signer}
              >
                {signing ? (
                  <>
                    <span className="loading"></span> Signing...
                  </>
                ) : confirming ? (
                  <>
                    <span className="loading"></span> Confirming...
                  </>
                ) : (
                  '✓ Sign & Confirm Receipt'
                )}
              </button>
            )}
            {isRecipient && !signer && (
              <div className="error-message" style={{ marginTop: '0.5rem' }}>
                ⚠️ Wallet signature required. Please ensure your wallet is connected and signer is available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecureReceiveModal;

