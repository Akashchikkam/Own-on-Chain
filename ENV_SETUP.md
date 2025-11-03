# Environment Variables Setup

## 🔴 CRITICAL: Without these, metadata won't load!

### Frontend `.env` file location:
```
/Users/c.v.akash/Own-on-Chain/frontend/.env
```

### Required variables:

```env
# Backend API
VITE_BACKEND_URL=http://localhost:3001/api

# Blockchain Network (Sepolia Testnet)
VITE_NETWORK_NAME=sepolia
VITE_CHAIN_ID=11155111

# IPFS / Pinata (REQUIRED!)
VITE_PINATA_API_KEY=your_pinata_api_key_here
VITE_PINATA_SECRET_KEY=your_pinata_secret_key_here
```

---

## 🚨 Current Problem: No Pinata Keys = No Metadata

**What happens without Pinata keys:**
- Product images won't load ❌
- Product details won't load ❌
- Verification page fails ❌
- System falls back to localStorage (clears on refresh) ❌

**What you need to do:**

### Option 1: Get Pinata Keys (5 minutes) ⭐ RECOMMENDED

1. Go to https://app.pinata.cloud/
2. Sign up (free account)
3. Go to API Keys section
4. Click "New Key"
5. Give it a name: "Own-on-Chain"
6. Enable permissions: `pinFileToIPFS`, `pinJSONToIPFS`
7. Copy the keys
8. Add to `frontend/.env`:
   ```env
   VITE_PINATA_API_KEY=your_actual_key
   VITE_PINATA_SECRET_KEY=your_actual_secret
   ```
9. Restart frontend: `npm run dev`

### Option 2: Use Mock Mode (For Testing Only)

If you want to test without Pinata temporarily, the system will use localStorage but:
- ⚠️ Data will be lost on page refresh
- ⚠️ Won't work for public verification
- ⚠️ Not production-ready

---

## How to check if it's working:

### After adding Pinata keys:

```bash
# 1. Restart frontend
cd /Users/c.v.akash/Own-on-Chain/frontend
npm run dev

# 2. Check browser console
# Should see: "✅ Using Pinata for IPFS uploads"
# Should NOT see: "⚠️ Using local mock storage"
```

### Test flow:
1. Go to Producer Dashboard
2. Create a product with an image
3. Refresh the page
4. Product image should still be there ✅
5. Go to `/verify/{tokenId}`
6. Product details should load ✅

---

## Backend `.env` (Optional for now)

```
/Users/c.v.akash/Own-on-Chain/backend/.env
```

```env
PORT=3001
FRONTEND_URL=http://localhost:5173

# IDfy (for real-time verification - optional)
IDFY_API_KEY=your_idfy_key
IDFY_API_SECRET=your_idfy_secret
```

---

## Quick Fix Checklist:

- [ ] Go to https://app.pinata.cloud and sign up
- [ ] Create API key
- [ ] Add `VITE_PINATA_API_KEY` to frontend/.env
- [ ] Add `VITE_PINATA_SECRET_KEY` to frontend/.env  
- [ ] Restart frontend server
- [ ] Test by creating a product
- [ ] Refresh page - image should persist
- [ ] Test verification page

---

**Without Pinata keys, the entire system won't work properly!** 🚨

This is the #1 issue causing your problems.

