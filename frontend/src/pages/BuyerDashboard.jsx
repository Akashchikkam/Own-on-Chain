import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { retrieveFromIPFS, ipfsToGatewayUrl } from '../utils/ipfs';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';
import SecureSendModal from '../components/SecureSendModal';
import SecureReceiveModal from '../components/SecureReceiveModal';
import { getBackendApiUrl } from '../utils/api';
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
  
  // General product selection state
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanMode, setScanMode] = useState(null); // 'send' or 'receive'
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

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

  const handleTransfer = async (tokenId, e) => {
    if (e) e.stopPropagation();
    
    // Find the product in the products array
    const product = products.find(p => p.tokenId === tokenId);
    if (!product) {
      setError('Product not found');
      return;
    }

    // Load full product details (owner, metadata) if not already loaded
    try {
      setLoading(true);
      const owner = await productNFTService.ownerOf(provider, tokenId);
      const tokenURI = await productNFTService.getTokenURI(provider, tokenId);
      
      let metadata = product.metadata;
      if (!metadata && tokenURI && tokenURI !== '') {
        const result = await retrieveFromIPFS(tokenURI);
        if (result) {
          metadata = result;
          if (metadata.images && metadata.images.length > 0) {
            metadata.images = metadata.images.map(img => ({
              ...img,
              url: ipfsToGatewayUrl(img.url || img.ipfsUrl)
            }));
          }
        }
      }

      const transferProduct = {
        tokenId,
        owner,
        metadata: metadata || product.metadata
      };

      setScannedProduct(transferProduct);
      setShowSendModal(true);
    } catch (err) {
      console.error('Error loading product for transfer:', err);
      setError('Failed to load product details for transfer');
    } finally {
      setLoading(false);
    }
  };

  // Selection handlers
  const handleToggleProductSelection = (tokenId, e) => {
    e.stopPropagation();
    const tokenIdStr = tokenId.toString();
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tokenIdStr)) {
        newSet.delete(tokenIdStr);
      } else {
        newSet.add(tokenIdStr);
      }
      return newSet;
    });
  };

  const handleSelectAllProducts = () => {
    const allTokenIds = new Set(products.map(p => p.tokenId.toString()));
    setSelectedProducts(allTokenIds);
  };

  const handleClearSelection = () => {
    setSelectedProducts(new Set());
  };

  const handleCancelSelection = () => {
    setSelectedProducts(new Set());
    setIsSelectionMode(false);
  };

  const handleDownloadQRSheet = async () => {
    const productsToDownload = products.filter(p => selectedProducts.has(p.tokenId.toString()));

    if (productsToDownload.length === 0) {
      setError('Please select at least one product to download QR sheet.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const tokenIds = productsToDownload.map(p => p.tokenId);
      const productData = productsToDownload.map(p => ({
        tokenId: p.tokenId,
        name: p.metadata?.name || `Product #${p.tokenId}`,
        serialNumber: p.metadata?.serialNumber || null,
        model: p.metadata?.model || null,
        productId: p.metadata?.productId || null
      }));
      const baseUrl = window.location.origin;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        const response = await fetch(getBackendApiUrl('/qr-sheet/generate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenIds,
            productData,
            baseUrl
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = 'Failed to generate QR sheet PDF';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
          try {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server returned non-PDF response');
          } catch (e) {
            throw new Error('Server returned invalid response format');
          }
        }

        const blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error('Generated PDF is empty');
        }
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-sheet-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setSuccess(`QR Sheet PDF generated successfully with ${productsToDownload.length} product${productsToDownload.length > 1 ? 's' : ''}!`);
        setTimeout(() => setSuccess(''), 3000);
        
        setSelectedProducts(new Set());
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again with fewer products.');
        }
        throw fetchError;
      }
    } catch (err) {
      console.error('Error generating QR sheet:', err);
      setError(err.message || 'Failed to generate QR sheet PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleScanProduct = (mode = 'send') => {
    setScanMode(mode);
    setShowScanner(true);
  };

  const handleScanSuccess = async (result) => {
    console.log('Scan result:', result);
    setShowScanner(false);
    
    try {
      let tokenId;
      
      // Extract token ID from scan result
      if (result.tokenId) {
        tokenId = result.tokenId;
      } else if (result.productId) {
        // Try backend lookup for product ID + serial
        try {
          const lookupResponse = await fetch(
            getBackendApiUrl(`/product/lookup/${encodeURIComponent(result.productId)}/${encodeURIComponent(result.serialNumber || '')}`)
          );
          
          if (lookupResponse.ok) {
            const lookupResult = await lookupResponse.json();
            if (lookupResult.success && lookupResult.data) {
              tokenId = lookupResult.data.tokenId;
            }
          }
        } catch (lookupErr) {
          console.warn('Product ID lookup failed:', lookupErr);
        }
        
        if (!tokenId) {
          setError('Product ID lookup failed. Please scan QR code with token ID.');
          return;
        }
      } else if (result.url) {
        // Parse URL to get token ID
        const urlPath = result.url.pathname;
        if (urlPath.includes('/verify/')) {
          tokenId = urlPath.split('/verify/')[1];
        } else if (result.url.searchParams) {
          // Handle /verify?id=xxx&serial=xxx format
          const productId = result.url.searchParams.get('id');
          const serial = result.url.searchParams.get('serial');
          if (productId && serial) {
            try {
              const lookupResponse = await fetch(
                getBackendApiUrl(`/product/lookup/${encodeURIComponent(productId)}/${encodeURIComponent(serial)}`)
              );
              
              if (lookupResponse.ok) {
                const lookupResult = await lookupResponse.json();
                if (lookupResult.success && lookupResult.data) {
                  tokenId = lookupResult.data.tokenId;
                }
              }
            } catch (lookupErr) {
              console.warn('Product ID lookup failed:', lookupErr);
            }
          }
        }
      } else if (result.raw) {
        // Try to parse raw text as URL
        try {
          const url = new URL(result.raw);
          if (url.pathname.includes('/verify/')) {
            tokenId = url.pathname.split('/verify/')[1];
          } else if (url.searchParams) {
            const productId = url.searchParams.get('id');
            const serial = url.searchParams.get('serial');
            if (productId && serial) {
              try {
                const lookupResponse = await fetch(
                  getBackendApiUrl(`/product/lookup/${encodeURIComponent(productId)}/${encodeURIComponent(serial)}`)
                );
                
                if (lookupResponse.ok) {
                  const lookupResult = await lookupResponse.json();
                  if (lookupResult.success && lookupResult.data) {
                    tokenId = lookupResult.data.tokenId;
                  }
                }
              } catch (lookupErr) {
                console.warn('Product ID lookup failed:', lookupErr);
              }
            }
          }
        } catch (e) {
          // Not a URL, might be just token ID
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
        if (result) {
          metadata = result;
          if (metadata.images && metadata.images.length > 0) {
            metadata.images = metadata.images.map(img => ({
              ...img,
              url: ipfsToGatewayUrl(img.url || img.ipfsUrl)
            }));
          }
        }
      }
      
      setScannedProduct({
        tokenId,
        owner,
        metadata
      });
      
      // Based on scan mode, open appropriate modal
      if (scanMode === 'send') {
        setShowSendModal(true);
      } else if (scanMode === 'receive') {
        setShowReceiveModal(true);
      } else {
        setSuccess(`Product #${tokenId} scanned successfully!`);
      }
      
    } catch (err) {
      console.error('Error loading scanned product:', err);
      setError('Failed to load product details. Product may not exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanError = (error) => {
    console.error('Scan error:', error);
    setError('Failed to scan. Please try again.');
  };

  const handleSendSuccess = (message) => {
    setSuccess(message);
    setScannedProduct(null);
    setShowSendModal(false);
    loadProducts();
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleReceiveSuccess = (message) => {
    setSuccess(message);
    setScannedProduct(null);
    setShowReceiveModal(false);
    loadProducts();
    setTimeout(() => setSuccess(''), 5000);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>
            My Products ({products.length})
            {isSelectionMode && selectedProducts.size > 0 && (
              <span style={{ fontSize: '0.9rem', color: '#4CAF50', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                • {selectedProducts.size} selected
              </span>
            )}
            {isSelectionMode && (
              <span style={{ fontSize: '0.9rem', color: '#2196F3', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                (Selection Mode - Click products to select)
              </span>
            )}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Select Mode Toggle */}
            {!isSelectionMode ? (
              <button 
                className="btn"
                onClick={() => setIsSelectionMode(true)}
                disabled={products.length === 0 || loading || !!roleError}
                style={{ backgroundColor: '#2196F3', color: 'white' }}
                title="Enter selection mode to choose products for batch actions"
              >
                ✓ Select Products
              </button>
            ) : (
              <>
                <button 
                  className="btn"
                  onClick={handleSelectAllProducts}
                  disabled={products.length === 0 || loading || !!roleError}
                  style={{ backgroundColor: '#2196F3', color: 'white', fontSize: '0.9rem' }}
                  title="Select all products"
                >
                  ✓ Select All
                </button>
                {selectedProducts.size > 0 && (
                  <>
                    <button 
                      className="btn"
                      onClick={handleClearSelection}
                      disabled={loading || !!roleError}
                      style={{ backgroundColor: '#FF9800', color: 'white', fontSize: '0.9rem' }}
                      title="Clear selection"
                    >
                      ✕ Clear ({selectedProducts.size})
                    </button>
                    <button 
                      className="btn"
                      onClick={handleDownloadQRSheet}
                      disabled={loading || !!roleError}
                      style={{ backgroundColor: '#4CAF50', color: 'white', fontSize: '0.9rem' }}
                      title="Download QR sheet PDF for selected products"
                    >
                      📄 Download QR PDF ({selectedProducts.size})
                    </button>
                  </>
                )}
                <button 
                  className="btn"
                  onClick={handleCancelSelection}
                  disabled={loading || !!roleError}
                  style={{ backgroundColor: '#666', color: 'white', fontSize: '0.9rem' }}
                  title="Cancel selection mode"
                >
                  ✕ Cancel
                </button>
              </>
            )}
            <button 
              className="btn"
              onClick={() => handleScanProduct('send')}
              disabled={!isConnected}
              style={{ backgroundColor: '#1976d2', color: 'white' }}
            >
              📤 Scan to Send
            </button>
            <button 
              className="btn"
              onClick={() => handleScanProduct('receive')}
              disabled={!isConnected}
              style={{ backgroundColor: '#4CAF50', color: 'white' }}
            >
              📥 Scan to Receive
            </button>
          </div>
        </div>
        {loading ? (
          <div className="loading-container">
            <span className="loading"></span> Loading...
          </div>
        ) : products.length === 0 ? (
          <p className="empty-state">You don't own any products yet. Purchase products from retailers to get started.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <div 
                key={product.tokenId} 
                className="product-card card"
                style={{
                  position: 'relative',
                  border: isSelectionMode && selectedProducts.has(product.tokenId.toString()) 
                    ? '2px solid #4CAF50' 
                    : isSelectionMode 
                    ? '2px solid #e0e0e0' 
                    : undefined
                }}
              >
                {/* Selection checkbox - only show in selection mode */}
                {isSelectionMode && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      zIndex: 10
                    }}
                    onClick={(e) => handleToggleProductSelection(product.tokenId, e)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.tokenId.toString())}
                      onChange={(e) => handleToggleProductSelection(product.tokenId, e)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#4CAF50'
                      }}
                      title="Select product"
                    />
                  </div>
                )}
                <div className="product-card-image-container">
                  {product.metadata?.images && product.metadata.images.length > 0 && product.metadata.images[0].url ? (
                    <img
                      src={product.metadata.images[0].url}
                      alt={product.metadata?.name || `Product #${product.tokenId}`}
                      className="product-card-image"
                      onError={(e) => {
                        const img = e.target;
                        const originalUrl = img.src;
                        
                        // Track which gateway we've tried
                        const triedGateways = img.dataset.triedGateways ? JSON.parse(img.dataset.triedGateways) : [];
                        triedGateways.push(originalUrl);
                        
                        console.warn(`Failed to load image for product ${product.tokenId}:`, originalUrl);
                        console.log(`Tried gateways so far:`, triedGateways);
                        
                        // Extract IPFS hash from URL
                        const hashMatch = originalUrl.match(/\/ipfs\/([^\/\s?]+)/);
                        if (hashMatch) {
                          const hash = hashMatch[1];
                          const allGateways = [
                            `https://cloudflare-ipfs.com/ipfs/${hash}`,
                            `https://ipfs.io/ipfs/${hash}`,
                            `https://dweb.link/ipfs/${hash}`,
                            `https://gateway.pinata.cloud/ipfs/${hash}`
                          ];
                          
                          // Find the next gateway we haven't tried yet
                          const nextGateway = allGateways.find(g => !triedGateways.includes(g));
                          
                          if (nextGateway) {
                            console.log(`🔄 Trying alternative gateway: ${nextGateway}`);
                            img.dataset.triedGateways = JSON.stringify(triedGateways);
                            img.src = nextGateway;
                            return; // Don't hide image yet, try next gateway
                          }
                        }
                        
                        // All gateways failed - hide image and show placeholder
                        console.error(`❌ All gateways failed for product ${product.tokenId}`);
                        img.style.display = 'none';
                        const parent = img.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="product-card-no-image">📦</div>';
                        }
                      }}
                      onLoad={() => {
                        console.log(`✅ Image loaded successfully for product ${product.tokenId}`);
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
                    onClick={(e) => handleTransfer(product.tokenId, e)}
                    disabled={resaleLoading === product.tokenId || loading}
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

      {/* Scanner Modal */}
      {showScanner && (
        <Scanner
          onScan={handleScanSuccess}
          onError={handleScanError}
          onClose={() => setShowScanner(false)}
          mode="qr"
        />
      )}

      {/* Secure Send Modal */}
      {scannedProduct && (
        <SecureSendModal
          isOpen={showSendModal}
          onClose={() => {
            setShowSendModal(false);
            setScannedProduct(null);
          }}
          product={scannedProduct}
          provider={provider}
          signer={signer}
          account={account}
          onSuccess={handleSendSuccess}
          onError={(err) => setError(err)}
        />
      )}

      {/* Secure Receive Modal */}
      {scannedProduct && (
        <SecureReceiveModal
          isOpen={showReceiveModal}
          onClose={() => {
            setShowReceiveModal(false);
            setScannedProduct(null);
          }}
          product={scannedProduct}
          provider={provider}
          signer={signer}
          account={account}
          onSuccess={handleReceiveSuccess}
          onError={(err) => setError(err)}
        />
      )}
    </div>
  );
}

export default BuyerDashboard;

