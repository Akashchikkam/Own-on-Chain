import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService, formatAddress } from '../utils/contractHelpers';
import { retrieveFromIPFS, ipfsToGatewayUrl } from '../utils/ipfs';
import { ProductStatusName } from '../contracts/config';
import './ProductDetails.css';

function ProductDetails() {
  const { tokenId } = useParams();
  const { provider, signer, account, isConnected } = useWeb3();
  const [product, setProduct] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [transferHistory, setTransferHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (isConnected && tokenId) {
      loadProductDetails();
    }
  }, [isConnected, tokenId]);

  const loadProductDetails = async () => {
    try {
      setLoading(true);
      
      // Load product data
      const productData = await supplyChainService.getProduct(provider, tokenId);
      const productInfo = await productNFTService.getProductInfo(provider, tokenId);
      const isWarrantyValid = await productNFTService.isWarrantyValid(provider, tokenId);
      const isAuthentic = await supplyChainService.verifyAuthenticity(provider, tokenId);
      const owner = await productNFTService.ownerOf(provider, tokenId);
      const history = await productNFTService.getTransferHistory(provider, tokenId);
      
      setProduct({
        ...productData,
        ...productInfo,
        isWarrantyValid,
        isAuthentic,
        currentOwner: owner
      });
      
      setTransferHistory(history);

      // Load metadata from IPFS
      try {
        const tokenURI = await productNFTService.getTokenURI(provider, tokenId);
        console.log('📋 Token URI:', tokenURI);
        const metadataResult = await retrieveFromIPFS(tokenURI);
        console.log('📋 Metadata result:', metadataResult);
        if (metadataResult.success) {
          console.log('🖼️ Images in metadata:', metadataResult.data.images);
          setMetadata(metadataResult.data);
        }
      } catch (metaErr) {
        console.error('Error loading metadata:', metaErr);
      }
    } catch (err) {
      console.error('Error loading product details:', err);
      setError('Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    const recipientAddress = prompt('Enter recipient wallet address:');
    if (!recipientAddress) return;

    // Validate address format
    if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid address format. Please enter a valid Ethereum address.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setTransferLoading(true);
      setError('');
      setSuccess('');

      await productNFTService.transferTo(signer, tokenId, recipientAddress);
      setSuccess(`Product transferred successfully to ${recipientAddress.substring(0, 10)}...`);
      
      // Reload product details to show new owner
      setTimeout(() => {
        loadProductDetails();
      }, 2000);
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err.message || 'Failed to transfer product');
    } finally {
      setTransferLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="product-details">
        <div className="card">
          <h2>Please Connect Wallet</h2>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="product-details">
        <div className="loading-container">
          <span className="loading"></span> Loading product details...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-details">
        <div className="alert alert-error">{error || 'Product not found'}</div>
      </div>
    );
  }

  const isOwner = account && product && account.toLowerCase() === product.currentOwner.toLowerCase();

  return (
    <div className="product-details">
      <div className="details-header">
        <div>
          <h1>{metadata?.name || `Product #${tokenId}`}</h1>
          <div className="badges">
            {product.isAuthentic && (
              <span className="badge badge-success">✓ Authentic</span>
            )}
            {product.isWarrantyValid ? (
              <span className="badge badge-success">Warranty Valid</span>
            ) : (
              <span className="badge badge-error">Warranty Expired</span>
            )}
            <span className="badge badge-primary">
              {ProductStatusName[Number(product.status)]}
            </span>
          </div>
        </div>
        {isOwner && (
          <button
            className="btn btn-primary"
            onClick={handleTransfer}
            disabled={transferLoading}
            style={{ marginLeft: 'auto' }}
          >
            {transferLoading ? (
              <>
                <span className="loading"></span> Transferring...
              </>
            ) : (
              '🔄 Transfer'
            )}
          </button>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid grid-2">
        <div className="card">
          <h2>Product Information</h2>
          {metadata?.images && metadata.images.length > 0 && metadata.images[0].url && (
            <div className="product-image-container" style={{ marginBottom: '1rem' }}>
              <img
                src={metadata.images[0].url}
                alt={metadata.name || 'Product image'}
                className="product-image"
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto', 
                  borderRadius: '8px',
                  display: 'block'
                }}
                onError={(e) => {
                  console.error('❌ Image load error');
                  console.error('Image URL:', metadata.images[0].url);
                  console.error('Image object:', metadata.images[0]);
                  e.target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('✅ Image loaded successfully!');
                  console.log('Image URL:', metadata.images[0].url);
                }}
              />
            </div>
          )}
          {(!metadata?.images || metadata.images.length === 0) && (
            <div style={{ 
              padding: '2rem', 
              background: '#f5f5f5', 
              borderRadius: '8px', 
              marginBottom: '1rem',
              textAlign: 'center',
              color: '#666'
            }}>
              📷 No image available
            </div>
          )}
          <div className="info-section">
            <p><strong>Token ID:</strong> {tokenId}</p>
            <p><strong>Description:</strong> {metadata?.description || 'N/A'}</p>
            <p><strong>Type:</strong> {product.productType || metadata?.productType}</p>
            <p><strong>Category:</strong> {metadata?.category || 'N/A'}</p>
            <p><strong>Serial Number:</strong> {metadata?.serialNumber || 'N/A'}</p>
            <p><strong>Model:</strong> {metadata?.model || 'N/A'}</p>
            <p><strong>Manufacturer:</strong> {metadata?.manufacturer?.name || 'N/A'}</p>
            <p><strong>Warranty Period:</strong> {Number(product.warrantyPeriod) / 86400} days</p>
          </div>

          {metadata?.specifications && Object.keys(metadata.specifications).length > 0 && (
            <div className="specs-section">
              <h3>Specifications</h3>
              {Object.entries(metadata.specifications).map(([key, value]) => (
                <p key={key}><strong>{key}:</strong> {value}</p>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Ownership Details</h2>
          <div className="info-section">
            <p><strong>Current Owner:</strong><br/>{formatAddress(product.currentOwner)}</p>
            <p><strong>Producer:</strong><br/>{formatAddress(product.producer)}</p>
            {product.distributor !== '0x0000000000000000000000000000000000000000' && (
              <p><strong>Distributor:</strong><br/>{formatAddress(product.distributor)}</p>
            )}
            {product.retailer !== '0x0000000000000000000000000000000000000000' && (
              <p><strong>Retailer:</strong><br/>{formatAddress(product.retailer)}</p>
            )}
            {product.buyer !== '0x0000000000000000000000000000000000000000' && (
              <p><strong>First Buyer:</strong><br/>{formatAddress(product.buyer)}</p>
            )}
          </div>

          <h2 style={{ marginTop: '2rem' }}>Transfer History</h2>
          <div className="history-timeline">
            {transferHistory.map((record, index) => (
              <div key={index} className="history-item">
                <div className="history-marker"></div>
                <div className="history-content">
                  <p className="history-type"><strong>{record.transferType}</strong></p>
                  <p>From: {formatAddress(record.from)}</p>
                  <p>To: {formatAddress(record.to)}</p>
                  <p className="history-date">
                    {new Date(Number(record.timestamp) * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetails;

