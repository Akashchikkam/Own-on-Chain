import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { retrieveFromIPFS, ipfsToGatewayUrl } from '../utils/ipfs';
import { productNFTService } from '../utils/contractHelpers';
import Scanner from '../components/Scanner';
import SecureSendModal from '../components/SecureSendModal';
import SecureReceiveModal from '../components/SecureReceiveModal';
import { getBackendApiUrl } from '../utils/api';
import './PublicVerify.css';

function PublicVerify() {
  const { tokenId: urlTokenId } = useParams();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  const serial = searchParams.get('serial');
  const navigate = useNavigate();
  const { provider, signer, account, isConnected } = useWeb3();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedTokenId, setScannedTokenId] = useState(null);
  const [scanMode, setScanMode] = useState(null); // 'send' or 'receive' or null for verify
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [actionProduct, setActionProduct] = useState(null);
  
  // Use scannedTokenId if available, otherwise use URL tokenId
  const tokenId = scannedTokenId || urlTokenId;

  useEffect(() => {
    loadProduct();
  }, [tokenId, productId, serial]);
  
  const loadProduct = async () => {
    try {
      setLoading(true);
      setError('');
      
      let nftTokenId;
      
      if (tokenId) {
        nftTokenId = tokenId;
      } else if (productId && serial) {
        // Lookup token ID from product ID + serial number
        const lookupResponse = await fetch(
          getBackendApiUrl(`/product/lookup/${encodeURIComponent(productId)}/${encodeURIComponent(serial)}`)
        );
        
        if (!lookupResponse.ok) {
          const errorData = await lookupResponse.json().catch(() => ({ error: 'Network error' }));
          throw new Error(errorData.error || 'Failed to lookup product');
        }
        
        const lookupResult = await lookupResponse.json();
        if (!lookupResult.success || !lookupResult.data) {
          throw new Error(lookupResult.error || 'Product not found');
        }
        
        nftTokenId = lookupResult.data.tokenId;
      } else {
        setError('No product identifier provided');
        setLoading(false);
        return;
      }

      // Simple: Call backend API (server handles all blockchain calls)
      const response = await fetch(getBackendApiUrl(`/product/${nftTokenId}`));
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || 'Failed to verify product');
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response');
      }

      const { owner, tokenURI, isBurned, warrantyValid, transferHistory } = result.data;

      // Fetch metadata from IPFS
      let metadata = null;
      if (tokenURI && tokenURI !== '') {
        const ipfsResult = await retrieveFromIPFS(tokenURI);
        if (ipfsResult?.success && ipfsResult.data) {
          metadata = ipfsResult.data;
          // Convert image URLs to gateway URLs
          if (metadata.images && metadata.images.length > 0) {
            metadata.images = metadata.images.map(img => ({
              ...img,
              url: ipfsToGatewayUrl(img.url || img.ipfsUrl)
            }));
          }
        }
      }

      setProduct({
        tokenId: nftTokenId,
        owner,
        isBurned,
        metadata,
        warrantyValid
      });

      setHistory(transferHistory || []);
      
    } catch (err) {
      console.error('Error loading product:', err);
      setError(err.message || 'Failed to verify product');
    } finally {
      setLoading(false);
    }
  };
  
  const formatAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(Number(timestamp) * 1000).toLocaleString();
  };

  const handleScanSuccess = (result) => {
    console.log('Scan result:', result);
    setShowScanner(false);
    
    let tokenId;
    
    // Extract token ID from scan result
    if (result.tokenId) {
      tokenId = result.tokenId;
    } else if (result.url) {
      const urlPath = result.url.pathname;
      if (urlPath.includes('/verify/')) {
        tokenId = urlPath.split('/verify/')[1];
      }
    } else if (result.raw) {
      try {
        const url = new URL(result.raw);
        if (url.pathname.includes('/verify/')) {
          tokenId = url.pathname.split('/verify/')[1];
        }
      } catch (e) {
        tokenId = result.raw;
      }
    }
    
    if (tokenId) {
      setScannedTokenId(tokenId);
      // Navigate to the verify page with the token ID
      navigate(`/verify/${tokenId}`, { replace: true });
    } else {
      setError('Could not extract product information from scan. Please ensure the QR code contains a valid product token ID.');
    }
  };

  const handleScanError = (error) => {
    console.error('Scan error:', error);
    setError('Failed to scan. Please try again.');
  };

  const handleScanForSend = () => {
    setScanMode('send');
    setShowScanner(true);
  };

  const handleScanForReceive = () => {
    setScanMode('receive');
    setShowScanner(true);
  };

  const handleScanSuccessForAction = async (result) => {
    console.log('Scan result for action:', result);
    setShowScanner(false);
    
    try {
      let tokenId;
      
      // Extract token ID from scan result
      if (result.tokenId) {
        tokenId = result.tokenId;
      } else if (result.url) {
        const urlPath = result.url.pathname;
        if (urlPath.includes('/verify/')) {
          tokenId = urlPath.split('/verify/')[1];
        }
      } else if (result.raw) {
        try {
          const url = new URL(result.raw);
          if (url.pathname.includes('/verify/')) {
            tokenId = url.pathname.split('/verify/')[1];
          }
        } catch (e) {
          tokenId = result.raw;
        }
      }
      
      if (!tokenId) {
        setError('Could not extract product information from scan.');
        return;
      }
      
      // Fetch product details
      setLoading(true);
      const owner = await productNFTService.ownerOf(provider, tokenId);
      const tokenURI = await productNFTService.getTokenURI(provider, tokenId);
      
      // Check if product exists and get metadata
      let metadata = null;
      if (tokenURI && tokenURI !== '') {
        const result = await retrieveFromIPFS(tokenURI);
        if (result?.success && result.data) {
          metadata = result.data;
          if (metadata.images && metadata.images.length > 0) {
            metadata.images = metadata.images.map(img => ({
              ...img,
              url: ipfsToGatewayUrl(img.url || img.ipfsUrl)
            }));
          }
        }
      }
      
      setActionProduct({
        tokenId,
        owner,
        metadata
      });
      
      // Based on scan mode, open appropriate modal
      if (scanMode === 'send') {
        setShowSendModal(true);
      } else if (scanMode === 'receive') {
        setShowReceiveModal(true);
      }
      
    } catch (err) {
      console.error('Error loading scanned product:', err);
      setError('Failed to load product details. Product may not exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSuccess = (message) => {
    setActionProduct(null);
    setShowSendModal(false);
    setSuccess(message || 'Product transferred successfully!');
    setTimeout(() => {
      setSuccess('');
      loadProduct(); // Reload current product if it's the same one
    }, 3000);
  };

  const handleReceiveSuccess = (message) => {
    setActionProduct(null);
    setShowReceiveModal(false);
    setSuccess(message || 'Receipt confirmed successfully!');
    setTimeout(() => {
      setSuccess('');
      loadProduct(); // Reload current product if it's the same one
    }, 3000);
  };
  
  if (loading) {
    return (
      <div className="public-verify-page">
        <div className="verify-container">
          <div className="loading-container">
            <span className="loading"></span>
            <p>Verifying product...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="public-verify-page">
        <div className="verify-container">
          <div className="verify-error">
            <div className="error-icon">❌</div>
            <h2>Product Not Found</h2>
            <p>{error}</p>
            <div className="error-tips">
              <h4>Possible reasons:</h4>
              <ul>
                <li>The QR code is damaged or invalid</li>
                <li>The product has not been registered on the blockchain</li>
                <li>The product may have been burned/deleted</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!product) {
    return null;
  }
  
  return (
    <div className="public-verify-page">
      <div className="verify-container">
        {/* Scanner Modal */}
        {showScanner && (
          <Scanner
            onScan={scanMode ? handleScanSuccessForAction : handleScanSuccess}
            onError={handleScanError}
            onClose={() => {
              setShowScanner(false);
              setScanMode(null);
            }}
            mode="qr"
          />
        )}

        {/* Scan Button - Show when no product loaded or after product is verified */}
        {!showScanner && (
          <div className="scan-button-container">
            {!product && (
              <>
                <button 
                  className="btn-scan-qr"
                  onClick={() => setShowScanner(true)}
                >
                  📱 Scan QR Code to Verify Product
                </button>
                <p className="scan-instructions">
                  Point your camera at the product's QR code to verify its authenticity
                </p>
              </>
            )}
            {product && (
              <button 
                className="btn-scan-qr btn-scan-another"
                onClick={() => {
                  setProduct(null);
                  setScannedTokenId(null);
                  setShowScanner(true);
                }}
              >
                📱 Scan Another Product
              </button>
            )}
          </div>
        )}

        {/* Authenticity Badge */}
        <div className={`authenticity-badge ${product.isBurned ? 'burned' : 'authentic'}`}>
          {product.isBurned ? (
            <>
              <div className="badge-icon">🔥</div>
              <h2>Product Burned</h2>
              <p>This product has been permanently removed</p>
            </>
          ) : (
            <>
              <div className="badge-icon">✓</div>
              <h2>Authentic Product</h2>
              <p>Verified on blockchain</p>
            </>
          )}
        </div>
        
        {/* Product Information */}
        <div className="verify-card product-info-card">
          <div className="product-image-section">
            {product.metadata?.images && product.metadata.images.length > 0 && product.metadata.images[0].url ? (
              <img 
                src={product.metadata.images[0].url} 
                alt={product.metadata?.name || 'Product'} 
                className="product-image"
              />
            ) : (
              <div className="product-image-placeholder">
                📦
                <p>No image</p>
              </div>
            )}
          </div>
          
          <div className="product-details-section">
            <h1>{product.metadata?.name || `Product #${product.tokenId}`}</h1>
            
            {!product.metadata && (
              <div className="warning-banner">
                ⚠️ Metadata not available
              </div>
            )}
            
            {product.metadata?.description && (
              <p className="product-description">{product.metadata.description}</p>
            )}
            
            <div className="product-meta-grid">
              {product.metadata?.brand && (
                <div className="meta-item">
                  <span className="meta-label">Brand</span>
                  <span className="meta-value">{product.metadata.brand}</span>
                </div>
              )}
              
              {product.metadata?.model && (
                <div className="meta-item">
                  <span className="meta-label">Model</span>
                  <span className="meta-value">{product.metadata.model}</span>
                </div>
              )}
              
              {product.metadata?.category && (
                <div className="meta-item">
                  <span className="meta-label">Category</span>
                  <span className="meta-value">{product.metadata.category}</span>
                </div>
              )}
              
              {product.metadata?.serialNumber && (
                <div className="meta-item">
                  <span className="meta-label">Serial Number</span>
                  <span className="meta-value">{product.metadata.serialNumber}</span>
                </div>
              )}
              
              {product.metadata?.productId && (
                <div className="meta-item">
                  <span className="meta-label">Product ID</span>
                  <span className="meta-value">{product.metadata.productId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Blockchain Info */}
        <div className="verify-card blockchain-info-card">
          <h3>🔗 Blockchain Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Token ID</span>
              <span className="info-value">{product.tokenId}</span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Current Owner</span>
              <span className="info-value" title={product.owner}>
                {product.isBurned ? 'Burned (0x000...dead)' : formatAddress(product.owner)}
              </span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Warranty Status</span>
              <span className={`info-value ${product.warrantyValid ? 'valid' : 'expired'}`}>
                {product.warrantyValid ? '✓ Valid' : '✗ Expired'}
              </span>
            </div>
            
            <div className="info-item">
              <span className="info-label">Transfer Count</span>
              <span className="info-value">{history.length}</span>
            </div>
          </div>
        </div>
        
        {/* Transfer History */}
        {history.length > 0 && (
          <div className="verify-card history-card">
            <h3>📋 Transfer History</h3>
            <div className="timeline">
              {history.map((transfer, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-marker">
                    {index === 0 ? '🏭' : index === history.length - 1 ? '📍' : '🔄'}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-title">
                        {index === 0 ? 'Minted' : `Transfer #${index}`}
                      </span>
                      <span className="timeline-date">
                        {formatDate(transfer.timestamp)}
                      </span>
                    </div>
                    <div className="timeline-body">
                      {index === 0 ? (
                        <p>
                          Created by <strong>{formatAddress(transfer.to)}</strong>
                        </p>
                      ) : (
                        <p>
                          From <strong>{formatAddress(transfer.from)}</strong>
                          {' → '}
                          To <strong>{formatAddress(transfer.to)}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Actions for Connected Users */}
        {isConnected && product && !product.isBurned && (
          <div className="verify-card action-card">
            <h3>🔐 Wallet Connected Actions</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button 
                className="btn-action"
                onClick={() => {
                  // Use current product for action
                  setActionProduct(product);
                  setShowSendModal(true);
                }}
              >
                📤 Send This Product
              </button>
              <button 
                className="btn-action"
                onClick={() => {
                  // Use current product for action
                  setActionProduct(product);
                  setShowReceiveModal(true);
                }}
              >
                📥 Confirm Receipt
              </button>
              <button 
                className="btn-action"
                onClick={handleScanForSend}
              >
                📤 Scan to Send
              </button>
              <button 
                className="btn-action"
                onClick={handleScanForReceive}
              >
                📥 Scan to Receive
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="verify-card" style={{ backgroundColor: '#d4edda', border: '1px solid #c3e6cb', marginTop: '1rem' }}>
            <p style={{ color: '#155724', margin: 0 }}>✅ {success}</p>
          </div>
        )}

        {/* Secure Send Modal */}
        {actionProduct && (
          <SecureSendModal
            isOpen={showSendModal}
            onClose={() => {
              setShowSendModal(false);
              setActionProduct(null);
            }}
            product={actionProduct}
            provider={provider}
            signer={signer}
            account={account}
            onSuccess={handleSendSuccess}
            onError={(err) => setError(err)}
          />
        )}

        {/* Secure Receive Modal */}
        {actionProduct && (
          <SecureReceiveModal
            isOpen={showReceiveModal}
            onClose={() => {
              setShowReceiveModal(false);
              setActionProduct(null);
            }}
            product={actionProduct}
            provider={provider}
            signer={signer}
            account={account}
            onSuccess={handleReceiveSuccess}
            onError={(err) => setError(err)}
          />
        )}
        
        {/* Footer */}
        <div className="verify-footer">
          <p>
            Powered by <strong>Own-on-Chain</strong> - Blockchain Product Identity
          </p>
          <p className="footer-note">
            This product's authenticity is verified on the Ethereum blockchain.
            All information is tamper-proof and publicly verifiable.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PublicVerify;

