# ✅ Odoo Setup Complete!

## Status

✅ Odoo server started  
✅ Integration module created  
✅ Ready for testing  

---

## Next Steps (For You to Test)

### 1. Access Odoo
**Open:** http://localhost:8069

**First time setup:**
- Database name: `test_erp`
- Email: `admin@test.com`  
- Password: `admin`
- Click "Create Database"

---

### 2. Install Integration Module

1. Go to **Apps** menu
2. Click **"Update Apps List"** (top right)
3. Remove **"Apps"** filter (click X)
4. Search: **"Own-on-Chain Integration"**
5. Click **"Install"**

---

### 3. Configure Webhook Secret

1. Go to **Settings** → **Technical** → **Parameters** → **System Parameters**
2. Click **"Create"**
3. Key: `own_on_chain.webhook_secret`
4. Value: `c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6`
5. Click **"Save"**

---

### 4. Register Webhook in Own-on-Chain

1. Go to Producer Dashboard: http://localhost:5173
2. Click **"🔗 Webhooks"**
3. Register: `http://localhost:8069/webhooks/own-on-chain`
4. Select all events
5. **Copy the secret key** (you'll need it)

---

### 5. Test Integration

**In Odoo:**
1. Go to **Inventory** → **Products** → **Products**
2. Create product: "Test Product from Odoo"
3. Scroll to **"Own-on-Chain Integration"** section
4. Fill in:
   - URL: `http://localhost:3001`
   - Secret: (paste secret from step 4)
5. Click **"Send to Own-on-Chain"**

**In Producer Dashboard:**
1. Check **"Pending Product Requests"**
2. Click **"✅ Approve & Create"**
3. Verify Token ID appears in Odoo

---

## ✅ Success!

If Token ID appears in Odoo, integration is working!

---

**Odoo URL:** http://localhost:8069  
**Status:** Ready for testing

