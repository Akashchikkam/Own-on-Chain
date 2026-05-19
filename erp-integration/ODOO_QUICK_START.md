# 🚀 Odoo Quick Start Guide

## Current Status

Odoo is being set up. Check status:

```bash
docker ps --filter "name=odoo"
```

## Access Odoo

Once running, open: **http://localhost:8069**

## First-Time Setup

1. **Create Database**
   - Database name: `test_erp`
   - Email: `admin@test.com` (any email works)
   - Password: `admin` (or your choice)
   - Language: English
   - Click "Create Database"

2. **Install Inventory Module**
   - Go to **Apps** menu
   - Search: **"Inventory"**
   - Click **"Install"**

3. **Configure Own-on-Chain Integration**

   **Option A: Use Odoo Webhook Module**
   - Install "Webhooks" module (if available)
   - Configure endpoint: `http://localhost:3001/api/webhooks/incoming`
   - Set webhook secret

   **Option B: Custom Integration Script**
   - Create custom Odoo module
   - Add webhook receiver endpoint
   - Configure product sync

## Register Webhook in Own-on-Chain

1. Go to Producer Dashboard: http://localhost:5173
2. Click **"🔗 Webhooks"**
3. Register: `http://localhost:8069/webhooks/own-on-chain`
4. Select all events
5. **Save the secret key!**

## Test Integration

### Test 1: Send Product from Odoo to Own-on-Chain

1. In Odoo: **Inventory** → **Products** → **Create**
2. Fill product details
3. Trigger webhook to Own-on-Chain
4. Check Producer Dashboard for pending product
5. Approve product

### Test 2: Receive Webhook from Own-on-Chain

1. Create product in Own-on-Chain
2. Odoo should receive `product.created` webhook
3. Product appears in Odoo inventory

## Troubleshooting

**Odoo not accessible?**
```bash
# Check if containers are running
docker ps

# Check logs
docker logs odoo-own-on-chain

# Restart if needed
cd erp-integration/odoo && ./setup-odoo.sh
```

**Webhook not working?**
- Verify webhook URL is correct
- Check webhook secret matches
- Verify Odoo webhook endpoint is accessible
- Check backend logs: `tail -f backend/logs/*.log`

## Next Steps

Once Odoo is running:
1. Complete first-time setup
2. Install Inventory module
3. Configure webhook integration
4. Test bidirectional sync

