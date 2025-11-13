# 🔗 Module Connection Guide

## How to Connect ProductIdentifier & GtinLinker Modules

### **Quick Connection Steps:**

1. **Compile Contracts**
   ```bash
   npx hardhat compile
   ```

2. **Deploy Modules**
   ```bash
   npx hardhat run scripts/deploy-modules.js --network sepolia
   # Or for localhost:
   npx hardhat run scripts/deploy-modules.js --network localhost
   ```

3. **Restart Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

---

## 📋 **Detailed Connection Process**

### **Step 1: Compile Contracts**

```bash
npx hardhat compile
```

This compiles:
- `ProductIdentifier.sol`
- `GtinLinker.sol`
- `SupplyChain.sol` (updated)

**Expected output:**
```
Compiled 3 Solidity files successfully
```

---

### **Step 2: Deploy Modules**

The deployment script will:
1. ✅ Load existing SupplyChain address
2. ✅ Deploy ProductIdentifier (passes SupplyChain address)
3. ✅ Deploy GtinLinker (passes SupplyChain address)
4. ✅ Connect modules to SupplyChain
5. ✅ Update config.js with addresses
6. ✅ Copy ABIs to frontend

**Command:**
```bash
# For Sepolia
npx hardhat run scripts/deploy-modules.js --network sepolia

# For localhost (make sure Hardhat node is running)
npx hardhat node
# In another terminal:
npx hardhat run scripts/deploy-modules.js --network localhost
```

**Expected output:**
```
🚀 Starting module deployment...
Deploying with account: 0x...
Account balance: 0.5 ETH

📋 Found existing deployment
   SupplyChain: 0xfef50a2a46C7E89B108F9d5986B5BC72767B8c6B

📦 Deploying modules...

1. Deploying ProductIdentifier...
   ✅ ProductIdentifier deployed to: 0x...

2. Deploying GtinLinker...
   ✅ GtinLinker deployed to: 0x...

3. Connecting modules to SupplyChain...
   ✅ ProductIdentifier connected to SupplyChain
   ✅ GtinLinker connected to SupplyChain

4. Deployment info updated
5. Copying module ABIs to frontend...
   ✅ ProductIdentifier ABI copied
   ✅ GtinLinker ABI copied

6. Updating config.js...
   ✅ config.js updated with module addresses

✅ Module deployment completed!
```

---

### **Step 3: Verify Connection**

**Check config.js:**
```javascript
// frontend/src/contracts/config.js
const SEPOLIA_ADDRESSES = {
  // ... existing contracts ...
  ProductIdentifier: '0x...', // Should have real address
  GtinLinker: '0x...'          // Should have real address
};
```

**Check frontend console:**
- Open browser console
- Look for: `📦 Module availability: { ProductIdentifier: true, GtinLinker: true }`

---

## 🔧 **Manual Connection (If Script Fails)**

### **Option 1: Use Setter Functions**

If SupplyChain has `setProductIdentifier()` and `setGtinLinker()`:

```javascript
// In Hardhat console or script
const SupplyChain = await ethers.getContractFactory("SupplyChain");
const supplyChain = SupplyChain.attach("0x...SupplyChainAddress");

await supplyChain.setProductIdentifier("0x...ProductIdentifierAddress");
await supplyChain.setGtinLinker("0x...GtinLinkerAddress");
```

### **Option 2: Redeploy SupplyChain**

If setter functions don't work, redeploy SupplyChain with module addresses:

```javascript
const SupplyChain = await ethers.getContractFactory("SupplyChain");
const supplyChain = await SupplyChain.deploy(
  participantRegistryAddress,
  productNFTAddress,
  productIdentifierAddress,  // Module address
  gtinLinkerAddress          // Module address
);
```

---

## ✅ **Verification**

### **Test Blockchain ID:**
1. Create a product
2. Check console: Should see "✅ Blockchain ID registered"
3. Check product card: Should show blockchain ID

### **Test GTIN Linking:**
1. Open product card
2. See "Link GS1/GTIN" section
3. Enter GTIN (8-14 digits)
4. Click "Link"
5. Product card should show GTIN

---

## 🐛 **Troubleshooting**

### **Error: "Module not deployed"**
- Check `config.js` has module addresses (not `0x0...`)
- Restart frontend after updating config

### **Error: "ABI not found"**
- Run `npx hardhat compile`
- Check `frontend/src/contracts/ProductIdentifier.js` exists
- Check `frontend/src/contracts/GtinLinker.js` exists

### **Error: "Only producer can link GTIN"**
- Make sure you're logged in as the product producer
- Check product.producer matches your account

### **Modules not showing in UI**
- Check browser console for module availability
- Verify addresses in `config.js`
- Clear browser cache and reload

---

## 📝 **Connection Architecture**

```
SupplyChain Contract
  ├── productIdentifier (address) → ProductIdentifier Contract
  └── gtinLinker (address) → GtinLinker Contract

ProductIdentifier Contract
  └── supplyChainContract (address) → SupplyChain Contract

GtinLinker Contract
  └── supplyChainContract (address) → SupplyChain Contract
```

**Both modules are independent:**
- ✅ Can use one without the other
- ✅ Can remove one without breaking the other
- ✅ Both connect to SupplyChain separately

---

## 🚀 **Quick Start Commands**

```bash
# 1. Compile
npx hardhat compile

# 2. Deploy modules
npx hardhat run scripts/deploy-modules.js --network sepolia

# 3. Restart frontend
cd frontend && npm run dev
```

**That's it!** Modules are now connected and ready to use.

