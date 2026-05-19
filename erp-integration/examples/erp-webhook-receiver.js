#!/usr/bin/env node

/**
 * ERP Webhook Receiver Example
 * 
 * This shows how to receive and process webhooks from Own-on-Chain in your ERP system.
 * 
 * Usage:
 *   node erp-webhook-receiver.js
 * 
 * Or integrate into your existing ERP system.
 */

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = 3002; // Your ERP webhook endpoint port

// Your webhook secret (from Producer Dashboard)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'YOUR_SECRET_KEY_HERE';

app.use(express.json());

/**
 * Verify webhook signature
 */
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Webhook endpoint - receives notifications from Own-on-Chain
 */
app.post('/webhooks/own-on-chain', (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    if (!signature || !timestamp) {
      console.error('❌ Missing webhook signature or timestamp');
      return res.status(401).json({ error: 'Missing signature or timestamp' });
    }

    // Verify signature
    if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data, timestamp: eventTimestamp } = req.body;

    console.log(`\n📥 Webhook received: ${event}`);
    console.log(`   Timestamp: ${eventTimestamp}`);
    console.log(`   Data:`, JSON.stringify(data, null, 2));

    // Process webhook based on event type
    switch (event) {
      case 'product.created':
        handleProductCreated(data);
        break;
      
      case 'product.transferred':
        handleProductTransferred(data);
        break;
      
      case 'product.received':
        handleProductReceived(data);
        break;
      
      case 'product.burned':
        handleProductBurned(data);
        break;
      
      default:
        console.warn(`⚠️ Unknown event type: ${event}`);
    }

    // Always return 200 OK to acknowledge receipt
    res.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      receivedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle product.created event
 */
function handleProductCreated(data) {
  console.log('✅ Processing: Product Created');
  console.log(`   Token ID: ${data.tokenId}`);
  console.log(`   Product: ${data.productName}`);
  console.log(`   Producer: ${data.producer}`);
  
  // TODO: Update your ERP database
  // - Mark product as created in Own-on-Chain
  // - Store tokenId for future reference
  // - Update product status
  // - Sync metadata if needed
  
  console.log('   → ERP: Product synced to blockchain');
}

/**
 * Handle product.transferred event
 */
function handleProductTransferred(data) {
  console.log('✅ Processing: Product Transferred');
  console.log(`   Token ID: ${data.tokenId}`);
  console.log(`   From: ${data.from}`);
  console.log(`   To: ${data.to}`);
  console.log(`   Type: ${data.transferType}`);
  
  // TODO: Update your ERP database
  // - Update product ownership
  // - Record transfer in transaction log
  // - Update inventory if needed
  
  console.log('   → ERP: Transfer recorded');
}

/**
 * Handle product.received event
 */
function handleProductReceived(data) {
  console.log('✅ Processing: Product Received');
  console.log(`   Token ID: ${data.tokenId}`);
  console.log(`   Confirmed by: ${data.confirmedBy}`);
  console.log(`   Signature: ${data.signature.substring(0, 20)}...`);
  
  // TODO: Update your ERP database
  // - Mark product as physically received
  // - Update delivery status
  // - Record receipt confirmation
  
  console.log('   → ERP: Receipt confirmed');
}

/**
 * Handle product.burned event
 */
function handleProductBurned(data) {
  console.log('✅ Processing: Product Burned');
  console.log(`   Token ID: ${data.tokenId}`);
  console.log(`   Burned by: ${data.burnedBy}`);
  
  // TODO: Update your ERP database
  // - Mark product as deleted/burned
  // - Update inventory
  // - Record deletion reason if available
  
  console.log('   → ERP: Product deleted');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ERP Webhook Receiver' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 ERP Webhook Receiver running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhooks/own-on-chain`);
  console.log(`\n⚠️  Make sure to:`);
  console.log(`   1. Set WEBHOOK_SECRET environment variable`);
  console.log(`   2. Expose this endpoint publicly (use ngrok for testing)`);
  console.log(`   3. Register this URL in Producer Dashboard\n`);
});

