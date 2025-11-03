import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { retrieveFromIPFS, ipfsToGatewayUrl } from '../utils/ipfs';
import './PublicVerify.css';

function PublicVerify() {
  const { tokenId } = useParams();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  const serial = searchParams.get('serial');
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  
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
        setError('Product ID lookup not yet implemented. Please scan a QR code with token ID.');
        setLoading(false);
        return;
      } else {
        setError('No product identifier provided');
        setLoading(false);
        return;
      }

      // Simple: Call backend API (server handles all blockchain calls)
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/product/${nftTokenId}`);
      
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

