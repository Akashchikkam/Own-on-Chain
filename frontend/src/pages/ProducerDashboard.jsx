import { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { uploadProductMetadata, uploadFileToIPFS, retrieveFromIPFS, ipfsToGatewayUrl, deleteFromIPFS } from '../utils/ipfs';
import { downloadProductQR } from '../utils/qr-generator';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';
import SecureSendModal from '../components/SecureSendModal';
import SecureReceiveModal from '../components/SecureReceiveModal';
import BatchTransferModal from '../components/BatchTransferModal';
import './Dashboard.css';

function ProducerDashboard() {
  const { provider, signer, account, isConnected } = useWeb3();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    productType: 'physical',
    category: '',
    serialNumber: '',
    model: '',
    warrantyPeriod: 365,
    manufacturer: {
      name: '',
      address: '',
      country: '',
      website: ''
    },
    specifications: {},
    images: []
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [transferLoading, setTransferLoading] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);

  const [roleError, setRoleError] = useState('');
  const [checkingRole, setCheckingRole] = useState(false);
  
  // General product selection state
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  useEffect(() => {
    if (isConnected && account && provider) {
      // Clear state immediately when account changes
      setProducts([]);
      setRoleError('');
      setError('');
      setSuccess('');
      
      // Then load data with small delay to ensure state is cleared
      const timer = setTimeout(() => {
        checkProducerRole();
        loadProducts();
      }, 150);
      
      return () => clearTimeout(timer);
    } else {
      // Clear state when disconnected
      setProducts([]);
      setRoleError('');
      setError('');
      setSuccess('');
    }
  }, [isConnected, account, provider]);

  const checkProducerRole = async () => {
    if (!provider || !account) return;
    
    try {
      setCheckingRole(true);
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      
      const hasProducerRole = await participantRegistryService.hasRole(provider, account, Role.PRODUCER);
      
      if (!hasProducerRole) {
        // Check what role they actually have
        try {
          const participant = await participantRegistryService.getParticipant(provider, account);
          const { RoleName } = await import('../contracts/config');
          const currentRole = RoleName[Number(participant.role)] || 'Unknown';
          
          if (Number(participant.role) === Role.PRODUCER && Number(participant.status) !== 1) {
            setRoleError(`⚠️ Your account is registered as Producer but NOT VERIFIED yet. Please wait for admin verification.`);
          } else {
            setRoleError(`❌ You are registered as ${currentRole}, not Producer. Switch to Producer account (Account #1) to create products.`);
          }
        } catch (err) {
          setRoleError(`❌ This account is not registered as Producer. Please register as Producer or switch to Producer account (Account #1).`);
        }
      } else {
        setRoleError('');
      }
    } catch (err) {
      console.error('Error checking role:', err);
    } finally {
      setCheckingRole(false);
    }
  };

  const loadProducts = async () => {
    if (!provider || !account) {
      setProducts([]);
      return;
    }
    
    const currentAccount = account;
    setLoading(true);
    console.log('🔍 Loading products for Producer:', currentAccount);
    
    // CRITICAL: Only load products if user is verified Producer
    // This prevents products showing in wrong dashboards
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      const hasProducerRole = await participantRegistryService.hasRole(provider, currentAccount, Role.PRODUCER);
      if (!hasProducerRole) {
        console.log('⚠️ Not a verified Producer - skipping product load');
        setProducts([]);
        setLoading(false);
        return;
      }
    } catch (roleCheckErr) {
      console.warn('⚠️ Could not verify Producer role - skipping product load:', roleCheckErr);
      setProducts([]);
      setLoading(false);
      return;
    }
    
    try {
      const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
      const tokenIds = await productNFTService.getTokensByOwner(provider, currentAccount);
      const productsData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const info = await productNFTService.getProductInfo(provider, tokenId);
          
          // Try to get product from SupplyChain, but handle gracefully if it doesn't exist
          let product = null;
          try {
            product = await supplyChainService.getProduct(provider, tokenId);
            console.log(`  ✅ Token ${tokenId} found in SupplyChain`);
          } catch (supplyChainErr) {
            // Product might not be registered in SupplyChain yet (e.g., just created)
            // This is OK - we'll still show it using NFT data
            if (supplyChainErr.message && supplyChainErr.message.includes('Product does not exist')) {
              console.warn(`  ⚠️ Token ${tokenId} not registered in SupplyChain (may be newly created)`);
            } else {
              console.error(`  ❌ Error loading product ${tokenId} from SupplyChain:`, supplyChainErr);
            }
          }
          
          // Load metadata to get images, description, model, category, etc.
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
                
                // Process image URLs to ensure they're accessible (convert IPFS URLs to gateway URLs)
                if (metadata.images && Array.isArray(metadata.images)) {
                  metadata.images = metadata.images.map(img => ({
                    ...img,
                    url: ipfsToGatewayUrl(img.url || img.ipfsUrl) // Convert both url and ipfsUrl to gateway URL
                  }));
                }
                
                console.log(`  ✅ Token ${tokenId} metadata loaded:`, {
                  name: metadata.name,
                  description: metadata.description,
                  imagesCount: metadata.images?.length || 0,
                  category: metadata.category,
                  model: metadata.model,
                  imageUrls: metadata.images?.map(img => img.url) || [],
                  fullImageData: metadata.images
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
          
          return {
            tokenId: Number(tokenId),
            ...info,
            ...(product || {}), // Spread product data if available, otherwise empty object
            // If product is null, get owner from NFT info
            currentOwner: product?.currentOwner || info?.owner || currentAccount,
            metadata,
            // Flag to indicate if product exists in SupplyChain (needed for batch transfers)
            existsInSupplyChain: !!product && product.tokenId !== undefined && product.tokenId !== null
          };
        })
      );
      
      // Filter out burned products (owner is burn address)
      const activeProducts = productsData.filter(p => {
        const owner = p.currentOwner?.toLowerCase();
        return owner !== BURN_ADDRESS.toLowerCase();
      });
      
      // Final check before setting state
      if (currentAccount === account) {
        console.log(`✅ Loaded ${activeProducts.length} active products for Producer (${productsData.length - activeProducts.length} burned)`);
        setProducts(activeProducts);
        setLoading(false);
      }
    } catch (err) {
      console.error('❌ Error loading products:', err);
      if (currentAccount === account) {
        setProducts([]);
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const result = await uploadFileToIPFS(file);
      if (result.success) {
        console.log('📸 Image uploaded:', result);
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, {
            url: result.gatewayUrl || result.ipfsUrl, // Use gatewayUrl for local mode (data URL)
            ipfsUrl: result.ipfsUrl, // Keep IPFS URL for reference
            type: 'main',
            description: file.name
          }]
        }));
        setSuccess('Image uploaded successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setError('Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (tokenId, e) => {
    e.stopPropagation(); // Prevent card click
    
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

  const handleDownloadQRSheet = async () => {
    // Get selected products
    const productsToDownload = products.filter(p => selectedProducts.has(p.tokenId.toString()));

    if (productsToDownload.length === 0) {
      setError('Please select at least one product to download QR sheet.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Extract token IDs and product info from selected products
      const tokenIds = productsToDownload.map(p => p.tokenId);
      const productData = productsToDownload.map(p => ({
        tokenId: p.tokenId,
        name: p.metadata?.name || `Product #${p.tokenId}`,
        serialNumber: p.metadata?.serialNumber || null,
        model: p.metadata?.model || null,
        productId: p.metadata?.productId || null
      }));
      const baseUrl = window.location.origin;

      // Call backend to generate PDF
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      // Ensure backendUrl doesn't end with /api (we'll add it)
      const baseBackendUrl = backendUrl.replace(/\/api$/, '');
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      try {
        const response = await fetch(`${baseBackendUrl}/api/qr-sheet/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenIds,
            productData, // Send product metadata directly
            baseUrl
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Try to parse error response
          let errorMessage = 'Failed to generate QR sheet PDF';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // If response is not JSON, use status text
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        // Check if response is actually a PDF
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/pdf')) {
          // Might be an error JSON response
          try {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server returned non-PDF response');
          } catch (e) {
            throw new Error('Server returned invalid response format');
          }
        }

        // Get PDF blob and download
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
        
        // Clear selection after successful download
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

  const handleToggleProductSelection = (tokenId, e) => {
    e.stopPropagation(); // Prevent card click
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

  const handleBatchDelete = async () => {
    const selectedTokenIds = Array.from(selectedProducts);
    if (selectedTokenIds.length === 0) {
      setError('Please select at least one product to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedTokenIds.length} product${selectedTokenIds.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const productsToDelete = products.filter(p => selectedProducts.has(p.tokenId.toString()));
      
      for (const product of productsToDelete) {
        try {
          await handleDelete(product.tokenId, null);
        } catch (err) {
          console.error(`Failed to delete product ${product.tokenId}:`, err);
        }
      }
      
      setSuccess(`Deleted ${productsToDelete.length} product${productsToDelete.length > 1 ? 's' : ''} successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
      // Clear selection and exit selection mode
      setSelectedProducts(new Set());
      setIsSelectionMode(false);
      
      // Reload products
      await loadProducts();
    } catch (err) {
      console.error('Error in batch delete:', err);
      setError('Failed to delete some products. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const handleBatchReceive = () => {
    // For batch receive, we still need to scan QR codes
    setError('Batch receive requires scanning QR codes. Please use "Scan to Receive" for individual products or scan multiple QR codes.');
    setTimeout(() => setError(''), 5000);
  };

  const handleDownloadQR = async (product, e) => {
    e.stopPropagation(); // Prevent card click
    
    try {
      const productName = product.metadata?.name || `Product-${product.tokenId}`;
      await downloadProductQR(
        product.tokenId,
        productName,
        product.metadata?.productId || null,
        product.metadata?.serialNumber || null
      );
      setSuccess(`QR code downloaded for ${productName}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error downloading QR code:', err);
      setError('Failed to download QR code');
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
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
          const baseBackendUrl = backendUrl.replace(/\/api$/, '');
          const lookupResponse = await fetch(`${baseBackendUrl}/api/product/lookup/${encodeURIComponent(result.productId)}/${encodeURIComponent(result.serialNumber || '')}`);
          
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
              const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
              const baseBackendUrl = backendUrl.replace(/\/api$/, '');
              const lookupResponse = await fetch(`${baseBackendUrl}/api/product/lookup/${encodeURIComponent(productId)}/${encodeURIComponent(serial)}`);
              
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
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
                const baseBackendUrl = backendUrl.replace(/\/api$/, '');
                const lookupResponse = await fetch(`${baseBackendUrl}/api/product/lookup/${encodeURIComponent(productId)}/${encodeURIComponent(serial)}`);
                
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
      // This prevents race conditions and ensures duplicate detection works even with rapid scanning
      if (batchMode) {
        if (scannedTokenIdsRef.current.has(tokenIdStr)) {
          // Try to get product name from existing batch products
          const existingProduct = batchProducts.find(p => p.tokenId.toString() === tokenIdStr);
          const existingProductName = existingProduct?.metadata?.name || `Product #${tokenIdStr}`;
          
          console.log(`🔒 Duplicate product BLOCKED: Token ID ${tokenIdStr} already in batch`);
          setScanFeedback({
            type: 'warning',
            message: `⚠️ Already added: ${existingProductName}`,
            productName: existingProductName
          });
          setTimeout(() => setScanFeedback(null), 3000);
          return; // Exit early - don't fetch product data if already added
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
        
        // Mark tokenId as scanned IMMEDIATELY and SYNCHRONOUSLY to prevent duplicates
        scannedTokenIdsRef.current.add(tokenIdStr);
      }
      
      // CRITICAL SECURITY CHECK 2: Check ownership BEFORE fetching product data
      // Fetch product details (only owner check first)
      setLoading(true);
      let owner;
      try {
        owner = await productNFTService.ownerOf(provider, tokenId);
      } catch (err) {
        console.error('Error checking ownership:', err);
        setError(`Failed to verify ownership: ${err.message}`);
        setLoading(false);
        // Remove from scanned set if ownership check failed
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
        // Remove from scanned set if ownership check failed
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
        // Final defensive check before adding (should never trigger due to earlier checks)
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
        message: `Failed to scan: ${err.message}`,
        productName: null
      });
      setTimeout(() => setScanFeedback(null), 3000);
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

  const handleDelete = async (tokenId, e) => {
    e.stopPropagation(); // Prevent card click
    
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently BURN this NFT and delete its metadata!\n\n' +
      'The NFT will be transferred to burn address (0x000...dead) and cannot be recovered.\n\n' +
      'Are you absolutely sure?'
    );
    
    if (!confirmed) return;

    try {
      setDeleteLoading(tokenId);
      setError('');
      setSuccess('');

      console.log('🔥 Starting product deletion for token:', tokenId);

      // Step 1: Get tokenURI (metadata hash) before burning
      const tokenURI = await productNFTService.getTokenURI(provider, tokenId);
      console.log('📎 Token URI to delete:', tokenURI);

      // Step 2: Burn NFT (transfer to burn address)
      const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
      console.log('🔥 Burning NFT to:', BURN_ADDRESS);
      await productNFTService.transferTo(signer, tokenId, BURN_ADDRESS);
      console.log('✅ NFT burned successfully');

      // Step 3: Delete metadata from IPFS
      if (tokenURI && tokenURI !== '') {
        console.log('🗑️ Deleting metadata from IPFS...');
        const deleteResult = await deleteFromIPFS(tokenURI);
        if (deleteResult.success) {
          console.log('✅ Metadata deleted successfully');
        } else {
          console.warn('⚠️ Failed to delete metadata:', deleteResult.error);
        }
      }

      setSuccess(`Product #${tokenId} burned and metadata deleted successfully!`);
      
      // Reload products (burned products will be filtered out)
      await loadProducts();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete product');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Upload metadata to IPFS
      const metadataResult = await uploadProductMetadata(formData);
      if (!metadataResult.success) {
        throw new Error('Failed to upload metadata to IPFS');
      }

      // Create product on blockchain
      const result = await supplyChainService.createProduct(
        signer,
        metadataResult.ipfsUrl,
        formData.productType,
        formData.warrantyPeriod
      );

      setSuccess(`Product created successfully! Token ID: ${result.tokenId}`);
      setShowCreateForm(false);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        productType: 'physical',
        category: '',
        serialNumber: '',
        model: '',
        warrantyPeriod: 365,
        manufacturer: { name: '', address: '', country: '', website: '' },
        specifications: {},
        images: []
      });

      // Reload products
      await loadProducts();
    } catch (err) {
      console.error('Product creation error:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="dashboard">
        <div className="card">
          <h2>Please Connect Wallet</h2>
          <p>Connect your wallet to access the producer dashboard.</p>
        </div>
      </div>
    );
  }

  // Show current account info
  const [accountInfo, setAccountInfo] = useState(null);

  useEffect(() => {
    if (isConnected && account && provider) {
      // Clear state immediately when account changes
      setAccountInfo(null);
      
      // Then fetch new account info with small delay
      const timer = setTimeout(() => {
        checkAccountInfo();
      }, 150);
      
      return () => clearTimeout(timer);
    } else {
      setAccountInfo(null);
    }
  }, [isConnected, account, provider]);

  const checkAccountInfo = async () => {
    if (!provider || !account) return;
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role, RoleName } = await import('../contracts/config');
      
      try {
        const participant = await participantRegistryService.getParticipant(provider, account);
        const role = RoleName[Number(participant.role)] || 'Not Registered';
        setAccountInfo({
          address: account,
          role: role,
          status: participant.status,
          isProducer: Number(participant.role) === Role.PRODUCER
        });
      } catch (err) {
        setAccountInfo({
          address: account,
          role: 'Not Registered',
          status: null,
          isProducer: false
        });
      }
    } catch (err) {
      console.error('Error checking account:', err);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Producer Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={!!roleError || loading}
          >
            {showCreateForm ? 'Cancel' : '+ Create Product'}
          </button>
          
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
                  <button 
                    className="btn"
                    onClick={handleBatchDelete}
                    disabled={loading || !!roleError}
                    style={{ backgroundColor: '#ff4444', color: 'white', fontSize: '0.9rem' }}
                    title="Delete selected products"
                  >
                    🗑️ Delete ({selectedProducts.size})
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

      {accountInfo && (
        <div style={{ 
          padding: '0.75rem', 
          marginBottom: '1rem', 
          backgroundColor: accountInfo.isProducer ? '#d4edda' : '#f8d7da',
          border: `1px solid ${accountInfo.isProducer ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          <strong>Current Account:</strong> {accountInfo.address.substring(0, 10)}...{accountInfo.address.substring(accountInfo.address.length - 8)}
          <br/>
          <strong>Role:</strong> {accountInfo.role}
          {!accountInfo.isProducer && (
            <>
              <br/>
              <span style={{ color: '#721c24', fontWeight: 'bold' }}>
                ❌ This is NOT the Producer account! Switch to Account #1 (0x7099...79C8)
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
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            <strong>Solution:</strong> Switch to Producer account (Account #1: <code>0x7099...79C8</code>) in MetaMask to create products.
          </p>
        </div>
      )}

      {showCreateForm && (
        <div className="form-section card">
          <h2>Create New Product</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label>Product Name *</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., iPhone 15 Pro Max"
                />
              </div>
              <div className="input-group">
                <label>Product Type *</label>
                <select
                  name="productType"
                  value={formData.productType}
                  onChange={handleInputChange}
                  required
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label>Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows="3"
                placeholder="Product description"
              />
            </div>

            <div className="form-row">
              <div className="input-group">
                <label>Serial Number *</label>
                <input
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="Unique serial number"
                />
              </div>
              <div className="input-group">
                <label>Model</label>
                <input
                  name="model"
                  value={formData.model}
                  onChange={handleInputChange}
                  placeholder="Model number"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label>Category</label>
                <input
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="e.g., Electronics, Clothing"
                />
              </div>
              <div className="input-group">
                <label>Warranty Period (days) *</label>
                <input
                  type="number"
                  name="warrantyPeriod"
                  value={formData.warrantyPeriod}
                  onChange={handleInputChange}
                  required
                  min="0"
                />
              </div>
            </div>

            <h3>Manufacturer Information</h3>
            <div className="form-row">
              <div className="input-group">
                <label>Manufacturer Name *</label>
                <input
                  name="manufacturer.name"
                  value={formData.manufacturer.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Company name"
                />
              </div>
              <div className="input-group">
                <label>Country</label>
                <input
                  name="manufacturer.country"
                  value={formData.manufacturer.country}
                  onChange={handleInputChange}
                  placeholder="Country"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Product Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={loading}
              />
              {formData.images.length > 0 && (
                <small>✓ {formData.images.length} image(s) uploaded</small>
              )}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !!roleError || checkingRole}
            >
              {loading ? (
                <>
                  <span className="loading"></span> Creating...
                </>
              ) : roleError ? (
                'Cannot Create - Wrong Account'
              ) : checkingRole ? (
                <>
                  <span className="loading"></span> Checking...
                </>
              ) : (
                'Create Product'
              )}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h2>
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
        {loading ? (
          <div className="loading-container">
            <span className="loading"></span> Loading products...
          </div>
        ) : products.length === 0 ? (
          <p className="empty-state">No products created yet. Create your first product above!</p>
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
                <div onClick={() => navigate(`/product/${product.tokenId}`)} style={{ cursor: 'pointer' }}>
                  {/* Square 1:1 Image */}
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
                  {!product.metadata && (
                    <p style={{ fontSize: '0.85rem', color: '#ff6b6b', marginTop: '0.5rem' }}>
                      ⚠️ Metadata lost (created before localStorage fix)
                    </p>
                  )}
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
                  <p style={{ marginTop: '0.5rem' }}>Token ID: {product.tokenId}</p>
                  <p>Type: {product.productType || 'N/A'}</p>
                  <div className="product-meta">
                    <span className="badge badge-primary">Producer</span>
                    <span>Warranty: {product.metadata?.warrantyPeriod || product.warrantyPeriod || 0} days</span>
                  </div>
                </div>
                <div className="action-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => handleTransfer(product.tokenId, e)}
                    disabled={transferLoading === product.tokenId || deleteLoading === product.tokenId}
                    style={{ flex: '1 1 calc(50% - 0.25rem)' }}
                  >
                    {transferLoading === product.tokenId ? (
                      <>
                        <span className="loading"></span> Transferring...
                      </>
                    ) : (
                      '🔄 Transfer'
                    )}
                  </button>
                  <button
                    className="btn"
                    onClick={(e) => handleDownloadQR(product, e)}
                    disabled={transferLoading === product.tokenId || deleteLoading === product.tokenId}
                    style={{ 
                      flex: '1 1 calc(50% - 0.25rem)',
                      backgroundColor: '#4CAF50',
                      color: 'white'
                    }}
                  >
                    📥 QR Code
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
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  Done ({batchProducts.length})
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setShowScanner(false);
                    setBatchProducts([]);
                    setBatchMode(false);
                    scannedTokenIdsRef.current.clear(); // Clear scanned token IDs
                  }}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Transfer Modal */}
      {showBatchModal && (
        <BatchTransferModal
          isOpen={showBatchModal}
          onClose={() => {
            setShowBatchModal(false);
            setBatchProducts([]);
            setBatchMode(false);
            scannedTokenIdsRef.current.clear(); // Clear scanned token IDs
            loadProducts(); // Reload to show updated ownership
            // Note: Selection is already cleared in handleBatchSend
          }}
          products={batchProducts}
          provider={provider}
          signer={signer}
          account={account}
          onSuccess={(message) => {
            setSuccess(message);
            setTimeout(() => setSuccess(''), 5000);
          }}
          onError={(error) => {
            setError(error);
            setTimeout(() => setError(''), 5000);
          }}
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

export default ProducerDashboard;

