import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { retrieveFromIPFS } from '../utils/ipfs';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function BuyerDashboard() {
  const { provider, signer, account, isConnected } = useWeb3();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resaleLoading, setResaleLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [roleError, setRoleError] = useState('');
  const [accountInfo, setAccountInfo] = useState(null);

  useEffect(() => {
    if (isConnected && account && provider) {
      // CRITICAL: Clear state immediately when account changes
      // This prevents products from wrong account showing
      setProducts([]);
      setRoleError('');
      setError('');
      setSuccess('');
      setAccountInfo(null);
      setLoading(true); // Show loading while checking role
      
      // Then load data with small delay
      const timer = setTimeout(() => {
        checkBuyerRole();
        loadProducts(); // This will check role and only load if verified Buyer
      }, 150);
      
      return () => clearTimeout(timer);
    } else {
      // Clear state when disconnected
      setProducts([]);
      setRoleError('');
      setError('');
      setSuccess('');
      setAccountInfo(null);
      setLoading(false);
    }
  }, [isConnected, account, provider]);

  const checkBuyerRole = async () => {
    if (!provider || !account) return;
    
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role, RoleName } = await import('../contracts/config');
      
      // Buyer doesn't need to be verified for viewing, but let's show account info
      try {
        const participant = await participantRegistryService.getParticipant(provider, account);
        const currentRole = RoleName[Number(participant.role)] || 'Unknown';
        const isBuyer = Number(participant.role) === Role.BUYER;
        
        setAccountInfo({
          address: account,
          role: currentRole,
          status: participant.status,
          isBuyer: isBuyer
        });
        
        if (!isBuyer && Number(participant.status) === 1) {
          // Not a buyer but verified - show info but don't block
          setRoleError(`ℹ️ You are registered as ${currentRole}. While you can view products, Buyer features may be limited.`);
        }
      } catch (err) {
        // Not registered - still allow viewing but show info
        setAccountInfo({
          address: account,
          role: 'Not Registered',
          status: null,
          isBuyer: false
        });
        setRoleError(`ℹ️ This account is not registered. Register as Buyer for full access.`);
      }
    } catch (err) {
      console.error('Error checking role:', err);
    }
  };

  const loadProducts = async () => {
    if (!provider || !account) {
      setProducts([]);
      return;
    }
    
    // Verify account hasn't changed during async operation
    const currentAccount = account;
    
    // CRITICAL: Only load products if user is verified Buyer
    // STRICT ROLE SEPARATION - no mixing of information across accounts
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      const hasBuyerRole = await participantRegistryService.hasRole(provider, currentAccount, Role.BUYER);
      if (!hasBuyerRole) {
        console.log('⚠️ Not a verified Buyer - skipping product load');
        setProducts([]);
        setLoading(false);
        return;
      }
    } catch (roleCheckErr) {
      console.warn('⚠️ Could not verify Buyer role - skipping product load:', roleCheckErr);
      setProducts([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      console.log('🔍 Loading products for Buyer:', currentAccount);
      const tokenIds = await productNFTService.getTokensByOwner(provider, currentAccount);
      console.log('📦 Token IDs found:', tokenIds);
      
      // Double-check account hasn't changed
      if (currentAccount !== account) {
        console.log('⚠️ Account changed during load, ignoring result');
        return;
      }
      
      // NEW ROBUST APPROACH: NFT-first, SupplyChain-enriched
      const productsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            // STEP 1: Always get basic info from NFT contract (source of truth)
            const productInfo = await productNFTService.getProductInfo(provider, tokenId);
            const currentOwner = await productNFTService.ownerOf(provider, tokenId);
            const isWarrantyValid = await productNFTService.isWarrantyValid(provider, tokenId);
            
            // Verify ownership
            if (currentOwner.toLowerCase() !== currentAccount.toLowerCase()) {
              console.warn(`Token ${tokenId} owner mismatch`);
              return null;
            }
            
            // STEP 2: Try to enrich with SupplyChain data (optional)
            let supplyChainData = null;
            try {
              supplyChainData = await supplyChainService.getProduct(provider, tokenId);
            } catch (supplyChainErr) {
              // SupplyChain data is optional - product can exist without it
              console.warn(`SupplyChain data not available for token ${tokenId} (this is OK)`);
            }
            
            // STEP 3: Load metadata (IMPORTANT - contains images, name, description, etc.)
            let metadata = null;
            try {
              const tokenURI = await productNFTService.getTokenURI(provider, tokenId);
              console.log(`  📎 Token ${tokenId} URI:`, tokenURI);
              
              if (!tokenURI || tokenURI === '') {
                console.warn(`  ⚠️ Token ${tokenId} has empty tokenURI`);
              } else {
                const metadataResult = await retrieveFromIPFS(tokenURI);
                console.log(`  📎 Token ${tokenId} IPFS retrieval result:`, metadataResult);
                
                if (metadataResult.success && metadataResult.data) {
                  metadata = metadataResult.data;
                  console.log(`  ✅ Token ${tokenId} metadata loaded:`, {
                    name: metadata.name,
                    description: metadata.description,
                    imagesCount: metadata.images?.length || 0,
                    category: metadata.category,
                    model: metadata.model
                  });
                } else {
                  console.warn(`  ⚠️ Token ${tokenId} metadata retrieval failed:`, metadataResult);
                }
              }
            } catch (metaErr) {
              console.error(`  ❌ Error loading metadata for token ${tokenId}:`, metaErr);
              console.error(`  ❌ Error details:`, {
                message: metaErr.message,
                stack: metaErr.stack
              });
            }
            
            // STEP 4: Combine data
            return {
              tokenId: Number(tokenId),
              // NFT data (primary)
              currentOwner: currentOwner,
              producer: productInfo.producer,
              manufactureDate: Number(productInfo.creationDate),
              productType: productInfo.productType || 'physical',
              isActive: productInfo.isActive,
              isWarrantyValid: isWarrantyValid,
              // SupplyChain data (if available)
              ...(supplyChainData ? {
                status: Number(supplyChainData.status),
                distributor: supplyChainData.distributor,
                retailer: supplyChainData.retailer,
                buyer: supplyChainData.buyer,
                saleDate: supplyChainData.saleDate,
                saleDetails: supplyChainData.saleDetails
              } : {}),
              metadata: metadata
            };
          } catch (err) {
            console.error(`Error loading token ${tokenId}:`, err);
            return null;
          }
        })
      );
      
      // Final check before setting state
      if (currentAccount === account) {
        console.log('✅ Products loaded:', productsData.length);
        setProducts(productsData);
      }
    } catch (err) {
      console.error('❌ Error loading products:', err);
      if (currentAccount === account) {
        setError('Failed to load products: ' + (err.message || 'Unknown error'));
      }
    } finally {
      // Only update loading state if account hasn't changed
      if (currentAccount === account) {
        setLoading(false);
      }
    }
  };

  const handleTransfer = async (tokenId) => {
    const recipientAddress = prompt('Enter recipient wallet address:');
    if (!recipientAddress) return;

    // Validate address format
    if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid address format. Please enter a valid Ethereum address.');
      return;
    }

    try {
      setResaleLoading(tokenId);
      setError('');
      setSuccess('');

      await productNFTService.transferTo(signer, tokenId, recipientAddress);

      setSuccess(`Product #${tokenId} transferred successfully!`);
      await loadProducts();
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err.message || 'Failed to transfer product');
    } finally {
      setResaleLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="dashboard">
        <div className="card">
          <h2>Please Connect Wallet</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Buyer Dashboard</h1>
        <p>Your owned products and NFTs</p>
      </div>

      {accountInfo && (
        <div style={{ 
          padding: '0.75rem', 
          marginBottom: '1rem', 
          backgroundColor: accountInfo.isBuyer ? '#d4edda' : '#fff3cd',
          border: `1px solid ${accountInfo.isBuyer ? '#c3e6cb' : '#ffeaa7'}`,
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          <strong>Current Account:</strong> {accountInfo.address.substring(0, 10)}...{accountInfo.address.substring(accountInfo.address.length - 8)}
          <br/>
          <strong>Role:</strong> {accountInfo.role}
          {!accountInfo.isBuyer && (
            <>
              <br/>
              <span style={{ color: '#856404', fontWeight: 'bold' }}>
                ℹ️ This is not the Buyer account. You can still view products, but Buyer features may be limited.
              </span>
            </>
          )}
        </div>
      )}

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {roleError && (
        <div className="alert alert-warning" style={{ backgroundColor: '#fff3cd', borderColor: '#ffeaa7', color: '#856404', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>ℹ️ Account Info</strong>
          <p style={{ margin: '0.5rem 0 0 0' }}>{roleError}</p>
        </div>
      )}

      <div className="card">
        <h2>My Products ({products.length})</h2>
        {loading ? (
          <div className="loading-container">
            <span className="loading"></span> Loading...
          </div>
        ) : products.length === 0 ? (
          <p className="empty-state">You don't own any products yet. Purchase products from retailers to get started.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <div key={product.tokenId} className="product-card card">
                <div className="product-card-image-container">
                  {product.metadata?.images && product.metadata.images.length > 0 && product.metadata.images[0].url ? (
                    <img
                      src={product.metadata.images[0].url}
                      alt={product.metadata?.name || `Product #${product.tokenId}`}
                      className="product-card-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div class="product-card-no-image">📦</div>';
                      }}
                    />
                  ) : (
                    <div className="product-card-no-image">📦</div>
                  )}
                </div>
                <h3>{product.metadata?.name || `Product #${product.tokenId}`}</h3>
                {product.metadata?.description && (
                  <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
                    {product.metadata.description.substring(0, 100)}{product.metadata.description.length > 100 ? '...' : ''}
                  </p>
                )}
                {product.metadata?.model && (
                  <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '0.25rem' }}>
                    Model: {product.metadata.model}
                  </p>
                )}
                {product.metadata?.category && (
                  <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '0.25rem' }}>
                    Category: {product.metadata.category}
                  </p>
                )}
                <p style={{ marginTop: '0.5rem' }}>Type: {product.productType || 'N/A'}</p>
                <div className="product-meta">
                  {product.isWarrantyValid ? (
                    <span className="badge badge-success">Warranty Valid</span>
                  ) : (
                    <span className="badge badge-error">Warranty Expired</span>
                  )}
                </div>
                <div className="action-buttons" style={{ marginTop: '1rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/product/${product.tokenId}`)}
                  >
                    View Details
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleTransfer(product.tokenId)}
                    disabled={resaleLoading === product.tokenId}
                  >
                    {resaleLoading === product.tokenId ? (
                      <span className="loading"></span>
                    ) : (
                      '🔄 Transfer'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BuyerDashboard;

