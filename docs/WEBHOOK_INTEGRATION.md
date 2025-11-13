# Webhook Integration Guide

This guide explains how to integrate your ERP system with Own-on-Chain using webhooks.

## Overview

Webhooks allow your ERP system to automatically receive notifications when products are created, transferred, or updated in the Own-on-Chain system. This enables real-time synchronization between your ERP and the blockchain.

## How It Works

1. **Register Webhook**: Producer registers their ERP endpoint URL in the Producer Dashboard
2. **Receive Secret Key**: System generates a unique secret key for authentication
3. **Receive Notifications**: When events occur, your ERP receives POST requests with event data
4. **Verify Signature**: Your ERP verifies the webhook signature to ensure authenticity

## Registration

### Step 1: Register Webhook in Producer Dashboard

1. Go to Producer Dashboard
2. Click "🔗 Webhooks" button
3. Click "+ Register New Webhook"
4. Enter your ERP endpoint URL (e.g., `https://your-erp.com/webhooks/own-on-chain`)
5. Select events to subscribe to:
   - `product.created` - When a new product is created
   - `product.transferred` - When a product is transferred
   - `product.received` - When a product receipt is confirmed
   - `product.burned` - When a product is deleted/burned
6. Click "Register Webhook"
7. **IMPORTANT**: Save the secret key shown - it will not be displayed again!

### Step 2: Configure Your ERP Endpoint

Your ERP system needs to expose an HTTP endpoint that accepts POST requests:

```
POST https://your-erp.com/webhooks/own-on-chain
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-signature>
X-Webhook-Timestamp: <unix-timestamp>
```

## Webhook Payload Format

### Product Created Event

```json
{
  "event": "product.created",
  "timestamp": "2025-11-13T19:00:00.000Z",
  "data": {
    "tokenId": "123",
    "productName": "iPhone 15 Pro",
    "serialNumber": "SN123456",
    "productId": "PROD-001",
    "producer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "metadata": {
      "name": "iPhone 15 Pro",
      "description": "Latest iPhone model",
      "category": "Electronics",
      "model": "A2848",
      "warrantyPeriod": 365
    },
    "tokenURI": "ipfs://Qm..."
  }
}
```

### Product Transferred Event

```json
{
  "event": "product.transferred",
  "timestamp": "2025-11-13T19:30:00.000Z",
  "data": {
    "tokenId": "123",
    "from": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "to": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "transferType": "toDistributor",
    "timestamp": 1734115800
  }
}
```

### Product Received Event

```json
{
  "event": "product.received",
  "timestamp": "2025-11-13T20:00:00.000Z",
  "data": {
    "tokenId": "123",
    "confirmedBy": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "signature": "0x...",
    "timestamp": 1734117600
  }
}
```

### Product Burned Event

```json
{
  "event": "product.burned",
  "timestamp": "2025-11-13T21:00:00.000Z",
  "data": {
    "tokenId": "123",
    "burnedBy": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "timestamp": 1734120000
  }
}
```

## Signature Verification

All webhook requests include an HMAC-SHA256 signature in the `X-Webhook-Signature` header. You must verify this signature to ensure the request is authentic.

### Verification Process

1. Extract the signature from `X-Webhook-Signature` header
2. Create HMAC-SHA256 hash of the request body using your secret key
3. Compare the computed signature with the provided signature
4. If they match, the webhook is authentic

### Example Code (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook endpoint
app.post('/webhooks/own-on-chain', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET; // Your saved secret key
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  const { event, data } = req.body;
  
  switch (event) {
    case 'product.created':
      // Handle product creation
      break;
    case 'product.transferred':
      // Handle product transfer
      break;
    // ... other events
  }
  
  res.json({ success: true });
});
```

### Example Code (Python)

```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload, sort_keys=True).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)

# In your webhook endpoint
@app.route('/webhooks/own-on-chain', methods=['POST'])
def webhook_handler():
    signature = request.headers.get('X-Webhook-Signature')
    secret = os.environ.get('WEBHOOK_SECRET')
    
    if not verify_webhook_signature(request.json, signature, secret):
        return jsonify({'error': 'Invalid signature'}), 401
    
    event = request.json.get('event')
    data = request.json.get('data')
    
    # Process webhook based on event type
    if event == 'product.created':
        # Handle product creation
        pass
    
    return jsonify({'success': True})
```

## Response Requirements

Your webhook endpoint should:

1. **Return 200 OK** within 10 seconds for successful processing
2. **Return 4xx/5xx** for errors (will trigger retry)
3. **Be idempotent** - handle duplicate deliveries gracefully

### Response Format

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

## Retry Mechanism

If your endpoint returns an error or times out, the system will automatically retry:

- **Max Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 10 seconds per attempt

## Testing Webhooks

### Test from Producer Dashboard

1. Go to Webhook Manager
2. Click "🧪 Test" button on any webhook
3. A test payload will be sent to your endpoint
4. Check the delivery logs to see the result

### Test Payload

```json
{
  "event": "webhook.test",
  "timestamp": "2025-11-13T19:00:00.000Z",
  "data": {
    "message": "This is a test webhook from Own-on-Chain",
    "webhookId": "1234567890"
  }
}
```

## Incoming Webhook (ERP → Own-on-Chain)

You can also send webhooks TO Own-on-Chain to trigger product creation:

```
POST https://yourapp.com/api/webhooks/incoming
Content-Type: application/json
X-Webhook-Signature: <your-computed-signature>
X-Webhook-Timestamp: <unix-timestamp>

{
  "productName": "iPhone 15 Pro",
  "serialNumber": "SN123456",
  "productId": "PROD-001",
  "category": "Electronics",
  "model": "A2848",
  "warrantyPeriod": 365,
  "metadata": {
    "description": "Latest iPhone model",
    "manufacturer": {
      "name": "Apple Inc.",
      "address": "1 Apple Park Way",
      "country": "USA"
    }
  }
}
```

**Note**: This feature requires additional implementation to process incoming webhooks and create products. Currently, the endpoint validates signatures but doesn't create products automatically.

## Security Best Practices

1. **Always verify signatures** - Never trust webhooks without signature verification
2. **Use HTTPS** - Always use HTTPS endpoints for webhooks
3. **Store secrets securely** - Never commit secret keys to version control
4. **Implement rate limiting** - Protect your endpoint from abuse
5. **Log all webhooks** - Keep audit logs of all received webhooks
6. **Handle errors gracefully** - Return appropriate HTTP status codes

## Monitoring & Logs

### View Delivery Logs

1. Go to Webhook Manager in Producer Dashboard
2. Click "📋 Logs" on any webhook
3. View delivery history, success/failure rates, and error messages

### Webhook Statistics

Each webhook shows:
- Total deliveries
- Success count
- Failure count
- Last triggered timestamp

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook is **Active** (not deactivated)
2. Verify endpoint URL is correct and accessible
3. Check firewall/network settings
4. View logs in Webhook Manager

### Signature Verification Failing

1. Ensure you're using the correct secret key
2. Verify you're hashing the entire JSON body (not just parts)
3. Check for whitespace/encoding issues
4. Ensure you're using HMAC-SHA256

### Timeout Errors

1. Ensure your endpoint responds within 10 seconds
2. Optimize your webhook processing logic
3. Consider async processing for heavy operations

## API Endpoints Reference

### Register Webhook
```
POST /api/webhooks/register
Body: { url, walletAddress, events[] }
```

### List Webhooks
```
GET /api/webhooks/list?walletAddress=<address>
```

### Get Webhook Details
```
GET /api/webhooks/:id?walletAddress=<address>
```

### Delete Webhook
```
DELETE /api/webhooks/:id?walletAddress=<address>
```

### Toggle Webhook
```
PUT /api/webhooks/:id/toggle
Body: { walletAddress }
```

### Test Webhook
```
POST /api/webhooks/:id/test
Body: { walletAddress }
```

### Get Webhook Logs
```
GET /api/webhooks/:id/logs?walletAddress=<address>&limit=50
```

### Incoming Webhook (ERP → Own-on-Chain)
```
POST /api/webhooks/incoming
Headers: X-Webhook-Signature, X-Webhook-Timestamp
Body: { product data }
```

## Support

For issues or questions:
1. Check webhook logs in Producer Dashboard
2. Test webhook delivery using the test button
3. Verify your endpoint is accessible and responding correctly
4. Check signature verification implementation

---

**Last Updated**: November 13, 2025

