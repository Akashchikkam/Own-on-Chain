import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { supplyChainService, productNFTService } from '../utils/contractHelpers';
import { uploadProductMetadata, uploadFileToIPFS, retrieveFromIPFS, ipfsToGatewayUrl, deleteFromIPFS } from '../utils/ipfs';
import { downloadProductQR } from '../utils/qr-generator';
import { useNavigate } from 'react-router-dom';
import Scanner from '../components/Scanner';
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
          const product = await supplyChainService.getProduct(provider, tokenId);
          
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
            ...product,
            metadata
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
    const recipientAddress = prompt('Enter recipient wallet address:');
    if (!recipientAddress) return;

    // Validate address format
    if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid address format. Please enter a valid Ethereum address.');
      return;
    }

    // Show info about MetaMask transaction BEFORE sending
    // MetaMask will show SupplyChain contract address, not recipient address
    const { CONTRACT_ADDRESSES } = await import('../contracts/config');
    const addresses = await CONTRACT_ADDRESSES;
    const supplyChainAddress = addresses.SupplyChain;
    
    const proceed = window.confirm(
      `⚠️ IMPORTANT: MetaMask will show the SupplyChain contract address (${supplyChainAddress.substring(0, 10)}...), NOT the recipient address.\n\n` +
      `This is NORMAL! The transaction goes TO the contract, which then transfers TO your recipient:\n` +
      `${recipientAddress.substring(0, 10)}...${recipientAddress.substring(recipientAddress.length - 8)}\n\n` +
      `Click OK to continue with the transfer.`
    );
    
    if (!proceed) return;

    try {
      setTransferLoading(tokenId);
      setError('');
      setSuccess('');

      // Validate recipient is registered and verified (maintains supply chain integrity)
      // But allow flexible transfers - anyone can send to anyone (decentralized Web3 freedom)
      const { participantRegistryService } = await import('../utils/contractHelpers');
      const { Role } = await import('../contracts/config');
      
      let recipientParticipant;
      try {
        recipientParticipant = await participantRegistryService.getParticipant(provider, recipientAddress);
      } catch (err) {
        throw new Error('Recipient is not registered. Only registered and verified participants can receive products.');
      }

      const recipientRole = Number(recipientParticipant.role);
      const recipientStatus = Number(recipientParticipant.status);

      // Require verification
      if (recipientStatus !== 1) {
        throw new Error('Recipient is not verified. Only verified participants can receive products. Please wait for admin verification.');
      }

      // Log transfer details for debugging
      console.log('📋 Transfer Details:');
      console.log('  Transaction TO: SupplyChain Contract:', supplyChainAddress);
      console.log('  Will transfer TO: Recipient:', recipientAddress);
      console.log('  ⚠️ MetaMask shows contract address (this is normal for smart contract calls)');

      // Use appropriate SupplyChain method based on recipient role
      // All transfers are tracked on-chain (decentralized blockchain, not centralized)
      try {
        if (recipientRole === Role.DISTRIBUTOR) {
          await supplyChainService.transferToDistributor(signer, tokenId, recipientAddress);
          setSuccess(`Product #${tokenId} transferred to Distributor (${recipientAddress.substring(0, 10)}...) successfully! The transaction shows SupplyChain contract address in MetaMask - this is normal.`);
        } else if (recipientRole === Role.RETAILER) {
          await supplyChainService.transferToRetailer(signer, tokenId, recipientAddress);
          setSuccess(`Product #${tokenId} transferred to Retailer (${recipientAddress.substring(0, 10)}...) successfully! The transaction shows SupplyChain contract address in MetaMask - this is normal.`);
        } else if (recipientRole === Role.BUYER) {
          // sellToBuyer accepts any verified participant, so flexible
          const saleDetails = prompt('Enter sale details (IPFS hash or description):') || '';
          await supplyChainService.sellToBuyer(signer, tokenId, recipientAddress, saleDetails);
          setSuccess(`Product #${tokenId} transferred successfully! The transaction shows SupplyChain contract address in MetaMask - this is normal.`);
        } else if (recipientRole === Role.PRODUCER) {
          // Allow transfer back to Producer if needed (flexible flow)
          // Use sellToBuyer which accepts any verified participant
          const saleDetails = prompt('Enter transfer details (IPFS hash or description):') || '';
          await supplyChainService.sellToBuyer(signer, tokenId, recipientAddress, saleDetails);
          setSuccess(`Product #${tokenId} transferred successfully! The transaction shows SupplyChain contract address in MetaMask - this is normal.`);
        } else {
          // Unknown role but verified - use sellToBuyer which accepts any verified participant
          const saleDetails = prompt('Enter transfer details (IPFS hash or description):') || '';
          await supplyChainService.sellToBuyer(signer, tokenId, recipientAddress, saleDetails);
          setSuccess(`Product #${tokenId} transferred successfully! The transaction shows SupplyChain contract address in MetaMask - this is normal.`);
        }
      } catch (supplyChainErr) {
        // If SupplyChain method fails due to status constraints, 
        // still track on blockchain via direct NFT transfer (maintains decentralized tracking)
        console.warn('SupplyChain method failed, using direct NFT transfer (still tracked on blockchain):', supplyChainErr);
        await productNFTService.transferTo(signer, tokenId, recipientAddress);
        setSuccess(`Product #${tokenId} transferred successfully! (Tracked on blockchain)`);
      }

      await loadProducts();
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err.message || 'Failed to transfer product');
    } finally {
      setTransferLoading(null);
    }
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

  const handleScanProduct = () => {
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
        // TODO: Query backend to get token ID from product ID
        setError('Product ID lookup not yet implemented. Please scan QR code with token ID.');
        return;
      } else if (result.url) {
        // Parse URL to get token ID
        const urlPath = result.url.pathname;
        if (urlPath.includes('/verify/')) {
          tokenId = urlPath.split('/verify/')[1];
        }
      } else if (result.raw) {
        // Try to parse raw text as URL
        try {
          const url = new URL(result.raw);
          if (url.pathname.includes('/verify/')) {
            tokenId = url.pathname.split('/verify/')[1];
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
      
      setSuccess(`Product #${tokenId} scanned successfully!`);
      
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

  const handleTransferScanned = async () => {
    if (!scannedProduct) return;
    
    const recipientAddress = prompt('Enter recipient wallet address:');
    if (!recipientAddress) return;
    
    // Validate address
    if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Invalid address format.');
      return;
    }
    
    try {
      setTransferLoading(scannedProduct.tokenId);
      
      await supplyChainService.transfer(
        signer,
        scannedProduct.tokenId,
        recipientAddress
      );
      
      setSuccess(`Product #${scannedProduct.tokenId} transferred successfully!`);
      setScannedProduct(null);
      await loadProducts();
      
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err.message || 'Failed to transfer product');
    } finally {
      setTransferLoading(null);
    }
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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={!!roleError}
          >
            {showCreateForm ? 'Cancel' : '+ Create Product'}
          </button>
          <button 
            className="btn"
            onClick={handleScanProduct}
            disabled={!!roleError}
            style={{ backgroundColor: '#4CAF50', color: 'white' }}
          >
            📸 Scan Product
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
        <h2>My Products ({products.length})</h2>
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
              >
                <div onClick={() => navigate(`/product/${product.tokenId}`)} style={{ cursor: 'pointer' }}>
                  {/* Square 1:1 Image */}
                  <div className="product-card-image-container">
                    {product.metadata?.images && product.metadata.images.length > 0 && product.metadata.images[0].url ? (
                      <img
                        src={product.metadata.images[0].url}
                        alt={product.metadata?.name || `Product #${product.tokenId}`}
                        className="product-card-image"
                        onError={(e) => {
                          console.warn(`Failed to load image for product ${product.tokenId}:`, product.metadata.images[0].url);
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
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
                  <button
                    className="btn"
                    onClick={(e) => handleDelete(product.tokenId, e)}
                    disabled={deleteLoading === product.tokenId || transferLoading === product.tokenId}
                    style={{ 
                      flex: '1 1 100%',
                      backgroundColor: '#ff4444',
                      color: 'white'
                    }}
                  >
                    {deleteLoading === product.tokenId ? (
                      <>
                        <span className="loading"></span> Deleting...
                      </>
                    ) : (
                      '🗑️ Delete'
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

      {/* Scanned Product Modal */}
      {scannedProduct && (
        <div className="scanner-modal">
          <div className="scanner-container" style={{ maxWidth: '500px' }}>
            <div className="scanner-header">
              <h3>📦 Scanned Product</h3>
              <button 
                className="btn-close" 
                onClick={() => setScannedProduct(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              {scannedProduct.metadata?.images && scannedProduct.metadata.images[0]?.url && (
                <img 
                  src={scannedProduct.metadata.images[0].url} 
                  alt={scannedProduct.metadata.name || 'Product'}
                  style={{ 
                    width: '100%', 
                    height: '200px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}
                />
              )}
              
              <h4 style={{ margin: '0 0 0.5rem 0' }}>
                {scannedProduct.metadata?.name || `Product #${scannedProduct.tokenId}`}
              </h4>
              
              {scannedProduct.metadata?.description && (
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {scannedProduct.metadata.description}
                </p>
              )}
              
              <div style={{ 
                padding: '1rem', 
                background: '#f8f9fa', 
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                  <strong>Token ID:</strong> {scannedProduct.tokenId}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                  <strong>Owner:</strong> {scannedProduct.owner.substring(0, 6)}...{scannedProduct.owner.substring(scannedProduct.owner.length - 4)}
                </p>
                {scannedProduct.metadata?.serialNumber && (
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Serial:</strong> {scannedProduct.metadata.serialNumber}
                  </p>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={handleTransferScanned}
                  disabled={transferLoading === scannedProduct.tokenId}
                  style={{ flex: 1 }}
                >
                  {transferLoading === scannedProduct.tokenId ? (
                    <>
                      <span className="loading"></span> Transferring...
                    </>
                  ) : (
                    '🔄 Transfer Product'
                  )}
                </button>
                <button 
                  className="btn"
                  onClick={() => navigate(`/product/${scannedProduct.tokenId}`)}
                  style={{ flex: 1 }}
                >
                  📋 View Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProducerDashboard;

