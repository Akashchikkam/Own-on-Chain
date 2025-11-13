# Webhook Testing Guide

Quick guide to test webhooks without a full ERP system.

## 🚀 Quick Testing Options

### Option 1: Webhook.site (Easiest - No Setup Required)

**Best for:** Quick testing, viewing webhook payloads

1. Go to https://webhook.site
2. Copy the unique URL (e.g., `https://webhook.site/abc123-def456`)
3. In Producer Dashboard → Webhooks → Register New Webhook
4. Paste the webhook.site URL
5. Click "Register Webhook"
6. **View incoming webhooks in real-time on webhook.site!**

**Pros:**
- ✅ No setup required
- ✅ View webhooks instantly
- ✅ See headers, body, timestamps
- ✅ Free

**Cons:**
- ❌ Can't verify signatures (but you can see them)
- ❌ URL expires after inactivity

---

### Option 2: ngrok + Local Server (Best for Development)

**Best for:** Testing signature verification, custom logic

#### Step 1: Start Local Webhook Server

**Node.js:**
```bash
cd /Users/c.v.akash/Own-on-Chain
node test-webhook-server.js
```

**Python:**
```bash
cd /Users/c.v.akash/Own-on-Chain
python3 test-webhook-server.py
```

Server runs on `http://localhost:3002`

#### Step 2: Expose with ngrok

```bash
# Install ngrok (if not installed)
# macOS: brew install ngrok
# Or download from: https://ngrok.com/download

# Expose local server
npx ngrok http 3002
```

You'll get a public URL like: `https://abc123.ngrok.io`

#### Step 3: Register Webhook

1. In Producer Dashboard → Webhooks
2. Register webhook with URL: `https://abc123.ngrok.io/webhook`
3. Save the secret key
4. Test webhook delivery

**Pros:**
- ✅ Full control over webhook handling
- ✅ Can verify signatures
- ✅ Test custom logic
- ✅ See logs in terminal

**Cons:**
- ⚠️ Requires ngrok setup
- ⚠️ Free ngrok URLs change on restart

---

### Option 3: Postman Mock Server

**Best for:** API testing, automated tests

1. Create Postman account (free)
2. Create a new Mock Server
3. Set up POST endpoint: `/webhook`
4. Use the mock server URL in webhook registration
5. View requests in Postman

**Pros:**
- ✅ Professional tool
- ✅ Can save/export requests
- ✅ Good for documentation

**Cons:**
- ⚠️ Requires Postman account
- ⚠️ More setup than webhook.site

---

### Option 4: RequestBin / Pipedream

**RequestBin:**
- Go to https://requestbin.com
- Create a bin
- Use the bin URL as webhook endpoint
- View requests in real-time

**Pipedream:**
- Go to https://pipedream.com
- Create a webhook source
- Get webhook URL
- View/process webhooks in Pipedream UI

---

## 🧪 Testing Webhook Signature Verification

If you want to test signature verification (recommended for production), use the local server with ngrok:

### Node.js Example

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
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = 'YOUR_SECRET_KEY'; // From webhook registration
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  console.log('Valid webhook:', req.body);
  res.json({ success: true });
});
```

---

## 📝 Step-by-Step Testing

### Test 1: Basic Webhook Delivery

1. **Register webhook** using webhook.site URL
2. **Click "🧪 Test"** button in Webhook Manager
3. **Check webhook.site** - you should see the test payload
4. **Check Webhook Manager logs** - should show "Success"

### Test 2: Product Creation Event

1. **Register webhook** (if not already done)
2. **Create a new product** in Producer Dashboard
3. **Check webhook.site** - should receive `product.created` event
4. **Verify payload** contains product details

### Test 3: Product Transfer Event

1. **Transfer a product** to another address
2. **Check webhook.site** - should receive `product.transferred` event
3. **Verify payload** contains transfer details

### Test 4: Signature Verification

1. **Use local server + ngrok** (Option 2)
2. **Add signature verification** to your server
3. **Test webhook delivery** - should verify correctly
4. **Try invalid signature** - should reject

---

## 🔍 What to Check

When testing, verify:

- ✅ **Webhook is delivered** (check webhook.site or server logs)
- ✅ **Payload format** matches documentation
- ✅ **Headers** include `X-Webhook-Signature` and `X-Webhook-Timestamp`
- ✅ **Events** match what you subscribed to
- ✅ **Timestamps** are recent
- ✅ **Signature verification** works (if implemented)

---

## 🐛 Troubleshooting

### Webhook Not Received

1. **Check webhook is Active** (not deactivated)
2. **Verify URL is correct** and accessible
3. **Check firewall/network** settings
4. **View logs** in Webhook Manager
5. **Test webhook** using test button

### Signature Verification Failing

1. **Ensure you're using correct secret key**
2. **Hash entire JSON body** (not just parts)
3. **Check for whitespace/encoding issues**
4. **Use HMAC-SHA256** algorithm

### Timeout Errors

1. **Ensure endpoint responds within 10 seconds**
2. **Check server is running** and accessible
3. **Verify ngrok tunnel** is active (if using)

---

## 🎯 Recommended Testing Flow

1. **Start with webhook.site** - Quick validation
2. **Move to ngrok + local server** - Test signature verification
3. **Test all event types** - created, transferred, received, burned
4. **Test error scenarios** - invalid signatures, timeouts
5. **Check delivery logs** - Verify success rates

---

## 📚 Next Steps

Once webhooks are working:

1. **Implement in your ERP** using the signature verification code
2. **Handle all event types** your ERP needs
3. **Add error handling** and retry logic
4. **Monitor webhook delivery** in Webhook Manager
5. **Set up alerts** for failed deliveries

---

**Quick Start Command:**

```bash
# Terminal 1: Start webhook server
node test-webhook-server.js

# Terminal 2: Expose with ngrok
npx ngrok http 3002

# Then use the ngrok URL in webhook registration!
```

