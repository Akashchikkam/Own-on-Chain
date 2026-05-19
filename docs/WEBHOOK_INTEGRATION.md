# Webhook Integration Guide

This guide explains how to integrate your ERP system with Own-on-Chain using webhooks.

## Overview

Webhooks allow your ERP system to automatically receive notifications when products are created, transferred, received, or burned in the Own-on-Chain system. This enables real-time synchronization between your ERP and the blockchain.

**Status**: ✅ **Fully Implemented** - All webhook events are working and tested.

## Implemented Features

- ✅ Webhook registration UI in Producer Dashboard
- ✅ All 4 webhook events (created, transferred, received, burned)
- ✅ HMAC signature generation and verification
- ✅ Webhook delivery with retry mechanism
- ✅ Delivery logs and statistics
- ✅ Privacy-preserving transfers (only sender gets notified)
- ✅ Test webhook functionality

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

**Privacy Note**: Only the **sender** (person who initiated the transfer) receives this webhook. The producer does NOT get notified when distributors/retailers transfer products to maintain privacy.

```json
{
  "event": "product.transferred",
  "timestamp": "2025-11-13T19:30:00.000Z",
  "data": {
    "tokenId": "123",
    "from": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "to": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "transferType": "toDistributor",
    "productName": "iPhone 15 Pro"
  }
}
```

**Transfer Types**:
- `toDistributor` - Transfer to distributor
- `toRetailer` - Transfer to retailer
- `toBuyer` - Sale to buyer
- `transfer` - Generic transfer

### Product Received Event

**Note**: This event is sent to the **producer** (who created the product) when someone confirms receipt. This allows producers to track when their products are physically received.

```json
{
  "event": "product.received",
  "timestamp": "2025-11-13T20:00:00.000Z",
  "data": {
    "tokenId": "123",
    "confirmedBy": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "signature": "0x...",
    "timestamp": 1734117600,
    "productName": "iPhone 15 Pro"
  }
}
```

### Product Burned Event

**Note**: Only the person who burns the product receives this webhook.

```json
{
  "event": "product.burned",
  "timestamp": "2025-11-13T21:00:00.000Z",
  "data": {
    "tokenId": "123",
    "burnedBy": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "productName": "iPhone 15 Pro",
    "tokenURI": "ipfs://Qm..."
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

## Incoming Webhook (ERP → Own-on-Chain) ✅

You can send webhooks TO Own-on-Chain to trigger product creation requests. Products are queued for producer approval.

### Endpoint

```
POST https://yourapp.com/api/webhooks/incoming
Content-Type: application/json
X-Webhook-Signature: <your-computed-signature>
X-Webhook-Timestamp: <unix-timestamp>
```

### Payload Format

```json
{
  "productName": "iPhone 15 Pro",
  "serialNumber": "SN123456",
  "description": "Latest iPhone model",
  "category": "Electronics",
  "model": "A2848",
  "productType": "physical",
  "warrantyPeriod": 365,
  "manufacturer": {
    "name": "Apple Inc.",
    "address": "1 Apple Park Way",
    "country": "USA",
    "website": "https://apple.com"
  },
  "specifications": {
    "storage": "256GB",
    "color": "Natural Titanium"
  },
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "type": "main"
    }
  ]
}
```

### How It Works

1. **ERP sends webhook** → Own-on-Chain validates signature
2. **Product data validated** → Required fields checked
3. **Request queued** → Stored as pending product creation request
4. **Producer approves** → Product created on blockchain in Producer Dashboard
5. **Outgoing webhook sent** → ERP receives `product.created` notification

### Response

```json
{
  "success": true,
  "message": "Product creation request received and queued",
  "webhookId": "1234567890",
  "pendingProductId": "1763076000000",
  "note": "Product will be created when producer approves the request"
}
```

### Producer Approval Process

1. Producer opens Producer Dashboard
2. Sees "Pending Product Requests" section
3. Reviews product details
4. Clicks "✅ Approve & Create" to create product on blockchain
5. Or clicks "❌ Reject" to discard request

**Note**: Products require producer approval for security. The producer's wallet signature is needed to create products on the blockchain.

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

## Webhook Event Summary

| Event | Who Gets Notified | When It Happens | Privacy |
|-------|------------------|-----------------|---------|
| `product.created` | Producer | Product is created | ✅ Private |
| `product.transferred` | Sender only | Product is transferred | ✅ Private (producer doesn't see distributor/retailer transfers) |
| `product.received` | Producer | Receipt is confirmed | ✅ Private (only producer sees confirmations) |
| `product.burned` | Person who burns | Product is deleted | ✅ Private |

## Implementation Details

### Automatic Webhook Triggers

Webhooks are automatically triggered when:
1. **Product Creation**: After successful product creation in Producer Dashboard
2. **Product Transfer**: After successful transfer (sender gets notified)
3. **Receipt Confirmation**: After recipient confirms physical receipt (producer gets notified)
4. **Product Deletion**: After product is burned/deleted (person who deleted gets notified)

### Privacy Protection

- **Transfer Privacy**: Distributors and retailers can transfer products without the producer seeing every transfer
- **Receipt Tracking**: Producers can track when their products are physically received
- **Individual Notifications**: Each party only receives webhooks for their own actions

---

**Last Updated**: November 14, 2025  
**Implementation Status**: ✅ Complete and Tested

