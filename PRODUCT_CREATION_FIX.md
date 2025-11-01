# ✅ Fix: "Unauthorized: Invalid role or not verified"

## 🔴 Problem

When trying to create a product, you get:
```
execution reverted: "Unauthorized: Invalid role or not verified"
```

## 🎯 Root Cause

**After redeploying contracts, all registrations were lost!**

To create products, you need:
1. ✅ **Registered** as Producer
2. ✅ **Verified** by Admin (status = VERIFIED)
3. ✅ **Active** (automatically true when verified)

---

## ✅ Solution: Re-Register and Verify

### Step 1: Register as Producer

1. **Switch to Account #1** in MetaMask:
   - Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`

2. **Go to Register page**

3. **Select "Producer/Manufacturer"**

4. **Fill the form:**
   - Document Type: GST Certificate
   - Document Number: PROD001
   - Full Name: Producer Company
   - Address: Producer Address

5. **Submit registration**
   - Status will be: **PENDING**

### Step 2: Verify as Admin

1. **Switch to Account #0** (Admin):
   - Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

2. **Go to Admin dashboard**

3. **Find Account #1 in pending list**

4. **Click "Verify"**

5. **Status becomes: VERIFIED ✅**

### Step 3: Create Product

1. **Switch back to Account #1** (Producer)

2. **Go to Producer dashboard**

3. **Click "+ Create Product"**

4. **Fill product details**

5. **Submit** - should work now! ✅

---

## 🔍 How to Check Registration Status

Run this command to see all registrations:
```bash
node scripts/check-registrations.js
```

**Expected Output After Registration:**
```
Producer     | Role: PRODUCER    | Status: PENDING    | Active: ❌
```

**Expected Output After Verification:**
```
Producer     | Role: PRODUCER    | Status: VERIFIED   | Active: ✅
```

---

## ⚠️ Important Notes

### Why This Happened:

When we redeployed contracts to fix the re-registration issue:
- ✅ New contracts deployed (with fix)
- ❌ All old registrations were lost (normal for localhost)
- ✅ Need to register everyone again

### The Flow:

1. **Register** → Status: PENDING ❌ (can't create products)
2. **Admin Verifies** → Status: VERIFIED ✅ (can create products)
3. **Create Products** → Works! ✅

---

## 🎯 Quick Checklist

Before creating products:
- [ ] Registered as Producer (Account #1)
- [ ] Admin verified the registration
- [ ] Status shows as "VERIFIED" (not PENDING)
- [ ] Switch to Producer account
- [ ] Try creating product

---

## 🆘 Still Not Working?

### Check These:

1. **Are you on the right account?**
   - Producer should be: `0x7099...79C8`

2. **Is registration verified?**
   - Check Admin dashboard
   - Status should be VERIFIED (green checkmark)

3. **Refresh the page**
   - Sometimes UI doesn't update immediately

4. **Check browser console**
   - Look for any other errors

---

**Quick Fix: Register → Verify → Create Product! 🚀**

