# End-to-End Testing Guide

This document provides comprehensive testing instructions for all user flows in the Own-on-Chain system.

## Prerequisites

1. **Install Dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   ```

2. **Setup Environment**
   - Copy `.env.example` to `.env` and fill in your credentials
   - Get Mumbai testnet MATIC from [Polygon Faucet](https://faucet.polygon.technology/)
   - Set up Pinata account for IPFS: https://app.pinata.cloud/

3. **Compile and Deploy Contracts**
   ```bash
   # Compile contracts
   npm run compile
   
   # Run tests
   npm test
   
   # Deploy to Mumbai testnet
   npm run deploy:mumbai
   ```

4. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

## Test Accounts Setup

For comprehensive testing, you'll need at least 5 MetaMask accounts:
1. **Admin**: Contract owner (deployer account)
2. **Producer**: Manufacturer account
3. **Distributor**: Distribution company
4. **Retailer**: Seller account
5. **Buyer**: End customer account

## Test Flow 1: Full Supply Chain (Producer → Distributor → Retailer → Buyer)

### Step 1: Register Participants

**Producer Registration:**
1. Connect with Producer wallet
2. Navigate to `/register`
3. Select role: "Producer/Manufacturer"
4. Fill in verification details (GST certificate)
5. Submit registration
6. Switch to Admin wallet
7. Navigate to `/admin`
8. Verify the producer registration

**Distributor Registration:**
1. Connect with Distributor wallet
2. Repeat registration process
3. Select role: "Distributor"
4. Admin verifies

**Retailer Registration:**
1. Connect with Retailer wallet
2. Register as "Retailer/Seller"
3. Admin verifies

**Buyer Registration:**
1. Connect with Buyer wallet
2. Register as "Buyer/Consumer"
3. Admin verifies

### Step 2: Producer Creates Product

1. Connect with Producer wallet
2. Navigate to `/producer`
3. Click "Create Product"
4. Fill in product details:
   - Name: "iPhone 15 Pro Max"
   - Type: Physical
   - Description: "Latest flagship smartphone"
   - Serial Number: "FFMQ3LL/A-12345"
   - Model: "A3104"
   - Category: "Electronics"
   - Warranty: 365 days
   - Manufacturer: "Apple Inc."
5. Upload product image (optional)
6. Submit and wait for transaction confirmation
7. Product should appear in "My Products"
8. Note the Token ID

### Step 3: Transfer to Distributor

1. Still as Producer, click on the product
2. View product details at `/product/{tokenId}`
3. Go back to Producer Dashboard
4. Click "Transfer to Distributor"
5. Enter Distributor's wallet address
6. Confirm transaction

### Step 4: Distributor Forwards to Retailer

1. Switch to Distributor wallet
2. Navigate to `/distributor`
3. Product should appear in inventory
4. Click "Transfer to Retailer"
5. Enter Retailer's wallet address
6. Confirm transaction

### Step 5: Retailer Sells to Buyer

1. Switch to Retailer wallet
2. Navigate to `/retailer`
3. Product should appear in inventory
4. Click "Sell to Buyer"
5. Enter Buyer's wallet address
6. Enter sale details (optional)
7. Confirm transaction

### Step 6: Verify Final Ownership

1. Switch to Buyer wallet
2. Navigate to `/buyer`
3. Product should appear in "My Products"
4. Click on product to view details
5. Verify:
   - Current owner is Buyer
   - Transfer history shows all 4 transfers
   - Warranty status
   - Product authenticity

**Expected Results:**
- ✅ Product ownership transferred through complete supply chain
- ✅ All transfer events recorded on blockchain
- ✅ Transfer history visible with timestamps
- ✅ Product status updated correctly at each step
- ✅ Warranty countdown started from production date

## Test Flow 2: Direct Sale (Producer → Buyer)

### Step 1: Producer Creates Another Product

1. Connect as Producer
2. Create new product (different serial number)
3. Note Token ID

### Step 2: Direct Sale to Buyer

1. As Producer, click "Sell to Buyer" (if available in UI)
   - Alternatively, transfer directly using smart contract
2. Enter Buyer's wallet address
3. Confirm transaction

### Step 3: Verify Ownership

1. Switch to Buyer wallet
2. Check `/buyer` dashboard
3. New product should appear
4. Verify transfer history shows only:
   - Manufacture
   - Direct sale to buyer

**Expected Results:**
- ✅ Product transferred directly from producer to buyer
- ✅ No intermediary transfers recorded
- ✅ Both products visible in buyer's inventory

## Test Flow 3: Secondary Market (Buyer → Buyer Transfer)

### Step 1: Buyer Resells Product

1. Connect as Buyer (who owns product)
2. Navigate to `/buyer`
3. Select a product
4. Click "Resell"
5. Enter another buyer's wallet address (use a 6th test account or resell to Distributor/Retailer)
6. Confirm transaction

### Step 2: Verify New Ownership

1. Switch to new buyer wallet
2. Check their buyer dashboard
3. Product should appear
4. View product details
5. Verify transfer history includes:
   - All original transfers
   - Secondary sale event

### Step 3: Multiple Resales

1. Resell again to another account
2. Verify complete chain of ownership preserved
3. Check warranty status (should still be based on original manufacture date)

**Expected Results:**
- ✅ Product successfully transferred between buyers
- ✅ Complete ownership history maintained
- ✅ Product marked as "Resold" status
- ✅ Original warranty info preserved
- ✅ Can resell multiple times

## Test Flow 4: Warranty Verification

### Step 1: Create Product with Short Warranty

1. As Producer, create product with 1-day warranty
2. Note Token ID

### Step 2: Transfer Through Chain

1. Transfer to buyer through any path
2. View product details
3. Verify "Warranty Valid" badge shows

### Step 3: Wait for Expiry

1. After 24 hours, view product again
2. Or use Hardhat time manipulation in tests:
   ```javascript
   await ethers.provider.send("evm_increaseTime", [86400]);
   await ethers.provider.send("evm_mine");
   ```

### Step 4: Verify Expired Status

1. Refresh product details
2. Should show "Warranty Expired" badge

**Expected Results:**
- ✅ Warranty countdown accurate
- ✅ Expiry detection works correctly
- ✅ UI reflects warranty status accurately

## Test Flow 5: Authenticity Verification

### Test Authentic Product:

1. Create product as verified producer
2. Transfer through chain
3. View product details
4. Should show "✓ Authentic" badge

### Test Unauthorized Product:

1. Try creating product with unverified account
2. Transaction should fail with "Unauthorized" error

**Expected Results:**
- ✅ Only verified producers can create products
- ✅ Authenticity verified by checking producer's verified status
- ✅ Fake products cannot be created

## Test Flow 6: Admin Functions

### Verify Participants:

1. Have multiple accounts register
2. As Admin, view pending list
3. Verify some, reject others
4. Verified accounts gain access to their dashboards
5. Rejected accounts remain without access

### Deactivate Participant:

1. Call `deactivateParticipant` via smart contract
2. Deactivated account cannot perform role actions
3. Reactivate and verify functionality restored

**Expected Results:**
- ✅ Admin can approve/reject registrations
- ✅ Only verified participants can perform actions
- ✅ Deactivation prevents operations

## Automated Contract Tests

Run the comprehensive test suite:

```bash
npm test
```

Tests cover:
- ✅ Participant registration and verification
- ✅ Role-based access control
- ✅ Product creation and minting
- ✅ All transfer types
- ✅ Warranty management
- ✅ Transfer history tracking
- ✅ Authenticity verification
- ✅ Edge cases and error handling

## Common Issues and Solutions

### Issue: Transaction Fails with "Insufficient Funds"
**Solution:** Get more Mumbai MATIC from faucet

### Issue: "Wrong Network" warning
**Solution:** Switch MetaMask to Polygon Mumbai (Chain ID: 80001)

### Issue: IPFS upload fails
**Solution:** Check Pinata API keys in `.env` file

### Issue: Product metadata doesn't load
**Solution:** Ensure IPFS gateway is accessible, check console for errors

### Issue: Contract address not found
**Solution:** Run deployment script first, check `frontend/src/contracts/deployment-mumbai.json`

### Issue: "Participant not verified" error
**Solution:** Admin must verify the participant first

## Performance Testing

### Gas Usage:
- Product creation: ~200,000 gas
- Transfers: ~100,000 gas
- Registration: ~150,000 gas

### IPFS Upload Times:
- Small metadata (< 1KB): 1-2 seconds
- With images (< 5MB): 5-10 seconds

## Security Testing

1. **Access Control:**
   - Try operations with wrong roles (should fail)
   - Try operations with unverified accounts (should fail)

2. **Ownership:**
   - Try transferring products you don't own (should fail)
   - Try selling already-sold products (should fail)

3. **Data Integrity:**
   - Verify immutable product metadata on IPFS
   - Check transfer history cannot be altered

## Test Checklist

- [ ] All 5 roles registered and verified
- [ ] Product created successfully
- [ ] Full supply chain transfer completed
- [ ] Direct producer-to-buyer sale works
- [ ] Buyer-to-buyer resale works
- [ ] Transfer history accurate
- [ ] Warranty tracking works
- [ ] Authenticity verification correct
- [ ] Admin approval/rejection works
- [ ] IPFS metadata uploads and retrieves
- [ ] All automated tests pass
- [ ] UI reflects blockchain state accurately
- [ ] Error messages clear and helpful

## Next Steps

After successful testing:
1. Deploy to Polygon mainnet
2. Verify contracts on Polygonscan
3. Update frontend with mainnet addresses
4. Implement additional features (see ROADMAP.md)

