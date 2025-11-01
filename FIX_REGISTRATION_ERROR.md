# 🔧 Fix Registration Error - Start Fresh

## ❌ Problem
You registered Account #3 (0x90F7...b906) as **Producer** but it should be **Retailer**.

## ✅ Solution: Restart Hardhat & Register Correctly

Since this is **localhost testing**, the easiest fix is to restart Hardhat node and register everyone correctly.

---

## 🚀 Quick Fix Steps

### Step 1: Stop Hardhat Node
1. Find the terminal running `npx hardhat node`
2. Press `Ctrl + C` to stop it
3. **Note:** This will delete all local data (expected for localhost)

### Step 2: Restart Everything
```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts (wait for Terminal 1 to start first!)
npm run deploy:local

# Terminal 3: Frontend should still be running
# If not: cd frontend && npm run dev
```

### Step 3: Register Correctly This Time

Follow this **exact order**:

#### Account #1 → Producer
1. Switch to Account #1 in MetaMask: `0x7099...79C8`
2. Go to Register page
3. Select **"Producer/Manufacturer"** ✅
4. Fill form and submit
5. Wait for confirmation

#### Account #2 → Distributor
1. Switch to Account #2: `0x3C44...93BC`
2. Select **"Distributor"** ✅
3. Submit

#### Account #3 → Retailer ⚠️ (You got this wrong before!)
1. Switch to Account #3: `0x90F7...b906`
2. **IMPORTANT:** Select **"Retailer/Seller"** ✅ (NOT Producer!)
3. Submit

#### Account #4 → Buyer
1. Switch to Account #4: `0x15d3...6A65`
2. Select **"Buyer/Consumer"** ✅
3. Submit

### Step 4: Verify as Admin
1. Switch to Account #0: `0xf39F...9266` (Admin)
2. Go to Admin dashboard
3. Verify all 4 participants

---

## ✅ Correct Account Mapping

| MetaMask Account | Address (short) | Role | ✅ Correct |
|-----------------|-----------------|------|-----------|
| Account #0 | 0xf39F...9266 | **Admin** | Don't register |
| Account #1 | 0x7099...79C8 | **Producer** | ✅ |
| Account #2 | 0x3C44...93BC | **Distributor** | ✅ |
| Account #3 | 0x90F7...b906 | **Retailer** | ⚠️ You registered as Producer! |
| Account #4 | 0x15d3...6A65 | **Buyer** | ✅ |

---

## 🎯 Double-Check Before Registering

**When registering Account #3:**
- ✅ **Correct:** Select "Retailer/Seller"
- ❌ **Wrong:** Selecting "Producer/Manufacturer"

**Visual Check:**
- The dropdown should show "Retailer/Seller" selected
- NOT "Producer/Manufacturer"

---

## 🔍 How to Verify It's Fixed

After registering Account #3:
1. Go to Register page
2. You should see: "Already registered as **Retailer**"
3. Status should show: "Pending" or "Verified"

---

## 💡 Alternative: Use Different Accounts

If you don't want to restart Hardhat:

**Option 1:** Use Account #1 for Producer (correct)
- Account #1: Producer ✅
- Account #3: Keep as Producer (incorrect but works for testing)
- Use Account #5 or #6: Register as Retailer

**Option 2:** Accept the mistake for now
- Account #3 is Producer (wrong, but works)
- Use another account (#5, #6, etc.) for Retailer role

**But for clean testing, restart Hardhat is best!**

---

## 📝 Why Can't We Change Roles?

The smart contract prevents changing roles because:
- Once registered, the address is locked to that role
- This prevents fraud/manipulation
- Only solution: Use different address or restart (localhost only)

---

**Quick Fix:** Restart Hardhat → Register Account #3 as **Retailer** (not Producer) ✅

