# Install Own-on-Chain Webhook Module in Odoo

## Step 1: Download Module Files

The module is in: `erp-integration/odoo/own_on_chain_webhook/`

## Step 2: Upload to Odoo Online

### Option A: Via Odoo Apps (If Developer Mode Enabled)

1. **Enable Developer Mode**
   - Settings → Activate Developer Mode

2. **Upload Module**
   - Apps → Update Apps List
   - Click "Upload" or "Install Custom Module"
   - Upload the `own_on_chain_webhook` folder

3. **Install Module**
   - Search for "Own-on-Chain Webhook"
   - Click "Install"

### Option B: Via Odoo Studio (Easier for Online)

1. **Go to Odoo Studio**
   - Apps → Studio

2. **Create Custom Controller**
   - Create new controller
   - Path: `/webhooks/own-on-chain`
   - Method: POST
   - Add the webhook handling code

### Option C: Via Odoo.sh (If You Have Access)

1. **Connect via Git**
2. **Push module files**
3. **Deploy**

## Step 3: Verify Installation

1. **Check if endpoint exists**
   - Try: `https://your-instance.odoo.com/webhooks/own-on-chain`
   - Should return JSON response (even if error)

2. **Check logs**
   - Settings → Technical → Logging
   - Look for webhook-related logs

## Step 4: Test

1. **Register webhook in Producer Dashboard**
   - URL: `https://your-instance.odoo.com/webhooks/own-on-chain`
   - Copy secret

2. **Add secret to Odoo**
   - Settings → Technical → Parameters
   - `own_on_chain.webhook_secret` = (paste secret)

3. **Test webhook**
   - Create product in Own-on-Chain
   - Check Odoo logs for webhook receipt

## Alternative: Manual Installation

If you can't install module, create the endpoint manually via Odoo Studio or custom code.

