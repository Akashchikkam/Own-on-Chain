# 🔄 Data Persistence Guide

## ⚠️ Important: Understanding Hardhat Localhost Behavior

### The Problem

**Hardhat's localhost network is EPHEMERAL** - this means:
- ✅ When you deploy contracts → They exist
- ❌ When you restart Hardhat node (`npx hardhat node`) → **ALL DATA IS LOST**
- ❌ All registrations disappear
- ❌ All products disappear
- ❌ All transactions are gone

### Why This Happens

Hardhat creates a **temporary in-memory blockchain** that resets every time you restart it. This is by design for development/testing.

---

## 🔍 Your Specific Issues Explained

### Issue 1: Duplicate Registrations

**What was happening:**
- You could register multiple times with the same wallet
- Frontend didn't check if you're already registered

**Root Cause:**
- Contracts were being redeployed (fresh state)
- Frontend didn't validate existing registrations before submission

**✅ FIXED:**
- Frontend now checks registration status before allowing submission
- Shows clear message if already registered
- Prevents duplicate registration attempts

### Issue 2: Products Disappearing

**What was happening:**
- Created products
- Restarted Hardhat node
- Products are gone

**Root Cause:**
- Restarting Hardhat node = New blockchain = No data

**⚠️ NOT A BUG - This is expected behavior for localhost**

---

## 💡 Solutions

### Option 1: Keep Hardhat Node Running (Recommended for Development)

**Don't restart Hardhat node** if you want to keep your data:

```bash
# Terminal 1: Start Hardhat node (keep it running!)
npx hardhat node

# Terminal 2: Deploy once (only if contracts changed)
npm run deploy:local

# Terminal 3: Start frontend
cd frontend && npm run dev
```

**Important:**
- ✅ As long as Hardhat node keeps running, data persists
- ✅ Can create products, register users, etc.
- ❌ If you close Terminal 1 (Hardhat node), all data is lost

### Option 2: Use Polygon Mumbai Testnet (Production-Like)

**For persistent data, use a real testnet:**

1. **Deploy to Mumbai Testnet:**
   ```bash
   npm run deploy:mumbai
   ```

2. **Update frontend `.env`:**
   ```env
   VITE_NETWORK_NAME=mumbai
   VITE_CHAIN_ID=80001
   ```

3. **Benefits:**
   - ✅ Data persists permanently
   - ✅ Real blockchain (no resets)
   - ✅ Test with real transactions
   - ✅ Can verify on Polygonscan

4. **Drawbacks:**
   - ❌ Need test MATIC (free from faucet)
   - ❌ Transactions cost gas (small amounts)
   - ❌ Slower than localhost

### Option 3: Use Forked Network (Advanced)

You can fork Mumbai testnet locally to get persistent data:

1. **Add to `hardhat.config.js`:**
   ```javascript
   networks: {
     localhost: {
       chainId: 1337,
       forking: {
         url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
       }
     }
   }
   ```

2. **Benefits:**
   - ✅ Fast (local)
   - ✅ Some persistence
   - ❌ Still resets on restart

---

## 📊 Data Storage Locations

### Where Data is Stored

1. **Smart Contracts (Blockchain):**
   - ✅ Registrations → `ParticipantRegistry` contract
   - ✅ Products → `ProductNFT` + `SupplyChain` contracts
   - ✅ Transfer history → `ProductNFT` contract
   - ❌ Lost when Hardhat node restarts (localhost only)

2. **IPFS (Pinata or Local Mock):**
   - ✅ Product metadata (images, descriptions)
   - ✅ Verification documents
   - ⚠️ Local mock mode: Lost when browser refreshes
   - ✅ Real Pinata: Persists permanently

3. **Frontend State:**
   - ❌ Only in browser memory
   - ❌ Lost on page refresh
   - ✅ Automatically reloads from blockchain

---

## 🛠️ How to Check if Data Exists

### Check Registration Status

The Register page now automatically:
- ✅ Checks if you're already registered
- ✅ Shows your current role and status
- ✅ Prevents duplicate registration

### Check Products

Products should appear in:
- ✅ Producer Dashboard (if you're the producer)
- ✅ Distributor Dashboard (if transferred to you)
- ✅ Retailer Dashboard (if transferred to you)
- ✅ Buyer Dashboard (if you own them)

**If products are missing:**
1. Check you're on the correct account
2. Check Hardhat node is still running
3. Refresh the page
4. Check browser console for errors

---

## 🚨 Common Scenarios

### Scenario 1: "I restarted Hardhat node and lost everything"

**This is normal!** Hardhat localhost resets on restart.

**Solution:**
- Keep Hardhat node running
- Or deploy to Mumbai testnet for persistence

### Scenario 2: "I can register multiple times"

**This should be FIXED now!**

**How to verify:**
1. Register once
2. Try to register again
3. Should see: "Already Registered" message
4. Submit button should be disabled

### Scenario 3: "Products I created yesterday are gone"

**Possible reasons:**
1. Hardhat node was restarted (localhost)
2. Using different wallet account
3. Contracts were redeployed

**Solution:**
- Check you're using the same account
- Keep Hardhat node running continuously
- Or use Mumbai testnet

### Scenario 4: "I want persistent data for testing"

**Best Solution: Deploy to Mumbai Testnet**

```bash
# Get free MATIC from faucet: https://faucet.polygon.technology/

# Deploy to Mumbai
npm run deploy:mumbai

# Update frontend to use Mumbai
# Edit frontend/.env:
VITE_NETWORK_NAME=mumbai
VITE_CHAIN_ID=80001

# Restart frontend
cd frontend && npm run dev
```

---

## ✅ Verification Checklist

### After Fix Applied:

- [ ] Register page checks existing registration
- [ ] Shows "Already Registered" if already registered
- [ ] Submit button disabled if already registered
- [ ] Clear error messages for duplicate registration
- [ ] Registration status displays correctly

### To Test:

1. **Register as Producer:**
   - Go to Register page
   - Select "Producer"
   - Submit registration
   - ✅ Should see success

2. **Try to Register Again:**
   - Stay on Register page
   - Try to submit again
   - ✅ Should see "Already Registered" warning
   - ✅ Submit button should be disabled

3. **Check Registration Status:**
   - ✅ Should show your role (Producer)
   - ✅ Should show status (Pending/Verified)
   - ✅ Should show registration date

---

## 📝 Best Practices

### For Development:

1. **Keep Hardhat node running** in a separate terminal
2. **Deploy contracts once** (unless you changed contracts)
3. **Use localhost for fast iteration**
4. **Save important test data** (copy addresses, token IDs)

### For Testing:

1. **Use Mumbai testnet** for persistent data
2. **Keep track of contract addresses**
3. **Document test scenarios**
4. **Use different accounts** for different roles

### For Production:

1. **Always use real networks** (Mumbai testnet or Polygon mainnet)
2. **Never use localhost** for production
3. **Verify contracts** on Polygonscan
4. **Backup important data**

---

## 🔗 Related Files

- `contracts/ParticipantRegistry.sol` - Registration logic
- `frontend/src/pages/Register.jsx` - Registration UI (FIXED)
- `frontend/src/utils/contractHelpers.js` - Contract interactions (FIXED)
- `scripts/deploy.js` - Deployment script
- `hardhat.config.js` - Network configuration

---

## ❓ FAQ

**Q: Why do I lose data when restarting Hardhat?**
A: Hardhat localhost is an in-memory blockchain that resets on restart. This is normal behavior.

**Q: Can I make localhost persistent?**
A: Not really. Use Mumbai testnet for persistent data.

**Q: Will my data persist on Mumbai testnet?**
A: Yes! Mumbai is a real testnet blockchain. Data persists permanently.

**Q: How do I know if I'm already registered?**
A: The Register page now automatically checks and displays your registration status.

**Q: Can I register with the same wallet multiple times?**
A: No! The system now prevents this. Each wallet can only register once.

**Q: What happens if I restart my computer?**
A: If using localhost, Hardhat node stops and data is lost. Use Mumbai testnet for persistent data across restarts.

---

**Last Updated:** After fixing duplicate registration issue
**Status:** ✅ Registration check implemented, duplicate prevention active

