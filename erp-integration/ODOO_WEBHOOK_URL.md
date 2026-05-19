# 🔗 Odoo Webhook Endpoint URL

## What to Enter in Producer Dashboard

When registering a webhook in Producer Dashboard, you need to enter **where Odoo will receive webhooks from Own-on-Chain**.

## The URL Format

```
https://your-odoo-instance.odoo.com/webhooks/own-on-chain
```

### Examples:

- **Odoo Online**: `https://mycompany.odoo.com/webhooks/own-on-chain`
- **Odoo Online (Custom Domain)**: `https://erp.mycompany.com/webhooks/own-on-chain`
- **Local Odoo**: `http://localhost:8069/webhooks/own-on-chain`

## ⚠️ Important: Odoo Needs Webhook Endpoint First

Odoo **doesn't have a webhook endpoint by default**. You need to:

### Option 1: Create Custom Odoo Module (Recommended)

1. **Create Odoo Module** with webhook receiver
2. **Install module** in your Odoo instance
3. **Webhook endpoint** will be: `/webhooks/own-on-chain`
4. **Full URL**: `https://your-odoo.odoo.com/webhooks/own-on-chain`

### Option 2: Use Odoo API Instead

If you can't create a custom module:
- Use Odoo REST API
- Own-on-Chain calls Odoo API directly
- No webhook endpoint needed

### Option 3: Use Test ERP (For Testing)

For quick testing, use our test ERP:
- **URL**: `http://localhost:3002/webhooks/own-on-chain`
- **Already has webhook endpoint**
- **Works immediately**

## How to Find Your Odoo URL

1. **Check your Odoo login page**
   - The URL you use to login is your Odoo instance URL
   - Example: `https://mycompany.odoo.com`

2. **Add webhook path**
   - Append `/webhooks/own-on-chain`
   - Full URL: `https://mycompany.odoo.com/webhooks/own-on-chain`

## Quick Answer

**Enter in Producer Dashboard:**
```
https://your-odoo-instance.odoo.com/webhooks/own-on-chain
```

Replace `your-odoo-instance` with your actual Odoo instance name.

**Example:**
- If your Odoo is: `https://acme-corp.odoo.com`
- Enter: `https://acme-corp.odoo.com/webhooks/own-on-chain`

## ⚠️ But Wait...

If you haven't created the webhook endpoint in Odoo yet, the webhook will fail. You need to:

1. **First**: Create webhook receiver in Odoo (custom module)
2. **Then**: Register webhook in Producer Dashboard with that URL

## Alternative: Test First

Use test ERP to test the flow:
- **URL**: `http://localhost:3002/webhooks/own-on-chain`
- **Start test ERP**: `cd erp-integration/examples && node erp-integration-complete.js`
- **Register this URL** in Producer Dashboard

