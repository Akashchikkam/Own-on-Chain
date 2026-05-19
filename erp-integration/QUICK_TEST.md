# 🧪 Quick ERP Integration Test

## Option 1: Use Our Test ERP (Fastest - 2 minutes)

```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6" node erp-integration-complete.js
```

**What it does:**
- Starts ERP server on port 3002
- Receives webhooks from Own-on-Chain
- Sends products to Own-on-Chain
- Full bidirectional sync

**Test it:**
1. Register webhook in Producer Dashboard: `http://localhost:3002/webhooks/own-on-chain`
2. Create product: `POST http://localhost:3002/api/products/create`
3. Check products: `GET http://localhost:3002/api/products`

---

## Option 2: Odoo Community Edition (Real ERP - 10 minutes)

### Step 1: Install Odoo
```bash
# Using Docker (easiest)
docker run -d -p 8069:8069 --name odoo odoo:latest
```

### Step 2: Access Odoo
- Open: http://localhost:8069
- Create database: `test_erp`
- Install "Inventory" app

### Step 3: Enable API
- Settings → Technical → API → Enable REST API
- Create API user

### Step 4: Configure Webhooks
- Use Odoo's webhook module or custom script
- Point to Own-on-Chain webhook endpoint

---

## Option 3: ERPNext (Free Cloud - 5 minutes)

1. Sign up: https://frappecloud.com (free tier)
2. Create new site
3. Install ERPNext
4. Configure webhooks in Settings

---

## 🎯 Recommended: Option 1 (Test ERP)

**Why:** Fastest, works immediately, shows full integration

**Steps:**
1. Run the command above
2. Register webhook URL in Producer Dashboard
3. Test creating products
4. See bidirectional sync working

---

**Choose Option 1 for quickest test!**

