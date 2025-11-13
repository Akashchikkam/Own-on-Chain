# 🎓 Webhook Beginner's Guide - Step by Step

**What is a Webhook?**  
Think of it like a doorbell. When something happens (like a product is created), your system "rings the doorbell" (sends a webhook) to your ERP system, and your ERP "answers the door" (receives the notification).

---

## 📋 Step-by-Step Process

### **STEP 1: Get a Webhook URL (2 minutes)**

**What you're doing:** Getting an address where webhooks will be delivered.

1. **Open webhook.site**
   - Go to: https://webhook.site
   - **What happens:** You get a unique URL (like a mailbox address)
   - **Why:** This is where webhooks will be sent

2. **Copy the URL**
   - You'll see something like: `https://webhook.site/ecce2d9f-ca71-4b0f-b7dc-19dbd1b8ab12`
   - **Click the copy button** or select and copy
   - **Keep this page open** - you'll see webhooks appear here

**✅ Checkpoint:** You have a webhook URL copied

---

### **STEP 2: Register Webhook in Your App (3 minutes)**

**What you're doing:** Telling your app where to send notifications.

1. **Go to Producer Dashboard**
   - Make sure you're logged in with your Producer account
   - **Why:** Only producers can register webhooks

2. **Click "🔗 Webhooks" button**
   - Located in the top button row
   - **What happens:** Opens the webhook management panel

3. **Click "+ Register New Webhook"**
   - **What happens:** Opens a form to register your webhook

4. **Paste your webhook.site URL**
   - Paste the URL you copied from Step 1
   - **Example:** `https://webhook.site/ecce2d9f-ca71-4b0f-b7dc-19dbd1b8ab12`
   - **Why:** This tells the app where to send notifications

5. **Select Events (Optional)**
   - Check the events you want to receive:
     - ✅ `product.created` - When you create a product
     - ✅ `product.transferred` - When you transfer a product
     - ✅ `product.received` - When someone confirms receipt
     - ✅ `product.burned` - When a product is deleted
   - **Default:** First two are already selected
   - **Why:** You only get notifications for events you select

6. **Click "Register Webhook"**
   - **What happens:** Your app saves the webhook configuration
   - **IMPORTANT:** A secret key will appear - **COPY IT NOW!**
   - **Why:** This secret key proves the webhook is from your app (security)

7. **Save the Secret Key**
   - Copy the secret key shown
   - Store it safely (you'll need it later for production)
   - **Note:** It won't be shown again!

**✅ Checkpoint:** Webhook is registered, secret key is saved

---

### **STEP 3: Test the Webhook (1 minute)**

**What you're doing:** Making sure the webhook works before using it for real.

1. **In Webhook Manager, find your webhook**
   - You should see your webhook.site URL listed

2. **Click "🧪 Test" button**
   - **What happens:** Sends a test webhook to your URL
   - **Why:** Verifies everything is working

3. **Check webhook.site page**
   - **What you'll see:** A new entry appears
   - **Look for:**
     - ✅ Status: 200 OK (means it worked!)
     - ✅ Headers with `X-Webhook-Signature`
     - ✅ JSON payload with test data

4. **Check Webhook Manager**
   - Delivery count should increase
   - Success count should increase
   - **Why:** Confirms the webhook was delivered successfully

**✅ Checkpoint:** Test webhook received successfully

---

### **STEP 4: Test Real Events (5 minutes)**

**What you're doing:** Seeing webhooks in action with real product events.

#### **Test A: Product Creation Event**

1. **Keep webhook.site page open** (so you can watch)

2. **In Producer Dashboard, create a new product**
   - Click "+ Create Product"
   - Fill in product details (name, description, etc.)
   - Click "Create Product"
   - Confirm in MetaMask

3. **Watch webhook.site**
   - **What happens:** A new webhook appears automatically!
   - **Look for:**
     - Event: `product.created`
     - Data with your product details (tokenId, name, etc.)
   - **Why:** Your app automatically sent a notification

4. **Check the payload**
   - Click on the webhook entry in webhook.site
   - **You'll see:**
     ```json
     {
       "event": "product.created",
       "data": {
         "tokenId": "123",
         "productName": "Your Product Name",
         ...
       }
     }
     ```

**✅ Checkpoint:** Product creation webhook received!

#### **Test B: Product Transfer Event**

1. **Transfer a product**
   - Find a product in your dashboard
   - Click "🔄 Transfer"
   - Enter recipient address
   - Confirm transfer

2. **Watch webhook.site**
   - **What happens:** Another webhook appears!
   - **Look for:**
     - Event: `product.transferred`
     - Data with transfer details (from, to, tokenId)

**✅ Checkpoint:** Transfer webhook received!

---

### **STEP 5: Understand What You're Seeing**

**In webhook.site, you'll see:**

1. **Headers Section**
   - `X-Webhook-Signature`: Security signature (proves it's from your app)
   - `X-Webhook-Timestamp`: When it was sent
   - `Content-Type`: application/json (it's JSON data)

2. **Body/Payload Section**
   - `event`: What happened (product.created, product.transferred, etc.)
   - `timestamp`: When it happened
   - `data`: Details about the event

3. **Status**
   - 200 OK = Success
   - Other codes = Error (check logs)

**Why this matters:** Your ERP system will receive the same data and can process it automatically.

---

### **STEP 6: View Webhook Logs (Optional)**

**What you're doing:** Checking the history of all webhook deliveries.

1. **In Webhook Manager, click "📋 Logs"**
   - **What happens:** Shows delivery history
   - **You'll see:**
     - ✅ Successful deliveries (green)
     - ❌ Failed deliveries (red) - if any
     - Timestamps
     - Response codes

2. **Why this is useful:**
   - Debug issues
   - See delivery success rate
   - Check when webhooks were sent

**✅ Checkpoint:** You can view webhook history

---

## 🎯 Real-World Example

**Scenario:** You create 10 products in your ERP system, and they automatically appear in Own-on-Chain.

**How it works:**

1. **Your ERP creates a product**
   - ERP sends webhook to: `https://yourapp.com/api/webhooks/incoming`
   - **What happens:** Your app receives the webhook
   - **Result:** Product NFT is created automatically

2. **Product is created in Own-on-Chain**
   - **What happens:** Your app sends webhook back to your ERP
   - **Result:** ERP knows the product was successfully created

**This is bidirectional communication!**

---

## 🔒 Security: Signature Verification

**What is it?**  
A way to prove the webhook is really from your app (not a hacker).

**How it works:**

1. **Your app creates a signature**
   - Uses your secret key + webhook data
   - Creates a unique "fingerprint"

2. **Your ERP verifies the signature**
   - Uses the same secret key
   - Checks if signatures match
   - If they match → webhook is authentic ✅
   - If they don't → reject webhook ❌

**Why it matters:** Prevents fake webhooks from hackers.

**You don't need to implement this now** - webhook.site shows you the signature, but doesn't verify it. For production, your ERP will verify it.

---

## 📊 What Events Can You Receive?

| Event | When It Happens | What Data You Get |
|-------|----------------|-------------------|
| `product.created` | New product created | Product name, tokenId, metadata |
| `product.transferred` | Product transferred | From address, to address, tokenId |
| `product.received` | Receipt confirmed | Confirmed by address, signature |
| `product.burned` | Product deleted | Burned by address, tokenId |

**You choose which events to subscribe to** when registering the webhook.

---

## 🐛 Troubleshooting

### **Webhook Not Appearing in webhook.site**

**Check:**
1. ✅ Webhook is **Active** (not deactivated)
2. ✅ URL is correct (copy-paste to avoid typos)
3. ✅ webhook.site page is still open
4. ✅ Check Webhook Manager logs for errors

**Fix:**
- Click "🧪 Test" to verify webhook works
- Check logs in Webhook Manager
- Re-register webhook if needed

### **Webhook Shows Error**

**Check:**
1. ✅ webhook.site URL is still valid (they expire after inactivity)
2. ✅ Check Webhook Manager logs
3. ✅ Try test button again

**Fix:**
- Get a new webhook.site URL
- Re-register webhook with new URL

### **Not Receiving Product Events**

**Check:**
1. ✅ Events are selected when registering (product.created, etc.)
2. ✅ Webhook is Active
3. ✅ You're performing the action (creating/transferring products)

**Fix:**
- Edit webhook to include missing events
- Make sure webhook is active
- Try creating/transferring a product again

---

## 🎓 Key Concepts Summary

1. **Webhook = Notification**
   - When something happens, your app sends a notification

2. **Webhook URL = Address**
   - Where the notification is sent (like a mailbox)

3. **Events = What Happened**
   - product.created, product.transferred, etc.

4. **Payload = Data**
   - The actual information about what happened

5. **Signature = Security**
   - Proves the webhook is authentic

---

## ✅ You're Done!

**What you've learned:**
- ✅ How to register a webhook
- ✅ How to test webhooks
- ✅ How to receive real product events
- ✅ How to view webhook logs

**Next Steps:**
- Use this knowledge to integrate with your real ERP system
- Replace webhook.site URL with your ERP's endpoint
- Implement signature verification in your ERP

**Congratulations! You now understand webhooks! 🎉**

---

## 📞 Quick Reference

**Webhook Manager Location:** Producer Dashboard → 🔗 Webhooks button

**Test Webhook:** Click 🧪 Test button in Webhook Manager

**View Logs:** Click 📋 Logs button on any webhook

**Events Available:**
- `product.created`
- `product.transferred`
- `product.received`
- `product.burned`

---

**Need Help?** Check the logs in Webhook Manager or test the webhook again!

