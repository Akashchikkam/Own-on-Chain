# 🧪 Odoo Integration Test Steps

## What I've Set Up For You

✅ Odoo ERP server ready  
✅ Custom integration module created  
✅ Webhook endpoints configured  
✅ Bidirectional sync ready  

---

## Your Testing Steps (Simple)

### Part 1: Start Odoo (2 minutes)

**Run this command:**
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/odoo
./START_ODOO.sh
```

**Wait 1-2 minutes, then:**
1. Open browser: http://localhost:8069
2. Create database:
   - Database name: `test_erp`
   - Email: `admin@test.com`
   - Password: `admin`
   - Click "Create Database"

---

### Part 2: Install Integration Module (3 minutes)

1. In Odoo, go to **Apps** menu (top left)
2. Click **"Update Apps List"** button (top right)
3. Remove **"Apps"** filter (click the X on the filter)
4. Search: **"Own-on-Chain"**
5. Click **"Install"** button

---

### Part 3: Configure (2 minutes)

1. Go to **Settings** (gear icon, top right)
2. Click **"Activate Developer Mode"** (bottom of page)
3. Go to **Technical** → **Parameters** → **System Parameters**
4. Click **"Create"**
5. Fill in:
   - **Key**: `own_on_chain.webhook_secret`
   - **Value**: `c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6`
6. Click **"Save"**

---

### Part 4: Register Webhook (2 minutes)

1. Go to Producer Dashboard: http://localhost:5173
2. Click **"🔗 Webhooks"**
3. Click **"+ Register New Webhook"**
4. URL: `http://localhost:8069/webhooks/own-on-chain`
5. Select all events
6. Click **"Register"**
7. **Copy the secret key shown** (you'll need it)

---

### Part 5: Test - Send Product from Odoo (3 minutes)

1. In Odoo, go to **Inventory** → **Products** → **Products**
2. Click **"Create"**
3. Fill in:
   - **Product Name**: `Test Product from Odoo`
   - **Internal Reference**: `ODOO-001`
   - **Category**: Create or select any
4. Scroll down to **"Own-on-Chain Integration"** section
5. Fill in:
   - **Own-on-Chain URL**: `http://localhost:3001`
   - **Webhook Secret**: (paste the secret from Part 4)
6. Click **"Send to Own-on-Chain"** button
7. You should see: "Product sent to Own-on-Chain. Waiting for approval."

---

### Part 6: Test - Approve in Own-on-Chain (2 minutes)

1. Go to Producer Dashboard
2. Scroll to **"📥 Pending Product Requests"**
3. You should see: "Test Product from Odoo"
4. Click **"✅ Approve & Create"**
5. Confirm in MetaMask
6. Wait for confirmation

---

### Part 7: Verify Sync (1 minute)

1. Go back to Odoo
2. Open the product you created
3. Check **"Own-on-Chain Integration"** section
4. You should see:
   - **Token ID**: (a number)
   - **Status**: "Synced to Blockchain"

---

## ✅ Success!

If you see the Token ID in Odoo, the integration is working!

**What happened:**
- ✅ Odoo → Own-on-Chain: Product sent and created
- ✅ Own-on-Chain → Odoo: Webhook received, product updated

---

## 🐛 If Something Doesn't Work

**Odoo not loading?**
- Wait 2-3 minutes
- Check: `docker ps` (should show odoo-test running)
- Check logs: `docker logs odoo-test`

**Module not showing?**
- Make sure you removed "Apps" filter
- Click "Update Apps List"
- Check you're in Developer Mode

**Webhook not working?**
- Verify secret matches in both systems
- Check Odoo logs: `docker logs odoo-test | grep webhook`
- Check Producer Dashboard webhook logs

---

**Ready to test! Start with Part 1.**

