# 🔗 Complete ERP Integration Guide

Step-by-step guide to integrate your ERP system with Own-on-Chain.

---

## 📋 Prerequisites

- Own-on-Chain backend running on `http://localhost:3001`
- Producer account with webhook registered
- Webhook secret key (from Producer Dashboard)
- Your ERP system or test server

---

## 🚀 Step 1: Register Webhook in Own-on-Chain

1. **Go to Producer Dashboard**
   - Open http://localhost:5173
   - Connect your producer wallet
   - Click "🔗 Webhooks"

2. **Register Webhook**
   - Click "+ Register New Webhook"
   - Enter your ERP endpoint URL (e.g., `http://your-erp.com/webhooks/own-on-chain`)
   - Select events: `product.created`, `product.transferred`, `product.received`, `product.burned`
   - Click "Register"

3. **Save Secret Key**
   - Copy the secret key shown
   - Store it securely (you'll need it for signature verification)

---

## 📥 Step 2: Configure ERP to Receive Webhooks

### Option A: Use Example Receiver

```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="your-secret-key" node erp-webhook-receiver.js
```

### Option B: Integrate into Your ERP

1. **Create Webhook Endpoint**
   - Endpoint: `POST /webhooks/own-on-chain`
   - Verify HMAC-SHA256 signature
   - Process events

2. **See `erp-webhook-receiver.js`** for complete example

---

## 📤 Step 3: Configure ERP to Send Products

### Option A: Use Example Sender

```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="your-secret-key" OWN_ON_CHAIN_URL="http://localhost:3001" node erp-webhook-sender.js
```

### Option B: Integrate into Your ERP

1. **When creating product in ERP:**
   - Send webhook to Own-on-Chain
   - Include product data
   - Sign with HMAC-SHA256

2. **See `erp-webhook-sender.js`** for complete example

---

## 🔄 Step 4: Complete Integration Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETE INTEGRATION FLOW                 │
└─────────────────────────────────────────────────────────────┘

1. ERP Creates Product
   └─> Send webhook to Own-on-Chain
       └─> Product queued for approval

2. Producer Approves
   └─> Product created on blockchain
       └─> Own-on-Chain sends product.created webhook
           └─> ERP receives notification
               └─> ERP updates database

3. Product Transferred
   └─> Own-on-Chain sends product.transferred webhook
       └─> ERP receives notification
           └─> ERP updates ownership

4. Receipt Confirmed
   └─> Own-on-Chain sends product.received webhook
       └─> ERP receives notification
           └─> ERP marks as received
```

---

## 🧪 Step 5: Test Complete Integration

### Test Script

```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="your-secret" node erp-integration-complete.js
```

This starts a complete ERP server that:
- Receives webhooks from Own-on-Chain
- Sends products to Own-on-Chain
- Maintains product database
- Shows full bidirectional sync

---

## 📊 Step 6: Monitor Integration

### Check Webhook Logs

1. Go to Producer Dashboard
2. Click "🔗 Webhooks"
3. Click "📋 Logs" on your webhook
4. View delivery history

### Check ERP Logs

Your ERP should log:
- ✅ Webhooks received
- ✅ Products sent
- ✅ Events processed

---

## 🔒 Security Checklist

- [ ] Webhook secret stored securely (environment variable)
- [ ] All webhooks verify HMAC signatures
- [ ] Using HTTPS for production endpoints
- [ ] Rate limiting implemented
- [ ] Error handling in place
- [ ] Logging enabled

---

## 🐛 Troubleshooting

### Webhooks Not Received

1. Check webhook is **Active** in Producer Dashboard
2. Verify endpoint URL is correct and accessible
3. Check firewall/network settings
4. View webhook logs for errors

### Signature Verification Failing

1. Ensure using correct secret key
2. Hash entire JSON body (not just parts)
3. Check for whitespace/encoding issues
4. Verify using HMAC-SHA256

### Products Not Creating

1. Check pending products in Producer Dashboard
2. Verify producer approved the request
3. Check blockchain transaction status
4. View backend logs for errors

---

## 📚 Next Steps

1. **Production Deployment**
   - Use HTTPS endpoints
   - Set up monitoring
   - Implement retry logic
   - Add error alerts

2. **Advanced Features**
   - Batch product creation
   - Custom payload formats
   - Webhook filtering
   - Analytics dashboard

---

**Status**: ✅ **Ready for Production**

