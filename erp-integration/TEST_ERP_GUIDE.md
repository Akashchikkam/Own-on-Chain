# 🧪 Test ERP Integration (No Docker Required)

## ✅ Quick Start (2 minutes)

### Step 1: Start Test ERP

**Run this:**
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration
./START_TEST_ERP.sh
```

**Or manually:**
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6" node erp-integration-complete.js
```

You should see:
```
🚀 ERP Integration Server running on port 3002
📡 Webhook receiver: http://localhost:3002/webhooks/own-on-chain
```

---

### Step 2: Register Webhook in Own-on-Chain

1. Go to Producer Dashboard: http://localhost:5173
2. Click **"🔗 Webhooks"**
3. Click **"+ Register New Webhook"**
4. URL: `http://localhost:3002/webhooks/own-on-chain`
5. Select all events
6. Click **"Register"**
7. **Copy the secret key** shown

---

### Step 3: Test - Send Product from ERP

**In a new terminal, run:**
```bash
curl -X POST http://localhost:3002/api/products/create \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Test Product from ERP",
    "serialNumber": "SN-ERP-001",
    "description": "Testing integration",
    "category": "Electronics",
    "model": "TEST-001",
    "productType": "physical",
    "warrantyPeriod": 365,
    "manufacturer": {
      "name": "Test Manufacturer",
      "country": "USA"
    }
  }'
```

**Or use browser/Postman:**
- POST `http://localhost:3002/api/products/create`
- Body: JSON (see above)

---

### Step 4: Approve in Producer Dashboard

1. Go to Producer Dashboard
2. Scroll to **"📥 Pending Product Requests"**
3. Click **"✅ Approve & Create"**
4. Confirm in MetaMask

---

### Step 5: Verify Sync

**Check ERP received webhook:**
```bash
curl http://localhost:3002/api/products
```

You should see the product with Token ID!

---

## ✅ Success!

If you see Token ID in the ERP response, integration is working!

**What happened:**
- ✅ ERP → Own-on-Chain: Product sent
- ✅ Own-on-Chain → ERP: Webhook received, product updated

---

## 📋 API Endpoints

- **Create Product:** `POST http://localhost:3002/api/products/create`
- **List Products:** `GET http://localhost:3002/api/products`
- **Get Product:** `GET http://localhost:3002/api/products/:tokenId`
- **Health Check:** `GET http://localhost:3002/health`
- **Webhook Receiver:** `POST http://localhost:3002/webhooks/own-on-chain`

---

**This test ERP works exactly like Odoo for integration testing!**

