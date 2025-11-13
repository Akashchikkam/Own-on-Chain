import { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { productIdentifierService } from '../utils/productIdentifier';
import { gtinLinkerService } from '../utils/gtinLinker';
import { uploadProductMetadata, uploadFileToIPFS, retrieveFromIPFS, ipfsToGatewayUrl, deleteFromIPFS } from '../utils/ipfs';
import { downloadProductQR } from '../utils/qr-generator';
import { getBackendApiUrl } from '../utils/api';
import { verifyOwnership } from '../utils/securityHelpers';
import { createProductsFromTemplate } from '../utils/batchProductCreator';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';
import SecureSendModal from '../components/SecureSendModal';
import SecureReceiveModal from '../components/SecureReceiveModal';
import BatchTransferModal from '../components/BatchTransferModal';
import WebhookManager from '../components/WebhookManager';
import './Dashboard.css';

function ProducerDashboard() {
  const { provider, signer, account, isConnected } = useWeb3();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBatchCreate, setShowBatchCreate] = useState(false);
  const [batchProgress, setBatchProgress] = useState({});
  const [batchCreating, setBatchCreating] = useState(false);
  
  // Module availability
  const [hasProductIdentifier, setHasProductIdentifier] = useState(false);
  const [hasGtinLinker, setHasGtinLinker] = useState(false);
  
  // Product identifiers state
  const [productBlockchainIds, setProductBlockchainIds] = useState({});
  const [productGtins, setProductGtins] = useState({});
  const [linkingGtin, setLinkingGtin] = useState(null);
  const [gtinInputs, setGtinInputs] = useState({});
  
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
  const [showWebhookManager, setShowWebhookManager] = useState(false);
  
  // Debug: Track webhook manager state
  useEffect(() => {
    if (showWebhookManager) {
      console.log('Webhook Manager opened, account:', account);
      // Scroll to webhook manager after a short delay to ensure it's rendered
      setTimeout(() => {
        const webhookElement = document.querySelector('.webhook-manager');
        if (webhookElement) {
          webhookElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [showWebhookManager, account]);

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

  // Check if modules are available
  const checkModuleAvailability = async () => {
    if (!provider) return;
    try {
      const hasPI = await productIdentifierService.isAvailable(provider);
      const hasGL = await gtinLinkerService.isAvailable(provider);
      setHasProductIdentifier(hasPI);
      setHasGtinLinker(hasGL);
      console.log('📦 Module availability:', { ProductIdentifier: hasPI, GtinLinker: hasGL });
    } catch (err) {
      console.warn('⚠️ Error checking module availability:', err);
    }
  };

  // Load blockchain IDs and GTINs for products
  useEffect(() => {
    if (products.length > 0 && provider && (hasProductIdentifier || hasGtinLinker)) {
      loadProductIdentifiers();
    }
  }, [products, provider, hasProductIdentifier, hasGtinLinker]);

  const loadProductIdentifiers = async () => {
    if (!provider) return;
    
    const blockchainIds = {};
    const gtins = {};
    
    for (const product of products) {
      const tokenId = product.tokenId;
      
      // Load blockchain ID
      if (hasProductIdentifier) {
        try {
          const blockchainId = await productIdentifierService.getBlockchainId(provider, tokenId);
          if (blockchainId) {
            blockchainIds[tokenId] = blockchainId;
          }
        } catch (err) {
          // Product may not have blockchain ID registered yet
        }
      }
      
      // Load GTIN
      if (hasGtinLinker) {
        try {
          const gtin = await gtinLinkerService.getGtinByTokenId(provider, tokenId);
          if (gtin) {
            gtins[tokenId] = gtin;
          }
        } catch (err) {
          // Product may not have GTIN linked yet
        }
      }
    }
    
    setProductBlockchainIds(blockchainIds);
    setProductGtins(gtins);
  };

  const checkProducerRole = async () => {
    if (!provider || !account) return;
    
    try {
      setCheckingRole(true);
      console.log('🔍 Checking Producer role for:', account);
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      
      // First check if participant exists
      let participant;
      try {
        participant = await participantRegistryService.getParticipant(provider, account);
        console.log('📋 Participant data:', {
          role: participant.role.toString(),
          status: participant.status.toString(),
          isActive: participant.isActive
        });
      } catch (err) {
        console.error('❌ Error getting participant:', err);
        setRoleError(`❌ This account is not registered. Please register as Producer first.`);
        setCheckingRole(false);
        return;
      }
      
      const hasProducerRole = await participantRegistryService.hasRole(provider, account, Role.PRODUCER);
      console.log('✅ hasRole(Producer):', hasProducerRole);
      
      if (!hasProducerRole) {
        // Check what role they actually have
        const { RoleName } = await import('../contracts/config');
        const currentRole = RoleName[Number(participant.role)] || 'Unknown';
        
        if (Number(participant.role) === Role.PRODUCER && Number(participant.status) !== 1) {
          setRoleError(`⚠️ Your account is registered as Producer but NOT VERIFIED yet. Please wait for admin verification.`);
        } else {
          setRoleError(`❌ You are registered as ${currentRole}, not Producer. Switch to Producer account (Account #1) to create products.`);
        }
      } else {
        setRoleError('');
        console.log('✅ Account is verified Producer');
      }
    } catch (err) {
      console.error('❌ Error checking role:', err);
      setRoleError(`❌ Error checking role: ${err.message}`);
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
    setError('');
    console.log('🔍 Loading products for Producer:', currentAccount);
    
    // CRITICAL: Only load products if user is verified Producer
    // This prevents products showing in wrong dashboards
    try {
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      console.log('🔍 Checking Producer role before loading products...');
      const hasProducerRole = await participantRegistryService.hasRole(provider, currentAccount, Role.PRODUCER);
      console.log('✅ hasProducerRole:', hasProducerRole);
      
      if (!hasProducerRole) {
        console.log('⚠️ Not a verified Producer - skipping product load');
        // Don't set error here, role check already shows error message
        setProducts([]);
        setLoading(false);
        return;
      }
    } catch (roleCheckErr) {
      console.error('❌ Error verifying Producer role:', roleCheckErr);
      console.warn('⚠️ Could not verify Producer role - skipping product load');
      setError(`Failed to verify Producer role: ${roleCheckErr.message}`);
      setProducts([]);
      setLoading(false);
      return;
    }
    
    try {
      const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
      console.log('🔍 Getting tokens owned by:', currentAccount);
      const tokenIds = await productNFTService.getTokensByOwner(provider, currentAccount);
      console.log('📦 Found token IDs:', tokenIds.map(id => id.toString()));
      console.log('📦 Total tokens found:', tokenIds.length);
      
      if (tokenIds.length === 0) {
        console.log('⚠️ No tokens found for this account');
        setProducts([]);
        setLoading(false);
        return;
      }
      
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
      // Create AbortController for timeout
      // Increase timeout based on number of products (30 seconds per product, min 60s, max 10 minutes)
      const timeoutDuration = Math.min(Math.max(productsToDownload.length * 30000, 60000), 600000);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      
      console.log(`⏳ Generating QR PDF for ${productsToDownload.length} products (timeout: ${timeoutDuration/1000}s)...`);
      
      try {
        const response = await fetch(getBackendApiUrl('/qr-sheet/generate'), {
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
          const maxProducts = Math.floor(timeoutDuration / 30000);
          throw new Error(`Request timed out after ${timeoutDuration/1000}s. Try selecting fewer products (max ${maxProducts} recommended).`);
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
    if (e) {
      e.stopPropagation(); // Prevent card click
    }
    
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

      // Step 1: Verify ownership before attempting deletion
      const ownershipResult = await verifyOwnership(provider, tokenId, account);
      if (!ownershipResult.isOwner) {
        throw new Error(`You are not the owner of product #${tokenId}. Current owner: ${ownershipResult.owner}`);
      }

      // Step 2: Get tokenURI (metadata hash) before burning
      let tokenURI = null;
      try {
        tokenURI = await productNFTService.getTokenURI(provider, tokenId);
        console.log('📎 Token URI to delete:', tokenURI);
      } catch (uriErr) {
        console.warn('⚠️ Could not get token URI:', uriErr.message);
        // Continue with deletion even if URI retrieval fails
      }

      // Step 3: Check if product exists in SupplyChain and get current owner from there
      let supplyChainOwner = null;
      try {
        const productData = await supplyChainService.getProduct(provider, tokenId);
        supplyChainOwner = productData.currentOwner?.toLowerCase();
        console.log('📋 Product exists in SupplyChain. Current owner:', supplyChainOwner);
        console.log('📋 Your address:', account?.toLowerCase());
        
        // If SupplyChain says owner is different, that's the issue
        if (supplyChainOwner && supplyChainOwner !== account?.toLowerCase()) {
          throw new Error(`Product ownership mismatch. SupplyChain owner: ${supplyChainOwner}, Your address: ${account}. The product may have been transferred through SupplyChain.`);
        }
      } catch (supplyChainErr) {
        if (supplyChainErr.message?.includes('ownership mismatch')) {
          throw supplyChainErr;
        }
        // Product doesn't exist in SupplyChain - that's OK, we can still burn the NFT
        console.log('ℹ️ Product not in SupplyChain, proceeding with direct NFT burn');
      }

      // Step 4: Burn NFT (transfer to burn address)
      const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
      console.log('🔥 Burning NFT to:', BURN_ADDRESS);
      
      try {
        // Use direct transferFrom - ProductNFT allows direct transfers
        const { getProductNFTContract } = await import('../utils/contractHelpers');
        const contract = await getProductNFTContract(signer);
        const fromAddress = await signer.getAddress();
        
        console.log('📋 Transferring from:', fromAddress);
        console.log('📋 Transferring to:', BURN_ADDRESS);
        console.log('📋 Token ID:', tokenId);
        
        const tx = await contract.transferFrom(fromAddress, BURN_ADDRESS, tokenId);
        console.log('✅ Burn transaction sent:', tx.hash);
        
        // Wait for confirmation
        await tx.wait();
        console.log('✅ NFT burned successfully. Transaction confirmed:', tx.hash);
      } catch (transferErr) {
        console.error('❌ Failed to burn NFT:', transferErr);
        console.error('   Error code:', transferErr.code);
        console.error('   Error message:', transferErr.message);
        console.error('   Error data:', transferErr.data);
        console.error('   Full error:', transferErr);
        
        // Decode the revert reason if available
        let errorMessage = transferErr.message || 'Unknown error';
        if (transferErr.reason) {
          errorMessage = transferErr.reason;
        } else if (transferErr.data && typeof transferErr.data === 'string') {
          // Try to decode error
          try {
            const { getProductNFTContract } = await import('../utils/contractHelpers');
            const contract = await getProductNFTContract(provider);
            const decoded = contract.interface.parseError(transferErr.data);
            if (decoded) {
              errorMessage = decoded.name || decoded.args?.[0] || errorMessage;
            }
          } catch (decodeErr) {
            // Use original message
          }
        }
        
        // Provide specific error messages
        if (errorMessage.includes('ERC721: transfer caller is not owner') || 
            errorMessage.includes('transfer caller is not owner') ||
            errorMessage.includes('caller is not token owner')) {
          throw new Error('You are not the owner of this product. Cannot delete.');
        } else if (errorMessage.includes('ERC721: invalid token ID') || 
                   errorMessage.includes('invalid token ID')) {
          throw new Error('Product does not exist or has already been burned.');
        } else if (errorMessage.includes('user rejected') || 
                   errorMessage.includes('User denied')) {
          throw new Error('Transaction was cancelled. Product not deleted.');
        } else if (errorMessage.includes('execution reverted')) {
          throw new Error(`Transaction reverted: ${errorMessage}. Check console for details.`);
        } else {
          throw new Error(`Failed to burn NFT: ${errorMessage}`);
        }
      }

      // Step 5: Delete metadata from IPFS (non-blocking - don't fail if this fails)
      if (tokenURI && tokenURI !== '') {
        console.log('🗑️ Deleting metadata from IPFS...');
        try {
          const deleteResult = await deleteFromIPFS(tokenURI);
          if (deleteResult.success) {
            console.log('✅ Metadata deleted successfully');
          } else {
            console.warn('⚠️ Failed to delete metadata from IPFS:', deleteResult.error);
            // Don't throw error - NFT is already burned, metadata deletion is secondary
          }
        } catch (ipfsErr) {
          console.warn('⚠️ Error deleting metadata from IPFS:', ipfsErr.message);
          // Continue - NFT is already burned
        }
      } else {
        console.log('ℹ️ No token URI found, skipping IPFS deletion');
      }

      setSuccess(`Product #${tokenId} burned successfully!${tokenURI ? ' Metadata deleted from IPFS.' : ''}`);
      
      // Trigger webhook for product.burned event
      try {
        // Get product name before it's deleted
        let productName = `Product #${tokenId}`;
        try {
          const product = products.find(p => p.tokenId === tokenId);
          if (product?.metadata?.name) {
            productName = product.metadata.name;
          }
        } catch (err) {
          // Use default name if can't get product name
        }

        const webhookData = {
          tokenId: tokenId.toString(),
          burnedBy: account,
          productName: productName,
          tokenURI: tokenURI || null
        };

        const webhookResponse = await fetch(getBackendApiUrl('/webhooks/trigger'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            event: 'product.burned',
            data: webhookData,
            walletAddress: account
          })
        });

        if (webhookResponse.ok) {
          const webhookResult = await webhookResponse.json();
          console.log('✅ Burn webhook triggered:', webhookResult);
        } else {
          console.warn('⚠️ Burn webhook trigger failed (non-critical)');
        }
      } catch (webhookErr) {
        console.warn('⚠️ Burn webhook trigger error (non-critical):', webhookErr);
      }
      
      // Reload products (burned products will be filtered out)
      await loadProducts();
    } catch (err) {
      console.error('❌ Delete error:', err);
      const errorMessage = err.message || 'Failed to delete product';
      setError(errorMessage);
      
      // Show error for a longer time
      setTimeout(() => {
        if (error === errorMessage) {
          setError('');
        }
      }, 5000);
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

      // Register blockchain ID if module is available
      if (hasProductIdentifier) {
        try {
          await productIdentifierService.registerProductId(
            signer,
            result.tokenId,
            formData.model || formData.name || 'UNKNOWN',
            formData.serialNumber || `SN-${result.tokenId}`
          );
          console.log('✅ Blockchain ID registered for product', result.tokenId);
        } catch (err) {
          console.warn('⚠️ Failed to register blockchain ID:', err.message);
          // Don't fail product creation if blockchain ID registration fails
        }
      }

      setSuccess(`Product created successfully! Token ID: ${result.tokenId}`);
      setShowCreateForm(false);
      
      // Trigger webhook for product creation
      try {
        const webhookData = {
          tokenId: result.tokenId.toString(),
          productName: formData.name,
          description: formData.description,
          productType: formData.productType,
          category: formData.category,
          serialNumber: formData.serialNumber,
          model: formData.model,
          warrantyPeriod: formData.warrantyPeriod,
          producer: account,
          tokenURI: metadataResult.ipfsUrl,
          metadata: {
            name: formData.name,
            description: formData.description,
            category: formData.category,
            model: formData.model,
            manufacturer: formData.manufacturer
          }
        };

        const webhookResponse = await fetch(getBackendApiUrl('/webhooks/trigger'), {
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

        if (webhookResponse.ok) {
          const webhookResult = await webhookResponse.json();
          console.log('✅ Webhook triggered:', webhookResult);
        } else {
          console.warn('⚠️ Webhook trigger failed (non-critical)');
        }
      } catch (webhookErr) {
        // Don't fail product creation if webhook fails
        console.warn('⚠️ Webhook trigger error (non-critical):', webhookErr);
      }
      
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

  const handleLinkGtin = async (tokenId) => {
    const gtin = gtinInputs[tokenId]?.trim();
    if (!gtin || gtin === '') {
      setError('Please enter a GTIN');
      return;
    }
    
    // Validate GTIN format (8-14 digits)
    const gtinRegex = /^\d{8,14}$/;
    if (!gtinRegex.test(gtin)) {
      setError('GTIN must be 8-14 digits');
      return;
    }
    
    setLinkingGtin(tokenId);
    setError('');
    
    try {
      await gtinLinkerService.linkGtin(signer, tokenId, gtin);
      setSuccess(`GTIN ${gtin} linked to product #${tokenId}`);
      
      // Update local state
      setProductGtins(prev => ({ ...prev, [tokenId]: gtin }));
      setGtinInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[tokenId];
        return newInputs;
      });
      
      // Reload identifiers
      await loadProductIdentifiers();
    } catch (err) {
      console.error('GTIN linking error:', err);
      if (err.message?.includes('GTIN already linked')) {
        setError('This GTIN is already linked to another product');
      } else if (err.message?.includes('Product already has GTIN')) {
        setError('This product already has a GTIN linked');
      } else if (err.message?.includes('Only producer')) {
        setError('Only the product producer can link GTIN');
      } else {
        setError(err.message || 'Failed to link GTIN');
      }
    } finally {
      setLinkingGtin(null);
    }
  };

  const handleBatchCreate = async (e) => {
    e.preventDefault();
    if (!signer) {
      setError('Wallet not connected');
      return;
    }
    
    const count = parseInt(e.target.count?.value || 50);
    if (count < 1 || count > 1000) {
      setError('Please enter a number between 1 and 1000');
      return;
    }

    setBatchCreating(true);
    setError('');
    setSuccess('');
    setBatchProgress({});
    
    // Use current form data as template
    const template = {
      ...formData,
      name: formData.name || 'Batch Product',
      description: formData.description || 'Product created via batch creation',
      serialNumber: formData.serialNumber || 'BATCH',
      category: formData.category || 'Batch',
      productType: formData.productType || 'physical',
      warrantyPeriod: formData.warrantyPeriod || 365,
      manufacturer: formData.manufacturer || { name: '', address: '', country: '', website: '' },
      specifications: formData.specifications || {},
      images: formData.images || []
    };

    try {
      console.log(`🚀 Starting batch creation of ${count} products...`);
      
      const results = await createProductsFromTemplate(
        signer,
        template,
        count,
        (index, total, status, result) => {
          setBatchProgress(prev => ({
            ...prev,
            [index]: { status, result, progress: ((index + 1) / total * 100).toFixed(1) }
          }));
        }
      );

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`✅ Batch creation complete: ${successful} successful, ${failed} failed`);
      
      setSuccess(`Batch creation complete! ${successful} products created successfully${failed > 0 ? `, ${failed} failed` : ''}`);
      setShowBatchCreate(false);
      
      // Reload products after a delay (to allow transactions to confirm)
      setTimeout(() => {
        loadProducts();
      }, 5000);
    } catch (err) {
      console.error('Batch creation error:', err);
      setError(err.message || 'Failed to create products in batch');
    } finally {
      setBatchCreating(false);
      setTimeout(() => {
        setBatchProgress({});
      }, 10000);
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
            disabled={!!roleError || loading || batchCreating}
          >
            {showCreateForm ? 'Cancel' : '+ Create Product'}
          </button>
          <button 
            className="btn"
            onClick={() => setShowWebhookManager(!showWebhookManager)}
            disabled={!!roleError || !isConnected}
            style={{ backgroundColor: '#9C27B0', color: 'white' }}
            title="Manage webhooks for ERP integration"
          >
            {showWebhookManager ? 'Close Webhooks' : '🔗 Webhooks'}
          </button>
          <button 
            className="btn"
            onClick={() => setShowBatchCreate(!showBatchCreate)}
            disabled={!!roleError || loading || batchCreating}
            style={{ backgroundColor: '#4CAF50', color: 'white' }}
            title="Create multiple products quickly (50+ per minute)"
          >
            {showBatchCreate ? 'Cancel' : '⚡ Batch Create'}
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

      {showBatchCreate && (
        <div className="form-section card" style={{ backgroundColor: '#f0f8ff', border: '2px solid #4CAF50' }}>
          <h2>⚡ Batch Product Creation</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Create multiple products quickly using the current form as a template. 
            Products will be created with sequential serial numbers.
          </p>
          <form onSubmit={handleBatchCreate}>
            <div className="form-row">
              <div className="input-group">
                <label>Number of Products *</label>
                <input
                  name="count"
                  type="number"
                  min="1"
                  max="1000"
                  defaultValue="50"
                  required
                  placeholder="e.g., 50"
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                  Recommended: 50-100 products per batch for optimal performance
                </small>
              </div>
            </div>

            {Object.keys(batchProgress).length > 0 && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                backgroundColor: '#e8f5e9', 
                borderRadius: '4px',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <strong>Progress:</strong>
                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                  {Object.entries(batchProgress).slice(-10).map(([index, progress]) => (
                    <div key={index} style={{ marginBottom: '0.25rem' }}>
                      Product {parseInt(index) + 1}: {progress.status} 
                      {progress.result?.txHash && (
                        <span style={{ color: '#4CAF50', marginLeft: '0.5rem' }}>
                          ✓ {progress.result.txHash.substring(0, 10)}...
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={batchCreating || !signer}
                style={{ flex: 1 }}
              >
                {batchCreating ? (
                  <>
                    <span className="loading"></span> Creating Products...
                  </>
                ) : (
                  '⚡ Start Batch Creation'
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowBatchCreate(false);
                  setBatchProgress({});
                }}
                disabled={batchCreating}
              >
                Cancel
              </button>
            </div>
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
                  
                  {/* Blockchain ID */}
                  {hasProductIdentifier && productBlockchainIds[product.tokenId] && (
                    <p style={{ fontSize: '0.85rem', color: '#4CAF50', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                      🆔 Blockchain ID: {productBlockchainIds[product.tokenId].substring(0, 50)}...
                    </p>
                  )}
                  
                  {/* GTIN */}
                  {hasGtinLinker && productGtins[product.tokenId] && (
                    <p style={{ fontSize: '0.85rem', color: '#2196F3', marginTop: '0.25rem' }}>
                      🏷️ GTIN: {productGtins[product.tokenId]}
                    </p>
                  )}
                  
                  <p>Type: {product.productType || 'N/A'}</p>
                  <div className="product-meta">
                    <span className="badge badge-primary">Producer</span>
                    <span>Warranty: {product.metadata?.warrantyPeriod || product.warrantyPeriod || 0} days</span>
                  </div>
                </div>
                
                {/* GTIN Linking UI (only for producer, only if module available, only if no GTIN yet) */}
                {hasGtinLinker && 
                 product.producer?.toLowerCase() === account?.toLowerCase() && 
                 !productGtins[product.tokenId] && (
                  <div style={{ 
                    marginTop: '0.75rem', 
                    padding: '0.75rem', 
                    backgroundColor: '#f0f8ff', 
                    borderRadius: '4px',
                    border: '1px solid #2196F3'
                  }}>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#666' }}>
                      Link GS1/GTIN (optional)
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Enter GTIN (8-14 digits)"
                        value={gtinInputs[product.tokenId] || ''}
                        onChange={(e) => setGtinInputs(prev => ({
                          ...prev,
                          [product.tokenId]: e.target.value
                        }))}
                        maxLength={14}
                        pattern="[0-9]{8,14}"
                        style={{ 
                          flex: 1,
                          padding: '0.5rem', 
                          fontSize: '0.9rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                      <button
                        onClick={() => handleLinkGtin(product.tokenId)}
                        disabled={linkingGtin === product.tokenId || !gtinInputs[product.tokenId]}
                        className="btn btn-small"
                        style={{ 
                          backgroundColor: '#2196F3', 
                          color: 'white',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem'
                        }}
                      >
                        {linkingGtin === product.tokenId ? 'Linking...' : '🔗 Link'}
                      </button>
                    </div>
                  </div>
                )}
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

      {/* Webhook Manager */}
      {showWebhookManager && (
        <div style={{ 
          marginTop: '2rem', 
          width: '100%', 
          padding: '1rem',
          backgroundColor: '#f9f9f9',
          border: '2px solid #2196F3',
          borderRadius: '8px'
        }}>
          <WebhookManager
            account={account}
            onClose={() => {
              setShowWebhookManager(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ProducerDashboard;

