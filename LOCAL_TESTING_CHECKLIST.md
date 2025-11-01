# 🧪 Local Testing Checklist

## ⚠️ Important: Keep Hardhat Node Running!

**The most important thing:** Keep your Hardhat node running in a separate terminal. If you close it, all data is lost!

---

## 🚀 Quick Start (3 Terminals)

### Terminal 1: Hardhat Node (Keep Running!)
```bash
cd /Users/c.v.akash/Own-on-Chain
npx hardhat node
```
**⚠️ Don't close this terminal!** Keep it running while testing.

### Terminal 2: Deploy Contracts (One Time)
```bash
cd /Users/c.v.akash/Own-on-Chain
npm run deploy:local
```
**Only run this once** (or when you change contracts).

### Terminal 3: Start Frontend
```bash
cd /Users/c.v.akash/Own-on-Chain/frontend
npm run dev
```
Visit: http://localhost:5173

---

## ✅ Testing Checklist

### 1. Registration Flow
- [ ] Register as Producer (Account #1)
- [ ] Register as Distributor (Account #2)
- [ ] Register as Retailer (Account #3)
- [ ] Register as Buyer (Account #4)
- [ ] Verify duplicate registration prevention works
- [ ] As Admin (Account #0), verify all participants

### 2. Product Creation
- [ ] Producer creates product with image
- [ ] Product appears in Producer dashboard
- [ ] Product details page shows correctly
- [ ] Image displays properly

### 3. Supply Chain Flow
- [ ] Producer → Distributor transfer
- [ ] Product appears in Distributor dashboard
- [ ] Distributor → Retailer transfer
- [ ] Product appears in Retailer dashboard
- [ ] Retailer → Buyer sale
- [ ] Product appears in Buyer dashboard

### 4. Product Details
- [ ] View product details
- [ ] Check transfer history
- [ ] Verify warranty status
- [ ] Check authenticity badge

### 5. Secondary Market
- [ ] Buyer resells to another buyer
- [ ] Transfer history updated
- [ ] Warranty preserved

### 6. Data Persistence (Local Testing)
- [ ] Create products
- [ ] Keep Hardhat node running
- [ ] Refresh browser - data still there? ✅
- [ ] Restart Hardhat node - data gone? (Expected for localhost)

---

## 🎯 Key Things to Test

### Registration Duplicate Prevention
1. Register once as Producer
2. Try to register again
3. Should see: "Already Registered" message
4. Submit button should be disabled

### Image Upload
1. Create product with image
2. Check image displays on:
   - Product card (dashboard)
   - Product details page

### Transfer Buttons
1. Producer dashboard: "Transfer to Distributor"
2. Distributor dashboard: "Transfer to Retailer"
3. Retailer dashboard: "Sell to Buyer"
4. Buyer dashboard: "Resell" button

### Error Handling
1. Try transferring to invalid address
2. Try actions without being verified
3. Check error messages are clear

---

## 📊 Account Setup (Hardhat Default Accounts)

Hardhat provides 20 test accounts with 10000 ETH each:

**Account #0:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Admin - Deployer)
**Account #1:** `0x70997970C51812dc3A010C7d32bC67e09c14F11a` (Use as Producer)
**Account #2:** `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (Use as Distributor)
**Account #3:** `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (Use as Retailer)
**Account #4:** `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (Use as Buyer)

---

## 🔍 What to Look For

### ✅ Things That Should Work:
- All registrations work
- No duplicate registrations allowed
- Products create successfully
- Images upload and display
- Transfers work between roles
- Transfer history is complete
- Warranty status shows correctly
- Admin can verify participants

### ⚠️ Things to Watch For:
- Hardhat node crashes (restart it)
- MetaMask connection issues (refresh page)
- Image not loading (check console)
- Contract addresses change (re-deploy if needed)

---

## 🛠️ Common Issues

### "Can't connect to contract"
- **Fix:** Make sure Hardhat node is running
- **Fix:** Run `npm run deploy:local` again

### "Data disappeared"
- **Reason:** Hardhat node was restarted
- **Fix:** Keep Hardhat node running, or accept data loss (localhost behavior)

### "Registration not working"
- **Check:** Are you using the right account?
- **Check:** Is Hardhat node still running?
- **Check:** Were contracts redeployed?

### "Images not showing"
- **Check:** Browser console for errors
- **Check:** Image was uploaded during product creation
- **Note:** Old products (created before fix) might not have images

---

## 📝 Testing Notes

**Write down any issues you find:**
- What feature didn't work?
- What error message did you see?
- What were you trying to do?
- Which account were you using?

This will help when we deploy to Mumbai!

---

## 🚀 When Ready for Mumbai

After testing everything locally:

1. **Document any issues found**
2. **Get test MATIC from faucet** (guide already created)
3. **Create `.env` file** with private key
4. **Deploy to Mumbai** (`npm run deploy:mumbai`)
5. **Update frontend `.env`** for Mumbai network
6. **Test on Mumbai** - data will persist!

---

## 💡 Pro Tips

1. **Keep Hardhat terminal visible** - watch for errors
2. **Use browser console** (F12) - see detailed logs
3. **Test with different accounts** - simulate real users
4. **Take screenshots** - document any bugs
5. **Test error cases** - what happens when things go wrong?

---

**Happy Testing! 🧪**

When you're done testing and ready for Mumbai deployment, just let me know! 🚀

