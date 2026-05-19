# 🔗 ERP Integration Package

Complete bidirectional integration between your ERP system and Own-on-Chain.

## ✅ What's Included

1. **Incoming Webhooks** - ERP can create products in Own-on-Chain
2. **Outgoing Webhooks** - Own-on-Chain sends notifications to ERP
3. **Integration Examples** - Ready-to-use code samples
4. **Helper Libraries** - Simplify integration

---

## 📤 Outgoing Webhooks (Own-on-Chain → ERP)

Your ERP receives real-time notifications when events occur.

### Events You Can Receive

| Event | Description | When It Happens |
|-------|-------------|-----------------|
| `product.created` | New product created | Product minted on blockchain |
| `product.transferred` | Product transferred | Ownership changes |
| `product.received` | Receipt confirmed | Physical receipt confirmed |
| `product.burned` | Product deleted | Product burned/deleted |

### Setup

1. **Register Webhook** in Producer Dashboard
2. **Copy Secret Key** (save it securely)
3. **Configure Your ERP** to receive webhooks
4. **Verify Signatures** for security

### Example: Receive Webhook in Your ERP

See `examples/erp-webhook-receiver.js` for complete example.

---

## 📥 Incoming Webhooks (ERP → Own-on-Chain)

Your ERP can create products automatically in Own-on-Chain.

### How It Works

1. **ERP sends webhook** → Own-on-Chain validates and queues
2. **Producer approves** → Product created on blockchain
3. **Outgoing webhook sent** → ERP receives confirmation

### Setup

1. **Get Webhook Secret** from Producer Dashboard
2. **Configure ERP** to send webhooks
3. **Send product data** to `/api/webhooks/incoming`
4. **Producer approves** in dashboard

### Example: Send Webhook from Your ERP

See `examples/erp-webhook-sender.js` for complete example.

---

## 🚀 Quick Start

### Step 1: Register Webhook

1. Go to Producer Dashboard
2. Click "🔗 Webhooks"
3. Register your ERP endpoint URL
4. **Save the secret key!**

### Step 2: Configure Your ERP

Use the examples in `examples/` folder:
- `erp-webhook-receiver.js` - Receive notifications
- `erp-webhook-sender.js` - Send product creation requests

### Step 3: Test Integration

```bash
# Test sending product from ERP
node examples/erp-webhook-sender.js

# Test receiving notifications
# (Check your ERP webhook endpoint)
```

---

## 📚 Documentation

- **Integration Guide**: `../docs/WEBHOOK_INTEGRATION.md`
- **API Reference**: See examples folder
- **Testing Guide**: `../TEST_INCOMING_WEBHOOK.md`

---

## 🔒 Security

- **HMAC-SHA256 Signatures** - All webhooks are signed
- **Secret Key Management** - Store secrets securely
- **Signature Verification** - Always verify incoming webhooks
- **HTTPS Required** - Use HTTPS for all webhook endpoints

---

## 🎯 Complete Integration Flow

```
┌─────────────┐                    ┌──────────────┐
│   Your ERP  │                    │ Own-on-Chain │
└──────┬──────┘                    └──────┬───────┘
       │                                   │
       │  1. Send Product Data            │
       │─────────────────────────────────>│
       │                                   │
       │                                   │ 2. Queue for Approval
       │                                   │
       │  3. product.created notification  │
       │<─────────────────────────────────│
       │                                   │
       │  4. product.transferred           │
       │<─────────────────────────────────│
       │                                   │
       │  5. product.received               │
       │<─────────────────────────────────│
```

---

**Status**: ✅ **Production Ready**

