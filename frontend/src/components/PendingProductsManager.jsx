import { useState, useEffect } from 'react';
import { getBackendApiUrl } from '../utils/api';
import { uploadProductMetadata } from '../utils/ipfs';
import { supplyChainService } from '../utils/contractHelpers';
import { productIdentifierService } from '../utils/productIdentifier';
import './PendingProductsManager.css';

function PendingProductsManager({ account, signer, provider, onProductCreated }) {
  const [pendingProducts, setPendingProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (account) {
      loadPendingProducts();
    }
  }, [account]);

  const loadPendingProducts = async () => {
    if (!account) {
      console.log('⚠️ No account, skipping pending products load');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const url = `${getBackendApiUrl('/webhooks/pending-products')}?walletAddress=${account}`;
      console.log('📥 Loading pending products from:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to load pending products:', response.status, errorText);
        throw new Error(`Failed to load pending products: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('📦 Pending products response:', result);
      
      if (result.success) {
        console.log(`✅ Found ${result.count || 0} pending products`);
        setPendingProducts(result.data || []);
      } else {
        console.warn('⚠️ Response not successful:', result);
      }
    } catch (err) {
      console.error('❌ Error loading pending products:', err);
      setError(err.message || 'Failed to load pending products');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (pendingProduct) => {
    if (!signer || !provider) {
      setError('Wallet not connected');
      return;
    }

    try {
      setProcessing(pendingProduct.id);
      setError('');
      setSuccess('');

      console.log('📦 Processing pending product:', pendingProduct);

      // Step 1: Upload metadata to IPFS
      const metadataResult = await uploadProductMetadata(pendingProduct.productData);
      if (!metadataResult.success) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      // Step 2: Create product on blockchain
      const result = await supplyChainService.createProduct(
        signer,
        metadataResult.ipfsUrl,
        pendingProduct.productData.productType || 'physical',
        pendingProduct.productData.warrantyPeriod || 365
      );

      // Step 3: Register blockchain ID if available
      if (result.tokenId) {
        try {
          await productIdentifierService.registerProductId(
            signer,
            result.tokenId,
            pendingProduct.productData.model || pendingProduct.productData.name || 'UNKNOWN',
            pendingProduct.productData.serialNumber || `SN-${result.tokenId}`
          );
        } catch (err) {
          console.warn('⚠️ Failed to register blockchain ID:', err);
          // Don't fail product creation if blockchain ID registration fails
        }
      }

      // Step 4: Mark as processed in backend
      const processResponse = await fetch(
        getBackendApiUrl(`/webhooks/pending-products/${pendingProduct.id}/process`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: account,
            tokenId: result.tokenId?.toString(),
            txHash: result.tx?.hash
          })
        }
      );

      if (!processResponse.ok) {
        throw new Error('Failed to update pending product status');
      }

      setSuccess(`Product created successfully! Token ID: ${result.tokenId}`);
      
      // Trigger webhook for product creation
      try {
        const webhookData = {
          tokenId: result.tokenId.toString(),
          productName: pendingProduct.productData.name,
          description: pendingProduct.productData.description,
          productType: pendingProduct.productData.productType,
          category: pendingProduct.productData.category,
          serialNumber: pendingProduct.productData.serialNumber,
          model: pendingProduct.productData.model,
          warrantyPeriod: pendingProduct.productData.warrantyPeriod,
          producer: account,
          tokenURI: metadataResult.ipfsUrl,
          metadata: {
            name: pendingProduct.productData.name,
            description: pendingProduct.productData.description,
            category: pendingProduct.productData.category,
            model: pendingProduct.productData.model,
            manufacturer: pendingProduct.productData.manufacturer
          }
        };

        await fetch(getBackendApiUrl('/webhooks/trigger'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'product.created',
            data: webhookData,
            walletAddress: account
          })
        });
        console.log('✅ Webhook triggered for product.created');
      } catch (webhookError) {
        console.warn('⚠️ Failed to trigger webhook:', webhookError);
        // Don't fail product creation if webhook fails
      }
      
      // Reload pending products
      await loadPendingProducts();
      
      // Notify parent component
      if (onProductCreated) {
        onProductCreated(result.tokenId);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error approving pending product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (pendingProduct) => {
    if (!window.confirm(`Reject product creation request for "${pendingProduct.productData.name}"?`)) {
      return;
    }

    try {
      setProcessing(pendingProduct.id);
      setError('');

      const response = await fetch(
        `${getBackendApiUrl(`/webhooks/pending-products/${pendingProduct.id}`)}?walletAddress=${account}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reject pending product');
      }

      setSuccess('Product request rejected');
      await loadPendingProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error rejecting pending product:', err);
      setError(err.message || 'Failed to reject product');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && pendingProducts.length === 0) {
    return (
      <div className="pending-products-manager">
        <div className="loading">Loading pending products...</div>
      </div>
    );
  }

  if (pendingProducts.length === 0) {
    return (
      <div className="pending-products-manager">
        <h3>📥 Pending Product Requests</h3>
        <p className="no-pending">No pending product creation requests.</p>
      </div>
    );
  }

  return (
    <div className="pending-products-manager">
      <div className="pending-header">
        <h3>📥 Pending Product Requests ({pendingProducts.length})</h3>
        <button className="btn btn-secondary" onClick={loadPendingProducts}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {success && (
        <div className="success-message">{success}</div>
      )}

      <div className="pending-products-list">
        {pendingProducts.map((product) => (
          <div key={product.id} className="pending-product-card">
            <div className="pending-product-header">
              <h4>{product.productData.name}</h4>
              <span className="pending-badge">Pending</span>
            </div>

            <div className="pending-product-details">
              {product.productData.serialNumber && (
                <div className="detail-row">
                  <span className="label">Serial Number:</span>
                  <span className="value">{product.productData.serialNumber}</span>
                </div>
              )}
              {product.productData.model && (
                <div className="detail-row">
                  <span className="label">Model:</span>
                  <span className="value">{product.productData.model}</span>
                </div>
              )}
              {product.productData.category && (
                <div className="detail-row">
                  <span className="label">Category:</span>
                  <span className="value">{product.productData.category}</span>
                </div>
              )}
              {product.productData.description && (
                <div className="detail-row">
                  <span className="label">Description:</span>
                  <span className="value">{product.productData.description}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="label">Requested:</span>
                <span className="value">{formatDate(product.createdAt)}</span>
              </div>
            </div>

            <div className="pending-product-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleApprove(product)}
                disabled={processing === product.id || !signer}
              >
                {processing === product.id ? (
                  <>⏳ Processing...</>
                ) : (
                  <>✅ Approve & Create</>
                )}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleReject(product)}
                disabled={processing === product.id}
              >
                ❌ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PendingProductsManager;

