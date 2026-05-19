# 🔑 Webhook Secret Setup Guide

## Why You Need the Secret

The webhook secret is used for **security** - it verifies that webhooks are actually coming from Own-on-Chain (not fake requests).

## How to Get the Secret Key

### Step 1: Register Webhook in Producer Dashboard

1. **Open Producer Dashboard**
   - Go to: http://localhost:5173
   - Connect your wallet (MetaMask)

2. **Go to Webhooks Section**
   - Click **"🔗 Webhooks"** button
   - Click **"+ Register New Webhook"**

3. **Register Webhook**
   - **URL**: Enter your Odoo webhook endpoint
     - Example: `https://your-odoo-instance.odoo.com/webhooks/own-on-chain`
     - Or: `http://localhost:8069/webhooks/own-on-chain` (if local)
   - **Events**: Select all events:
     - ✅ product.created
     - ✅ product.transferred
     - ✅ product.received
     - ✅ product.burned
   - Click **"Register Webhook"**

4. **Copy the Secret Key**
   - ⚠️ **IMPORTANT**: The secret key is shown **ONLY ONCE**
   - It looks like: `c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6`
   - **Copy it immediately!**
   - Save it somewhere safe (you'll need it)

### Step 2: Add Secret to Odoo

1. **Go to Odoo Settings**
   - Settings → Technical → Parameters → System Parameters

2. **Add Webhook Secret**
   - Click **"Create"**
   - **Key**: `own_on_chain.webhook_secret`
   - **Value**: (paste the secret you copied from Producer Dashboard)
   - Click **"Save"**

## What This Secret Does

The secret is used for **bidirectional verification**:

1. **Own-on-Chain → Odoo**
   - Own-on-Chain signs webhooks with this secret
   - Odoo verifies the signature to ensure it's authentic

2. **Odoo → Own-on-Chain**
   - Odoo signs webhooks with this secret
   - Own-on-Chain verifies the signature

## Summary

✅ **You already added:**
- `own_on_chain.webhook_url` = `http://localhost:3001/api/webhooks/incoming`

✅ **You still need to add:**
- `own_on_chain.webhook_secret` = (get from Producer Dashboard)

## Quick Checklist

- [ ] Register webhook in Producer Dashboard
- [ ] Copy secret key
- [ ] Add `own_on_chain.webhook_secret` to Odoo
- [ ] Test webhook connection

## If You Lost the Secret

If you didn't save the secret:
1. Delete the webhook in Producer Dashboard
2. Register a new webhook
3. Copy the new secret
4. Update Odoo with the new secret

