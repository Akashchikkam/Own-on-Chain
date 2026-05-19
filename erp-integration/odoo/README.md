# Odoo + Own-on-Chain Integration

## Quick Setup (5 steps)

### Step 1: Start Odoo
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/odoo
./setup-odoo.sh
```

Wait 1-2 minutes for Odoo to start.

### Step 2: Access Odoo
Open: http://localhost:8069

**First time:**
- Database: `test_erp`
- Email: `admin@test.com`
- Password: `admin`
- Click "Create Database"

### Step 3: Install Integration Module
1. Go to **Apps** menu
2. Click **"Update Apps List"** (top right)
3. Remove **"Apps"** filter (click X)
4. Search: **"Own-on-Chain Integration"**
5. Click **"Install"**

### Step 4: Configure Webhook Secret
1. Go to **Settings** → **Technical** → **Parameters** → **System Parameters**
2. Click **"Create"**
3. Key: `own_on_chain.webhook_secret`
4. Value: `c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6`
5. Click **"Save"**

### Step 5: Register Webhook in Own-on-Chain
1. Go to Producer Dashboard
2. Click **"🔗 Webhooks"**
3. Register: `http://localhost:8069/webhooks/own-on-chain`
4. Select all events
5. Copy the secret (use it in Step 4 above)

---

## Test Integration

### Test 1: Send Product from Odoo
1. Go to **Inventory** → **Products** → **Products**
2. Create new product or open existing
3. Fill in **Own-on-Chain Integration** section:
   - URL: `http://localhost:3001`
   - Secret: (your webhook secret)
4. Click **"Send to Own-on-Chain"**
5. Check Producer Dashboard for pending product

### Test 2: Approve in Own-on-Chain
1. Go to Producer Dashboard
2. Scroll to **"Pending Product Requests"**
3. Click **"✅ Approve & Create"**
4. Check Odoo - product should update with Token ID

### Test 3: Check Webhooks
1. Create product in Own-on-Chain
2. Check Odoo logs for webhook received
3. Product should sync automatically

---

## Troubleshooting

**Odoo not starting?**
```bash
docker ps -a | grep odoo
docker logs odoo-own-on-chain
```

**Module not showing?**
- Make sure you removed "Apps" filter
- Click "Update Apps List"
- Check custom-addons folder exists

**Webhook not working?**
- Check webhook secret matches in both systems
- Verify Odoo is accessible at http://localhost:8069
- Check Odoo logs: `docker logs odoo-own-on-chain`

---

**Status**: Ready to test!

