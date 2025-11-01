import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { retrieveFromIPFS } from '../utils/ipfs';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function RetailerDashboard() {
  const { provider, signer, account, isConnected } = useWeb3();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saleLoading, setSaleLoading] = useState(null);
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
        checkRetailerRole();
        loadProducts(); // This will check role and only load if verified Retailer
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

  const checkRetailerRole = async () => {
    if (!provider || !account) return;
    
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role, RoleName } = await import('../contracts/config');
      
      const hasRetailerRole = await participantRegistryService.hasRole(provider, account, Role.RETAILER);
      
      if (!hasRetailerRole) {
        // Check what role they actually have
        try {
          const participant = await participantRegistryService.getParticipant(provider, account);
          const currentRole = RoleName[Number(participant.role)] || 'Unknown';
          
          if (Number(participant.role) === Role.RETAILER && Number(participant.status) !== 1) {
            setRoleError(`⚠️ Your account is registered as Retailer but NOT VERIFIED yet. Please wait for admin verification.`);
          } else {
            setRoleError(`❌ You are registered as ${currentRole}, not Retailer. Switch to Retailer account to view products.`);
          }
          
          setAccountInfo({
            address: account,
            role: currentRole,
            status: participant.status,
            isRetailer: false
          });
        } catch (err) {
          setRoleError(`❌ This account is not registered as Retailer. Please register as Retailer or switch to Retailer account.`);
          setAccountInfo({
            address: account,
            role: 'Not Registered',
            status: null,
            isRetailer: false
          });
        }
      } else {
        setRoleError('');
        try {
          const participant = await participantRegistryService.getParticipant(provider, account);
          setAccountInfo({
            address: account,
            role: RoleName[Number(participant.role)] || 'Retailer',
            status: participant.status,
            isRetailer: true
          });
        } catch (err) {
          // Ignore
        }
      }
    } catch (err) {
      console.error('Error checking role:', err);
    }
  };

  const loadProducts = async () => {
    if (!provider || !account) {
      console.log('⚠️ Missing provider or account:', { provider: !!provider, account: !!account });
      setProducts([]);
      return;
    }
    
    // Verify account hasn't changed during async operation
    const currentAccount = account;
    
    // CRITICAL: Only load products if user is verified Retailer
    // This prevents products showing in wrong dashboards
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      const hasRetailerRole = await participantRegistryService.hasRole(provider, currentAccount, Role.RETAILER);
      if (!hasRetailerRole) {
        console.log('⚠️ Not a verified Retailer - skipping product load');
        setProducts([]);
        setLoading(false);
        return;
      }
    } catch (roleCheckErr) {
      console.warn('⚠️ Could not verify Retailer role - skipping product load:', roleCheckErr);
      setProducts([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      console.log('🔍 Loading products for Retailer:', currentAccount);
      console.log('📍 Provider:', provider);
      console.log('📍 Contract addresses:', await import('../contracts/config').then(m => m.CONTRACT_ADDRESSES));
      
      // Step 1: Get tokens
      let tokenIds;
      try {
        tokenIds = await productNFTService.getTokensByOwner(provider, currentAccount);
        console.log('📦 Token IDs found:', tokenIds);
        console.log('📦 Token IDs type:', typeof tokenIds, Array.isArray(tokenIds));
        
        // Convert to numbers if needed
        if (tokenIds && tokenIds.length > 0) {
          tokenIds = tokenIds.map(t => Number(t));
          console.log('📦 Token IDs (normalized):', tokenIds);
        }
      } catch (tokenErr) {
        console.error('❌ Error getting tokens:', tokenErr);
        throw new Error('Failed to fetch token IDs: ' + tokenErr.message);
      }
      
      // Double-check account hasn't changed
      if (currentAccount !== account) {
        console.log('⚠️ Account changed during load, ignoring result');
        return;
      }
      
      if (!tokenIds || tokenIds.length === 0) {
        console.log('ℹ️ No tokens found for this account');
        if (currentAccount === account) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }
      
      // Step 2: Load product data - NEW ROBUST APPROACH
      // Always load from NFT contract first (guaranteed to work if token exists)
      // Then enrich with SupplyChain data if available (optional)
      console.log('📥 Loading product data for', tokenIds.length, 'tokens...');
      const productsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            console.log(`  Loading token ${tokenId}...`);
            
            // STEP 1: Always get basic info from NFT contract (source of truth for ownership)
            const productInfo = await productNFTService.getProductInfo(provider, tokenId);
            const currentOwner = await productNFTService.ownerOf(provider, tokenId);
            
            // Verify ownership matches - if not, skip this token
            if (currentOwner.toLowerCase() !== currentAccount.toLowerCase()) {
              console.warn(`  ⚠️ Token ${tokenId} owner mismatch: ${currentOwner} !== ${currentAccount}`);
              return null;
            }
            
            console.log(`  ✅ Token ${tokenId} NFT data loaded, owner: ${currentOwner}`);
            
            // STEP 2: Try to enrich with SupplyChain data (optional - doesn't break if missing)
            let supplyChainData = null;
            try {
              supplyChainData = await supplyChainService.getProduct(provider, tokenId);
              console.log(`  ✅ Token ${tokenId} SupplyChain data loaded`);
            } catch (supplyChainErr) {
              console.warn(`  ⚠️ Token ${tokenId} SupplyChain data not available (this is OK):`, supplyChainErr.message);
              // SupplyChain data is optional - product can exist without it
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
            
            // STEP 4: Combine data - NFT data is primary, SupplyChain is enrichment
            const product = {
              tokenId: Number(tokenId),
              currentOwner: currentOwner,
              producer: productInfo.producer,
              manufactureDate: Number(productInfo.creationDate),
              // SupplyChain data (if available) or defaults
              status: supplyChainData ? Number(supplyChainData.status) : (productInfo.isActive ? 2 : 0),
              distributor: supplyChainData?.distributor || null,
              retailer: supplyChainData?.retailer || null,
              buyer: supplyChainData?.buyer || null,
              saleDate: supplyChainData?.saleDate || 0,
              saleDetails: supplyChainData?.saleDetails || '',
              // NFT-specific fields
              productType: productInfo.productType || 'physical',
              isActive: productInfo.isActive,
              metadata: metadata
            };
            
            console.log(`  ✅ Token ${tokenId} product object created`);
            return product;
          } catch (productErr) {
            console.error(`  ❌ Error loading token ${tokenId}:`, productErr);
            // Return null but don't throw - let other tokens load
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validProducts = productsData.filter(p => p !== null);
      console.log('✅ Valid products:', validProducts.length);
      
      // Final check before setting state
      if (currentAccount === account) {
        console.log('✅ Setting products:', validProducts);
        setProducts(validProducts);
      }
    } catch (err) {
      console.error('❌ Error loading products:', err);
      console.error('❌ Error stack:', err.stack);
      if (currentAccount === account) {
        setError('Failed to load products: ' + (err.message || 'Unknown error'));
        setProducts([]); // Clear products on error
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
      setSaleLoading(tokenId);
      setError('');
      setSuccess('');

      // Validate recipient is registered and verified
      const { participantRegistryService, supplyChainService } = await import('../utils/contractHelpers');
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

      // Try to use SupplyChain method if recipient role matches, otherwise use direct NFT transfer
      // All transfers are tracked on blockchain (decentralized)
      try {
        if (recipientRole === Role.BUYER) {
          const saleDetails = prompt('Enter sale details (IPFS hash or description):') || '';
          await supplyChainService.sellToBuyer(signer, tokenId, recipientAddress, saleDetails);
          setSuccess(`Product #${tokenId} sold to Buyer successfully!`);
        } else {
          // Other roles (Distributor, Producer, etc.) - use direct NFT transfer (still tracked on blockchain)
          await productNFTService.transferTo(signer, tokenId, recipientAddress);
          setSuccess(`Product #${tokenId} transferred successfully! (Tracked on blockchain)`);
        }
      } catch (supplyChainErr) {
        // Fallback to direct NFT transfer (maintains decentralized blockchain tracking)
        console.warn('SupplyChain method failed, using direct NFT transfer:', supplyChainErr);
        await productNFTService.transferTo(signer, tokenId, recipientAddress);
        setSuccess(`Product #${tokenId} transferred successfully! (Tracked on blockchain)`);
      }

      await loadProducts();
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err.message || 'Failed to transfer product');
    } finally {
      setSaleLoading(null);
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
        <h1>Retailer Dashboard</h1>
        <p>Manage and sell products to customers</p>
      </div>

      {accountInfo && (
        <div style={{ 
          padding: '0.75rem', 
          marginBottom: '1rem', 
          backgroundColor: accountInfo.isRetailer ? '#d4edda' : '#f8d7da',
          border: `1px solid ${accountInfo.isRetailer ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          <strong>Current Account:</strong> {accountInfo.address.substring(0, 10)}...{accountInfo.address.substring(accountInfo.address.length - 8)}
          <br/>
          <strong>Role:</strong> {accountInfo.role}
          {!accountInfo.isRetailer && (
            <>
              <br/>
              <span style={{ color: '#721c24', fontWeight: 'bold' }}>
                ❌ This is NOT the Retailer account! Switch to Retailer account to view products.
              </span>
            </>
          )}
        </div>
      )}

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {roleError && (
        <div className="alert alert-error" style={{ backgroundColor: '#f8d7da', borderColor: '#f5c6cb', color: '#721c24', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>⚠️ Wrong Account!</strong>
          <p style={{ margin: '0.5rem 0 0 0' }}>{roleError}</p>
        </div>
      )}

      <div className="card">
        <h2>Available Products ({products.length})</h2>
        {loading ? (
          <div className="loading-container">
            <span className="loading"></span> Loading...
          </div>
        ) : products.length === 0 ? (
          <p className="empty-state">No products available for sale.</p>
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
                <p style={{ marginTop: '0.5rem' }}>Producer: {product.producer.substring(0, 10)}...</p>
                <div className="product-meta">
                  <span className="badge badge-success">For Sale</span>
                </div>
                <div className="action-buttons" style={{ marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleTransfer(product.tokenId)}
                    disabled={saleLoading === product.tokenId}
                  >
                    {saleLoading === product.tokenId ? (
                      <span className="loading"></span>
                    ) : (
                      '🔄 Transfer'
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate(`/product/${product.tokenId}`)}
                  >
                    View Details
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

export default RetailerDashboard;

