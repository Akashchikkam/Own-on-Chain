import { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { retrieveFromIPFS, ipfsToGatewayUrl } from '../utils/ipfs';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';
import SecureSendModal from '../components/SecureSendModal';
import SecureReceiveModal from '../components/SecureReceiveModal';
import BatchTransferModal from '../components/BatchTransferModal';
import { getBackendApiUrl } from '../utils/api';
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
  
  // General product selection state
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanMode, setScanMode] = useState(null); // 'send' or 'receive'
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  
  // Batch scanning state
  const [batchMode, setBatchMode] = useState(false);
  const [batchProducts, setBatchProducts] = useState([]);
  const scannedTokenIdsRef = useRef(new Set()); // Use ref for synchronous duplicate checking
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // For showing product name after scan

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

  const handleBatchSend = () => {
    const selectedProductsList = products.filter(p => selectedProducts.has(p.tokenId.toString()));
    if (selectedProductsList.length === 0) {
      setError('Please select at least one product to send.');
      return;
    }
    
    setBatchProducts(selectedProductsList);
    setShowBatchModal(true);
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

  const handleScanProduct = (mode = 'send', enableBatch = false) => {
    setScanMode(mode);
    setBatchMode(enableBatch);
    setBatchProducts(enableBatch ? [] : []);
    scannedTokenIdsRef.current.clear(); // Reset scanned token IDs when starting new batch
    setShowScanner(true);
    setScanFeedback(null);
  };

  const handleScanSuccess = async (result) => {
    console.log('Scan result:', result);
    
    // In batch mode, don't close scanner
    if (!batchMode) {
      setShowScanner(false);
    }
    
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
      
      const tokenIdStr = tokenId.toString();
      
      // CRITICAL SECURITY CHECK 1: Check for duplicates IMMEDIATELY (synchronously) using ref
      if (batchMode) {
        if (scannedTokenIdsRef.current.has(tokenIdStr)) {
          const existingProduct = batchProducts.find(p => p.tokenId.toString() === tokenIdStr);
          const existingProductName = existingProduct?.metadata?.name || `Product #${tokenIdStr}`;
          
          console.log(`🔒 Duplicate product BLOCKED: Token ID ${tokenIdStr} already in batch`);
          setScanFeedback({
            type: 'warning',
            message: `⚠️ Already added: ${existingProductName}`,
            productName: existingProductName
          });
          setTimeout(() => setScanFeedback(null), 3000);
          return;
        }
        
        // Also check against batchProducts array (defensive check)
        if (batchProducts.some(p => p.tokenId.toString() === tokenIdStr)) {
          const existingProduct = batchProducts.find(p => p.tokenId.toString() === tokenIdStr);
          const existingProductName = existingProduct?.metadata?.name || `Product #${tokenIdStr}`;
          
          console.log(`🔒 Duplicate product BLOCKED: Token ID ${tokenIdStr} already in batchProducts array`);
          setScanFeedback({
            type: 'warning',
            message: `⚠️ Already added: ${existingProductName}`,
            productName: existingProductName
          });
          setTimeout(() => setScanFeedback(null), 3000);
          return;
        }
        
        // Mark tokenId as scanned IMMEDIATELY and SYNCHRONOUSLY
        scannedTokenIdsRef.current.add(tokenIdStr);
      }
      
      // CRITICAL SECURITY CHECK 2: Check ownership BEFORE fetching product data
      setLoading(true);
      let owner;
      try {
        owner = await productNFTService.ownerOf(provider, tokenId);
      } catch (err) {
        console.error('Error checking ownership:', err);
        setError(`Failed to verify ownership: ${err.message}`);
        setLoading(false);
        if (batchMode) {
          scannedTokenIdsRef.current.delete(tokenIdStr);
        }
        return;
      }
      
      // CRITICAL SECURITY CHECK 3: Verify user owns the product
      if (batchMode && account && owner.toLowerCase() !== account.toLowerCase()) {
        console.log(`🔒 Ownership check FAILED: User ${account} does not own Token ID ${tokenIdStr}`);
        setScanFeedback({
          type: 'error',
          message: `✗ Not owned by you: Product #${tokenIdStr}`,
          productName: null
        });
        setTimeout(() => setScanFeedback(null), 3000);
        setError(`You do not own Product #${tokenIdStr}. Only products you own can be added to batch.`);
        setLoading(false);
        scannedTokenIdsRef.current.delete(tokenIdStr);
        return;
      }
      
      // Now fetch full product details (metadata, etc.)
      const tokenURI = await productNFTService.getTokenURI(provider, tokenId);
      
      // Check if product exists and get metadata
      let metadata = null;
      if (tokenURI && tokenURI !== '') {
        const ipfsResult = await retrieveFromIPFS(tokenURI);
        if (ipfsResult) {
          metadata = ipfsResult.success ? ipfsResult.data : ipfsResult;
          if (metadata && metadata.images && metadata.images.length > 0) {
            metadata.images = metadata.images.map(img => ({
              ...img,
              url: ipfsToGatewayUrl(img.url || img.ipfsUrl)
            }));
          }
        }
      }
      
      const productData = {
        tokenId,
        owner,
        metadata
      };
      
      const productName = metadata?.name || `Product #${tokenId}`;
      
      // Show feedback with product name
      if (batchMode) {
        // Final defensive check before adding
        if (scannedTokenIdsRef.current.has(tokenIdStr) && batchProducts.some(p => p.tokenId.toString() === tokenIdStr)) {
          const existingProduct = batchProducts.find(p => p.tokenId.toString() === tokenIdStr);
          const existingProductName = existingProduct?.metadata?.name || productName;
          console.log(`🔒 Final duplicate check triggered: ${tokenIdStr}`);
          setScanFeedback({
            type: 'warning',
            message: `⚠️ Already added: ${existingProductName}`,
            productName: existingProductName
          });
          setTimeout(() => setScanFeedback(null), 3000);
          setLoading(false);
          return;
        }
        
        // Add to batch list
        setBatchProducts(prev => [...prev, productData]);
        setScanFeedback({
          type: 'success',
          message: `✓ Added: ${productName}`,
          productName
        });
        setTimeout(() => setScanFeedback(null), 3000);
        setSuccess(`Added ${productName} to batch (${batchProducts.length + 1} products)`);
        setTimeout(() => setSuccess(''), 2000);
      } else {
        // Single product mode
        setScannedProduct(productData);
        
        // Based on scan mode, open appropriate modal
        if (scanMode === 'send') {
          setShowSendModal(true);
        } else if (scanMode === 'receive') {
          setShowReceiveModal(true);
        } else {
          setSuccess(`Product ${productName} scanned successfully!`);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading scanned product:', err);
      setError(`Failed to load product: ${err.message}`);
      setLoading(false);
      setScanFeedback({
        type: 'error',
        message: `✗ Error: ${err.message}`,
        productName: null
      });
      setTimeout(() => setScanFeedback(null), 3000);
      
      // Remove from scanned set if batch mode (tokenId may not be defined in catch)
      if (batchMode) {
        scannedTokenIdsRef.current.clear();
      }
    }
  };

  const handleScanError = (error) => {
    console.error('Scan error:', error);
    setError('Failed to scan. Please try again.');
  };

  const handleSendSuccess = async (message, transferData = null) => {
    // Trigger webhook for product transfer if transfer data is provided
    // Only notify the SENDER (privacy: producer doesn't see distributor/retailer transfers)
    if (transferData && transferData.tokenId && transferData.to) {
      try {
        const webhookData = {
          tokenId: transferData.tokenId.toString(),
          from: account,
          to: transferData.to,
          transferType: transferData.transferType || 'transfer',
          productName: transferData.productName || `Product #${transferData.tokenId}`
        };

        const webhookResponse = await fetch(getBackendApiUrl('/webhooks/trigger'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'product.transferred',
            data: webhookData,
            walletAddress: account // Only notify the sender
          })
        });

        if (webhookResponse.ok) {
          const webhookResult = await webhookResponse.json();
          console.log('✅ Transfer webhook triggered:', webhookResult);
        } else {
          console.warn('⚠️ Transfer webhook trigger failed (non-critical)');
        }
      } catch (webhookErr) {
        console.warn('⚠️ Transfer webhook trigger error (non-critical):', webhookErr);
      }
    }
    setSuccess(message);
    setScannedProduct(null);
    setShowSendModal(false);
    setBatchProducts([]);
    scannedTokenIdsRef.current.clear();
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
  
  const handleBatchSendSuccess = (message) => {
    setSuccess(message);
    setBatchProducts([]);
    scannedTokenIdsRef.current.clear();
    setShowBatchModal(false);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>
            Available Products ({products.length})
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
                    <button 
                      className="btn"
                      onClick={handleBatchSend}
                      disabled={loading || !!roleError || !isConnected}
                      style={{ backgroundColor: '#9C27B0', color: 'white', fontSize: '0.9rem' }}
                      title="Batch send selected products"
                    >
                      📤 Batch Send ({selectedProducts.size})
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
              onClick={() => handleScanProduct('send', true)}
              disabled={!isConnected}
              style={{ backgroundColor: '#9C27B0', color: 'white' }}
            >
              📦 Batch Scan & Send
            </button>
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
          <p className="empty-state">No products available for sale.</p>
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
                <p style={{ marginTop: '0.5rem' }}>Producer: {product.producer.substring(0, 10)}...</p>
                <div className="product-meta">
                  <span className="badge badge-success">For Sale</span>
                </div>
                <div className="action-buttons" style={{ marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => handleTransfer(product.tokenId, e)}
                    disabled={saleLoading === product.tokenId || loading}
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

      {/* Scanner Modal */}
      {showScanner && (
        <div style={{ position: 'relative' }}>
          <Scanner
            onScan={handleScanSuccess}
            onError={handleScanError}
            onClose={() => {
              setShowScanner(false);
              if (batchMode && batchProducts.length > 0) {
                setShowBatchModal(true);
              }
            }}
            mode="qr"
            continuous={batchMode} // Keep scanner open for batch mode
          />
          {batchMode && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 10000,
              backgroundColor: 'white',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              maxWidth: '300px'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Batch Mode</h3>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                Scanned: {batchProducts.length} product(s)
              </p>
              {scanFeedback && (
                <div style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor: scanFeedback.type === 'success' ? '#d4edda' : 
                                 scanFeedback.type === 'warning' ? '#fff3cd' : '#f8d7da',
                  color: scanFeedback.type === 'success' ? '#155724' : 
                        scanFeedback.type === 'warning' ? '#856404' : '#721c24',
                  fontSize: '0.9rem',
                  fontWeight: scanFeedback.type === 'warning' ? 'bold' : 'normal',
                  border: scanFeedback.type === 'warning' ? '2px solid #ffc107' : 'none'
                }}>
                  {scanFeedback.message}
                </div>
              )}
              {batchProducts.length > 0 && (
                <div style={{
                  padding: '0.5rem',
                  marginBottom: '0.5rem',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  color: '#1976d2',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  <strong>Products added:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {batchProducts.map((p, idx) => (
                      <div key={`${p.tokenId}-${idx}`} style={{ 
                        padding: '0.25rem 0',
                        borderBottom: idx < batchProducts.length - 1 ? '1px solid #90caf9' : 'none',
                        fontSize: '0.8rem'
                      }}>
                        ✓ {p.metadata?.name || `Product #${p.tokenId}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowScanner(false);
                    if (batchProducts.length > 0) {
                      setShowBatchModal(true);
                    }
                  }}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem' }}
                >
                  Done ({batchProducts.length})
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowScanner(false);
                    setBatchMode(false);
                    setBatchProducts([]);
                    scannedTokenIdsRef.current.clear();
                    setScanFeedback(null);
                  }}
                  style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
          onSuccess={(message, data) => handleSendSuccess(message, data)}
          onError={(err) => setError(err)}
        />
      )}

      {/* Batch Transfer Modal */}
      {showBatchModal && batchProducts.length > 0 && (
        <BatchTransferModal
          isOpen={showBatchModal}
          onClose={() => {
            setShowBatchModal(false);
            setBatchProducts([]);
            scannedTokenIdsRef.current.clear();
          }}
          products={batchProducts}
          provider={provider}
          signer={signer}
          account={account}
          onSuccess={handleBatchSendSuccess}
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

export default RetailerDashboard;

