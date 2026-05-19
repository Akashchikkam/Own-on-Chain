# Real ERP Integration Setup

This guide helps you connect Own-on-Chain to a real ERP system.

## Supported ERP Systems

### 1. Odoo (Recommended for Testing)
- **Type**: Open-source ERP
- **Setup**: Docker or cloud instance
- **API**: REST API with OAuth
- **Best for**: Full-featured testing

### 2. SAP Business One
- **Type**: Enterprise ERP
- **Setup**: Requires license
- **API**: OData/REST API
- **Best for**: Enterprise deployments

### 3. QuickBooks Online
- **Type**: Cloud-based accounting/ERP
- **Setup**: OAuth 2.0 app registration
- **API**: QuickBooks API
- **Best for**: Small business integration

### 4. Custom ERP
- **Type**: Your existing ERP
- **Setup**: Webhook endpoint configuration
- **API**: REST API
- **Best for**: Production integration

## Quick Setup Options

### Option A: Odoo (Docker)
```bash
# Start Odoo with Docker
docker run -d \
  --name odoo \
  -p 8069:8069 \
  -e POSTGRES_HOST=db \
  -e POSTGRES_USER=odoo \
  -e POSTGRES_PASSWORD=odoo \
  -e POSTGRES_DB=postgres \
  library/odoo:latest
```

### Option B: QuickBooks Online
1. Create app at https://developer.intuit.com
2. Get Client ID and Client Secret
3. Configure OAuth flow
4. Use QuickBooks API for product sync

### Option C: Custom ERP Webhook
1. Expose webhook endpoint: `https://your-erp.com/webhooks/own-on-chain`
2. Register in Producer Dashboard
3. Configure webhook secret
4. Test bidirectional sync

## Integration Steps

1. **Configure ERP Webhook Endpoint**
   - URL: Your ERP's webhook receiver
   - Secret: Shared secret for verification
   - Events: product.created, product.transferred, etc.

2. **Register in Own-on-Chain**
   - Go to Producer Dashboard
   - Navigate to Webhooks section
   - Add webhook URL
   - Test connection

3. **Configure ERP to Send Products**
   - Set up ERP webhook sender
   - Point to: `http://localhost:3001/api/webhooks/incoming`
   - Include product data in payload

4. **Test Bidirectional Sync**
   - Create product in ERP → Should appear in Own-on-Chain
   - Approve in Own-on-Chain → Should sync back to ERP
   - Transfer product → Both systems updated

## Testing Checklist

- [ ] ERP webhook endpoint accessible
- [ ] Own-on-Chain can send webhooks to ERP
- [ ] ERP can send products to Own-on-Chain
- [ ] Product approval triggers ERP sync
- [ ] Product transfers update both systems
- [ ] Error handling works correctly

