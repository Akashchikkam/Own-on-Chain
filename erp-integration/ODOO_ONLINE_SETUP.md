# 🔗 Odoo Online Integration Setup

## Enable Developer Mode (Required)

Odoo online hides "Technical" menu by default. Enable it:

### Step 1: Enable Developer Mode

1. **Go to Settings**
   - Click gear icon (⚙️) in top right
   - Or: Click your name → Settings

2. **Activate Developer Mode**
   - Scroll to bottom of Settings page
   - Click **"Activate Developer Mode"** button
   - Confirm if prompted
   - Page will refresh

3. **Verify**
   - After refresh, you should see **"Technical"** menu in Settings
   - If not visible, try refreshing again

### Step 2: Access Technical Menu

1. Go to **Settings** → **Technical**
2. You'll see options like:
   - **Parameters** → **System Parameters**
   - **API** → **External API**
   - **Actions** → **Server Actions**

### Step 3: Configure Webhook (Option A - System Parameters)

1. **Settings** → **Technical** → **Parameters** → **System Parameters**
2. Click **"Create"**
3. Add parameters:
   - **Key**: `own_on_chain.webhook_url`
   - **Value**: `http://localhost:3001/api/webhooks/incoming`
   - Click **"Save"**
   
   - **Key**: `own_on_chain.webhook_secret`
   - **Value**: (get from Producer Dashboard)
   - Click **"Save"**

### Step 4: Alternative - Use Odoo API (Easier for Online)

Odoo online might not support custom webhook endpoints. Use API instead:

1. **Settings** → **Technical** → **API** → **External API**
2. Create API key
3. Use Odoo REST API to:
   - Send products to Own-on-Chain
   - Receive webhooks from Own-on-Chain

## Alternative: Use Odoo REST API

Since Odoo online might not support custom webhooks, use API integration:

### Setup API Integration

1. **Get API Credentials**
   - Settings → Technical → API → External API
   - Create API key
   - Note: Database URL, Username, API Key

2. **Configure Own-on-Chain to Call Odoo API**
   - When product created in Own-on-Chain
   - Call Odoo API to create/update product
   - Use Odoo REST API

3. **Configure Odoo to Send to Own-on-Chain**
   - Use Odoo Automation/Actions
   - When product created in Odoo
   - Send webhook to Own-on-Chain

## Quick Test

1. Enable Developer Mode
2. Check if Technical menu appears
3. If yes → Use System Parameters
4. If no → Use API integration instead

## Troubleshooting

**Can't find "Activate Developer Mode"?**
- Some Odoo online plans don't have it
- Use API integration instead

**Technical menu not showing?**
- Try different browser
- Clear cache
- Use API integration (works on all plans)

## Recommended: API Integration

For Odoo online, **API integration is more reliable** than webhooks:

1. **Own-on-Chain → Odoo**: Use Odoo REST API
2. **Odoo → Own-on-Chain**: Use Odoo Automation + HTTP requests

See `erp-integration/examples/odoo-api-integration.js` for example.

