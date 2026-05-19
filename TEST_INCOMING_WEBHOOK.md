# 🧪 How to Test Incoming Webhook Product Creation

This guide shows you how to send a test webhook to create a product in Own-on-Chain.

## 📋 Prerequisites

1. **Webhook Registered**: You need to have registered a webhook in Producer Dashboard
2. **Secret Key**: Copy the secret key from your registered webhook
3. **Producer Wallet**: Your producer wallet address
4. **Backend Running**: Make sure backend is running on `http://localhost:3001`

---

## 🚀 Method 1: Using the Test Script (Easiest)

### Step 1: Get Your Webhook Secret

1. Go to **Producer Dashboard**
2. Click **"🔗 Webhooks"** button
3. If you have a webhook, the secret was shown when you registered it
4. If you don't have one, register a new webhook and **copy the secret key**

### Step 2: Run the Test Script

```bash
cd /Users/c.v.akash/Own-on-Chain
node test-incoming-webhook.js "YOUR_SECRET_KEY" "YOUR_WALLET_ADDRESS"
```

**Example:**
```bash
node test-incoming-webhook.js "abc123def456..." "0xfed8e82bb1d254774fc694bc4e60f41fba80c09a"
```

### Step 3: Check Producer Dashboard

1. Go to Producer Dashboard
2. Scroll down to **"📥 Pending Product Requests"** section
3. You should see your test product
4. Click **"✅ Approve & Create"** to create it on blockchain

---

## 🚀 Method 2: Using cURL

### Step 1: Create Signature

First, you need to create an HMAC-SHA256 signature. You can use this command:

```bash
# Replace YOUR_SECRET_KEY with your actual secret
SECRET="YOUR_SECRET_KEY"
PAYLOAD='{"productName":"Test Product","serialNumber":"SN123","description":"Test"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
TIMESTAMP=$(date +%s000)
```

### Step 2: Send Webhook

```bash
curl -X POST http://localhost:3001/api/webhooks/incoming \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -d '{
    "productName": "Test Product from ERP",
    "serialNumber": "SN-TEST-001",
    "description": "This is a test product",
    "category": "Electronics",
    "model": "TEST-MODEL",
    "productType": "physical",
    "warrantyPeriod": 365,
    "manufacturer": {
      "name": "Test Manufacturer",
      "country": "USA"
    }
  }'
```

---

## 🚀 Method 3: Using Postman

### Step 1: Setup Request

1. **Method**: POST
2. **URL**: `http://localhost:3001/api/webhooks/incoming`
3. **Headers**:
   - `Content-Type`: `application/json`
   - `X-Webhook-Signature`: (you'll need to calculate this)
   - `X-Webhook-Timestamp`: (current timestamp in milliseconds)

### Step 2: Create Pre-request Script

In Postman, go to **Pre-request Script** tab and add:

```javascript
// Set your secret key
const secret = "YOUR_SECRET_KEY";

// Get request body
const body = pm.request.body.raw;

// Create signature
const CryptoJS = require('crypto-js');
const signature = CryptoJS.HmacSHA256(body, secret).toString();

// Set headers
pm.request.headers.add({
    key: 'X-Webhook-Signature',
    value: signature
});

pm.request.headers.add({
    key: 'X-Webhook-Timestamp',
    value: Date.now().toString()
});
```

### Step 3: Set Body

In **Body** tab, select **raw** and **JSON**, then paste:

```json
{
  "productName": "Test Product from ERP",
  "serialNumber": "SN-TEST-001",
  "description": "This is a test product",
  "category": "Electronics",
  "model": "TEST-MODEL",
  "productType": "physical",
  "warrantyPeriod": 365,
  "manufacturer": {
    "name": "Test Manufacturer",
    "address": "123 Test Street",
    "country": "USA"
  },
  "specifications": {
    "color": "Black"
  }
}
```

### Step 4: Send Request

Click **Send** and check the response.

---

## 🚀 Method 4: Using Python Script

Create a file `test_incoming_webhook.py`:

```python
import requests
import hmac
import hashlib
import json
import time

# Configuration
SECRET = "YOUR_SECRET_KEY"
BACKEND_URL = "http://localhost:3001"
WALLET_ADDRESS = "YOUR_WALLET_ADDRESS"

# Product data
product_data = {
    "productName": "Test Product from ERP",
    "serialNumber": f"SN-TEST-{int(time.time())}",
    "description": "This is a test product",
    "category": "Electronics",
    "model": "TEST-MODEL",
    "productType": "physical",
    "warrantyPeriod": 365,
    "manufacturer": {
        "name": "Test Manufacturer",
        "country": "USA"
    }
}

# Create signature
payload_json = json.dumps(product_data)
signature = hmac.new(
    SECRET.encode('utf-8'),
    payload_json.encode('utf-8'),
    hashlib.sha256
).hexdigest()

timestamp = str(int(time.time() * 1000))

# Send request
headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp
}

print(f"📤 Sending webhook to {BACKEND_URL}/api/webhooks/incoming")
print(f"   Product: {product_data['productName']}")
print(f"   Serial: {product_data['serialNumber']}")

response = requests.post(
    f"{BACKEND_URL}/api/webhooks/incoming",
    json=product_data,
    headers=headers
)

print(f"\n✅ Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 200:
    data = response.json()
    if 'pendingProductId' in data:
        print(f"\n📦 Pending Product ID: {data['pendingProductId']}")
        print("   → Check Producer Dashboard to approve")
```

Run it:
```bash
python3 test_incoming_webhook.py
```

---

## 📝 Expected Response

### Success Response

```json
{
  "success": true,
  "message": "Product creation request received and queued",
  "webhookId": "1763076000000",
  "pendingProductId": "1763076000123",
  "note": "Product will be created when producer approves the request"
}
```

### Error Responses

**Invalid Signature:**
```json
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

**Missing Fields:**
```json
{
  "success": false,
  "error": "Invalid product data",
  "details": ["productName or name is required"]
}
```

---

## ✅ Complete Test Flow

1. **Send Test Webhook** (using any method above)
2. **Check Response** - Should get `pendingProductId`
3. **Open Producer Dashboard** - Go to your app
4. **Find Pending Products** - Scroll to "Pending Product Requests"
5. **Review Product** - Check product details
6. **Approve Product** - Click "✅ Approve & Create"
7. **Confirm in MetaMask** - Sign the transaction
8. **Product Created** - See success message with Token ID
9. **Check Products List** - Product should appear in your products
10. **Check Webhook Logs** - ERP should receive `product.created` webhook

---

## 🔍 Troubleshooting

### "Invalid webhook signature"
- Check that you're using the correct secret key
- Make sure signature is HMAC-SHA256 of the JSON body
- Verify timestamp is included

### "Missing webhook signature or timestamp"
- Make sure headers `X-Webhook-Signature` and `X-Webhook-Timestamp` are set
- Check header names are correct (case-sensitive)

### "Webhook is not active"
- Go to Webhook Manager
- Make sure your webhook is active (not deactivated)

### "Invalid product data"
- Check that `productName` or `name` field is present
- Verify JSON format is correct

### Pending product not showing
- Make sure you're logged in with the correct producer wallet
- Check that wallet address matches the webhook registration
- Refresh the page

---

## 🎯 Quick Test Command

**Easiest way to test:**

```bash
# 1. Get your secret from Webhook Manager
# 2. Run:
node test-incoming-webhook.js "YOUR_SECRET" "YOUR_WALLET_ADDRESS"
```

That's it! Then check Producer Dashboard for pending products.

---

**Need Help?** Check the webhook logs in Webhook Manager or check backend console for errors.

