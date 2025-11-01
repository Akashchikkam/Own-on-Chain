# ✅ Correct Registration Guide - Fresh Start!

## 🎯 Your Account Setup

| MetaMask Account | Role | What To Do |
|-----------------|------|------------|
| **Account #0** (0xf39F...9266) | **Admin** | ❌ **DO NOT REGISTER** - You're admin by default! |
| **Account #1** (0x7099...79C8) | **Producer** | ✅ Register as "Producer/Manufacturer" |
| **Account #2** (0x3C44...93BC) | **Distributor** | ✅ Register as "Distributor" |
| **Account #3** (0x90F7...b906) | **Retailer** | ✅ Register as "Retailer/Seller" |
| **Account #4** (0x15d3...6A65) | **Buyer** | ✅ Register as "Buyer/Consumer" |

## 📝 Step-by-Step Registration (Do This IN ORDER!)

### BEFORE Starting: Clear MetaMask

1. Open MetaMask
2. Click Settings (gear icon)
3. Go to "Advanced"
4. Scroll to "Clear activity tab data"
5. Click "Clear"
6. Close and reopen MetaMask

### STEP 0: Refresh Browser

1. Go to http://localhost:5173
2. Press **Cmd/Ctrl + Shift + R** (hard refresh)
3. Click "Disconnect" if connected
4. We'll reconnect as needed

---

### STEP 1: Register Producer (Account #1)

1. **Switch to Account #1** in MetaMask (0x7099...79C8)
2. Click "Connect Wallet" in app
3. Approve connection
4. Go to **"Register"** page
5. Fill in:
   - **Role**: "Producer/Manufacturer" ← IMPORTANT!
   - **Document Type**: "GST Certificate"
   - **Document Number**: "PROD123"
   - **Full Name**: "Producer Company"
   - **Address**: "Producer Address"
6. Click "Submit Registration"
7. **Confirm in MetaMask**
8. Wait for "Success!" message

---

### STEP 2: Register Distributor (Account #2)

1. **Switch to Account #2** in MetaMask (0x3C44...93BC)
2. Refresh page if needed
3. Click "Connect Wallet"
4. Go to **"Register"** page
5. Fill in:
   - **Role**: "Distributor" ← IMPORTANT!
   - **Document Type**: "Business License"
   - **Document Number**: "DIST123"
   - **Full Name**: "Distributor Company"
   - **Address**: "Distributor Address"
6. Click "Submit Registration"
7. **Confirm in MetaMask**
8. Wait for success

---

### STEP 3: Register Retailer (Account #3)

1. **Switch to Account #3** in MetaMask (0x90F7...b906)
2. Refresh page if needed
3. Click "Connect Wallet"
4. Go to **"Register"** page
5. Fill in:
   - **Role**: "Retailer/Seller" ← IMPORTANT! (Not Buyer!)
   - **Document Type**: "Business License"
   - **Document Number**: "RET123"
   - **Full Name**: "Retailer Store"
   - **Address**: "Retailer Address"
6. Click "Submit Registration"
7. **Confirm in MetaMask**
8. Wait for success

---

### STEP 4: Register Buyer (Account #4)

1. **Switch to Account #4** in MetaMask (0x15d3...6A65)
2. Refresh page if needed
3. Click "Connect Wallet"
4. Go to **"Register"** page
5. Fill in:
   - **Role**: "Buyer/Consumer" ← IMPORTANT!
   - **Document Type**: "Aadhar Card"
   - **Document Number**: "BUY123"
   - **Full Name**: "John Buyer"
   - **Address**: "Buyer Address"
6. Click "Submit Registration"
7. **Confirm in MetaMask**
8. Wait for success

---

### STEP 5: Verify Everyone as Admin

1. **Switch to Account #0 (Admin)** in MetaMask (0xf39F...9266)
2. Refresh page
3. Click "Connect Wallet"
4. Go to **"Admin"** dashboard
5. You should see **4 pending registrations**:
   - Producer
   - Distributor  
   - Retailer
   - Buyer
6. **Click "Verify" for each one** (4 transactions total)
7. Confirm each in MetaMask

---

## 🎮 After Verification - Test the Full Flow!

### Create Product as Producer:

1. Switch to **Account #1 (Producer)**
2. Go to **"Producer"** dashboard
3. Click **"+ Create Product"**
4. Fill in product details
5. Submit and note the Token ID

### Transfer Through Supply Chain:

1. **Producer → Distributor**: Enter 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
2. **Distributor → Retailer**: Switch to Account #2, enter 0x90F79bf6EB2c4f870365E785982E1f101E93b906
3. **Retailer → Buyer**: Switch to Account #3, enter 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65

### View Product History:

1. Switch to **Account #4 (Buyer)**
2. Go to **"Buyer"** dashboard
3. See your product!
4. Click to view **full transfer history** 🎉

---

## ⚠️ Common Mistakes to Avoid

1. ❌ **Don't register Admin account** - It's already the owner!
2. ❌ **Don't mix up roles** - Producer ≠ Buyer
3. ❌ **Don't register same account twice** - Can't change roles
4. ✅ **DO clear MetaMask activity** before starting
5. ✅ **DO refresh browser** between switching accounts
6. ✅ **DO confirm ALL MetaMask popups**

---

## 🆘 If Something Goes Wrong

If you make a mistake again, just:
1. Stop Hardhat: `pkill -f "hardhat node"`
2. Restart Hardhat: `cd Own-on-Chain && npx hardhat node`
3. Redeploy: `npm run deploy:local`
4. Clear MetaMask activity
5. Start fresh!

---

Good luck! Follow this guide exactly and it will work perfectly! 🚀

