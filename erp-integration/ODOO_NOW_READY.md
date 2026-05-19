# ✅ Odoo is Ready!

## Current Status

**Odoo is running and ready to use!**

- ✅ PostgreSQL: Running
- ✅ Odoo: Running on port 8069
- ✅ Accessible at: http://localhost:8069

## Quick Setup (5 minutes)

### Step 1: Access Odoo

Open in browser: **http://localhost:8069**

### Step 2: Create Database

First time setup:
- **Database name**: `test_erp`
- **Email**: `admin@test.com` (any email works)
- **Password**: `admin` (or your choice)
- **Language**: English
- Click **"Create Database"**

Wait 1-2 minutes for database initialization.

### Step 3: Install Inventory Module

1. After login, go to **Apps** menu (top left)
2. Click **"Update Apps List"** (top right)
3. Remove **"Apps"** filter (click X on filter)
4. Search: **"Inventory"**
5. Click **"Install"** button

### Step 4: Configure Own-on-Chain Integration

**Option A: Simple Webhook Setup**

1. In Odoo, go to **Settings** → **Technical** → **Parameters** → **System Parameters**
2. Create new parameter:
   - **Key**: `own_on_chain.webhook_url`
   - **Value**: `http://localhost:3001/api/webhooks/incoming`
3. Create another parameter:
   - **Key**: `own_on_chain.webhook_secret`
   - **Value**: (get from Producer Dashboard)

**Option B: Use Custom Module (Advanced)**

Create a custom Odoo module with webhook receiver endpoint.

### Step 5: Register Webhook in Own-on-Chain

1. Go to Producer Dashboard: http://localhost:5173
2. Click **"🔗 Webhooks"**
3. Register new webhook:
   - **URL**: `http://localhost:8069/webhooks/own-on-chain` (or your Odoo webhook endpoint)
   - **Events**: Select all (product.created, product.transferred, product.received, product.burned)
4. **Save the secret key!** (You'll need it for Odoo configuration)

## Test Integration

### Test 1: Send Product from Odoo → Own-on-Chain

1. In Odoo: **Inventory** → **Products** → **Create**
2. Fill product details:
   - Name: "Test Product from Odoo"
   - Product Type: Storable Product
   - Add any other details
3. Save product
4. Trigger webhook to Own-on-Chain (via custom module or script)
5. Check Producer Dashboard → Pending Products
6. Approve product

### Test 2: Receive Webhook from Own-on-Chain → Odoo

1. Create product in Own-on-Chain Producer Dashboard
2. Odoo should receive `product.created` webhook
3. Product should appear in Odoo inventory

## Troubleshooting

**Odoo not accessible?**
```bash
# Check if running
docker ps | grep odoo

# Check logs
docker logs odoo-own-on-chain

# Restart if needed
docker restart odoo-own-on-chain
```

**Webhook not working?**
- Verify webhook URL is correct
- Check webhook secret matches
- Verify Odoo webhook endpoint is accessible
- Check Odoo logs: `docker logs odoo-own-on-chain`

## Next Steps

1. ✅ Odoo is running
2. ⏳ Create database (Step 2 above)
3. ⏳ Install Inventory module (Step 3)
4. ⏳ Configure webhook integration (Step 4)
5. ⏳ Register webhook in Own-on-Chain (Step 5)
6. ⏳ Test bidirectional sync

## Alternative: Use Test ERP

If you want to test immediately without Odoo setup:

```bash
cd erp-integration/examples
node erp-integration-complete.js
```

This gives you a working ERP on port 3002 that works exactly like Odoo for testing purposes.

