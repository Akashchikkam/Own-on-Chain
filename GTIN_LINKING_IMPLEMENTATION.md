# 🔗 GTIN Linking System (Separate Process)

## 🎯 Goal: Link GTIN to Existing NFTs

### **Problem:**
- Manufacturers create NFTs first
- Assign GTINs later (separate process)
- Need to link them without recreating NFT

### **Solution: Link GTIN to Existing Product**

---

## ✅ **IMPLEMENTATION**

### **1. Smart Contract: Add GTIN Linking**

```solidity
// In SupplyChain.sol

// GTIN mappings
mapping(string => uint256) public gtinToTokenId;  // GTIN → Token ID
mapping(uint256 => string) public tokenIdToGtin;   // Token ID → GTIN

// Event
event GtinLinked(uint256 indexed tokenId, string indexed gtin);

/**
 * @dev Link GTIN to existing product (separate process)
 * @param _tokenId Token ID of existing product
 * @param _gtin GS1/GTIN identifier
 */
function linkGtinToProduct(uint256 _tokenId, string memory _gtin) external {
    // Only producer can link GTIN
    require(products[_tokenId].producer == msg.sender, "Only producer can link GTIN");
    
    // Validate product exists
    require(products[_tokenId].tokenId != 0, "Product does not exist");
    
    // Validate GTIN format (8, 12, 13, or 14 digits)
    bytes memory gtinBytes = bytes(_gtin);
    require(gtinBytes.length >= 8 && gtinBytes.length <= 14, "Invalid GTIN length");
    
    // Check GTIN is numeric
    for (uint i = 0; i < gtinBytes.length; i++) {
        require(gtinBytes[i] >= 0x30 && gtinBytes[i] <= 0x39, "GTIN must be numeric");
    }
    
    // Check GTIN not already linked to another product
    require(gtinToTokenId[_gtin] == 0, "GTIN already linked to another product");
    
    // Check product doesn't already have GTIN
    require(bytes(tokenIdToGtin[_tokenId]).length == 0, "Product already has GTIN");
    
    // Link GTIN to Token ID
    gtinToTokenId[_gtin] = _tokenId;
    tokenIdToGtin[_tokenId] = _gtin;
    
    emit GtinLinked(_tokenId, _gtin);
}

/**
 * @dev Get Token ID by GTIN
 * @param _gtin GS1/GTIN identifier
 * @return tokenId Token ID linked to GTIN
 */
function getTokenIdByGtin(string memory _gtin) external view returns (uint256) {
    uint256 tokenId = gtinToTokenId[_gtin];
    require(tokenId != 0, "GTIN not linked");
    return tokenId;
}

/**
 * @dev Get GTIN by Token ID
 * @param _tokenId Token ID
 * @return gtin GTIN linked to Token ID
 */
function getGtinByTokenId(uint256 _tokenId) external view returns (string memory) {
    return tokenIdToGtin[_tokenId];
}
```

---

## 🎨 **FRONTEND IMPLEMENTATION**

### **1. Add "Link GTIN" Button to Product Card**

```jsx
// In ProducerDashboard.jsx

const [linkingGtin, setLinkingGtin] = useState(null);
const [gtinInput, setGtinInput] = useState('');

const handleLinkGtin = async (tokenId) => {
  if (!gtinInput || gtinInput.trim() === '') {
    setError('Please enter a GTIN');
    return;
  }
  
  // Validate GTIN format (8-14 digits)
  const gtinRegex = /^\d{8,14}$/;
  if (!gtinRegex.test(gtinInput)) {
    setError('GTIN must be 8-14 digits');
    return;
  }
  
  setLinkingGtin(tokenId);
  setError('');
  
  try {
    const contract = await getSupplyChainContract(signer);
    const tx = await contract.linkGtinToProduct(tokenId, gtinInput.trim());
    await tx.wait();
    
    setSuccess(`GTIN ${gtinInput} linked to product #${tokenId}`);
    setGtinInput('');
    await loadProducts();
  } catch (err) {
    console.error('GTIN linking error:', err);
    if (err.message?.includes('GTIN already linked')) {
      setError('This GTIN is already linked to another product');
    } else if (err.message?.includes('Product already has GTIN')) {
      setError('This product already has a GTIN linked');
    } else {
      setError(err.message || 'Failed to link GTIN');
    }
  } finally {
    setLinkingGtin(null);
  }
};
```

### **2. UI Component**

```jsx
{/* In product card */}
{products[_tokenId].producer === account && !tokenIdToGtin[_tokenId] && (
  <div style={{ marginTop: '0.5rem' }}>
    <input
      type="text"
      placeholder="Enter GTIN (8-14 digits)"
      value={gtinInput}
      onChange={(e) => setGtinInput(e.target.value)}
      maxLength={14}
      pattern="[0-9]{8,14}"
      style={{ 
        padding: '0.5rem', 
        marginRight: '0.5rem',
        width: '150px'
      }}
    />
    <button
      onClick={() => handleLinkGtin(product.tokenId)}
      disabled={linkingGtin === product.tokenId}
      className="btn btn-small"
    >
      {linkingGtin === product.tokenId ? 'Linking...' : '🔗 Link GTIN'}
    </button>
  </div>
)}

{tokenIdToGtin[_tokenId] && (
  <div style={{ marginTop: '0.5rem', color: '#4CAF50' }}>
    ✓ GTIN: {tokenIdToGtin[_tokenId]}
  </div>
)}
```

---

## 🔍 **LOOKUP BY GTIN**

### **Update Verification Page**

```jsx
// In PublicVerify.jsx

// Support lookup by GTIN
const lookupByGtin = async (gtin) => {
  try {
    const contract = await getSupplyChainContract(provider);
    const tokenId = await contract.getTokenIdByGtin(gtin);
    
    // Now lookup by tokenId
    return await lookupByTokenId(tokenId);
  } catch (err) {
    throw new Error('GTIN not found or not linked');
  }
};

// URL: /verify?gtin=1234567890123
// URL: /verify?tokenId=42
// Both work!
```

---

## 📋 **WORKFLOW**

### **Step 1: Create NFT (No GTIN Required)**
```
Producer creates product
  ↓
NFT minted → Token ID: 42
  ↓
Product created ✅
```

### **Step 2: Link GTIN Later (Separate Process)**
```
Producer gets GTIN from GS1
  ↓
Clicks "Link GTIN" on product
  ↓
Enters GTIN: 1234567890123
  ↓
Transaction: linkGtinToProduct(42, "1234567890123")
  ↓
GTIN linked ✅
```

### **Step 3: Both Identifiers Work**
```
Lookup by Token ID: /verify/42 ✅
Lookup by GTIN: /verify?gtin=1234567890123 ✅
Both show same product!
```

---

## ✅ **BENEFITS**

1. **Separate Process**: Create NFT first, link GTIN later
2. **Flexible**: GTIN optional, not required
3. **No Recreation**: Link to existing NFT
4. **Dual Lookup**: Both GTIN and Token ID work
5. **Producer Control**: Only producer can link GTIN

---

## 🚀 **NEXT STEPS**

1. Add `linkGtinToProduct()` to contract
2. Add GTIN linking UI to frontend
3. Update verification to support GTIN lookup
4. Update QR codes to include GTIN (if linked)

