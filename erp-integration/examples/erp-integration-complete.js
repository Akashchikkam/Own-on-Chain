#!/usr/bin/env node

/**
 * Complete ERP Integration Example
 * 
 * This demonstrates the full bidirectional integration:
 * 1. ERP sends product → Own-on-Chain creates it
 * 2. Own-on-Chain sends events → ERP receives notifications
 * 
 * This is a complete working example you can adapt for your ERP.
 */

const express = require('express');
const crypto = require('crypto');
const http = require('http');

const app = express();
app.use(express.json());

// Configuration
const OWN_ON_CHAIN_URL = process.env.OWN_ON_CHAIN_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6';
const ERP_PORT = process.env.ERP_PORT || 3002;

// In-memory storage (replace with your ERP database)
const erpProducts = new Map();
const erpTransactions = [];

/**
 * ============================================
 * PART 1: RECEIVE WEBHOOKS FROM OWN-ON-CHAIN
 * ============================================
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

// Webhook endpoint - receives notifications from Own-on-Chain
app.post('/webhooks/own-on-chain', (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'] || req.headers['X-Webhook-Signature'];
    
    if (!signature) {
      console.error('❌ Missing webhook signature');
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, data } = req.body;
    console.log(`\n📥 Received webhook: ${event}`);

    // Process event
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
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function handleProductCreated(data) {
  console.log(`✅ Product created on blockchain: ${data.productName} (Token: ${data.tokenId})`);
  
  // Update ERP database
  erpProducts.set(data.tokenId, {
    ...data,
    status: 'created',
    createdAt: new Date().toISOString()
  });
  
  console.log('   → ERP: Product synced');
}

function handleProductTransferred(data) {
  console.log(`🔄 Product transferred: ${data.tokenId} from ${data.from} to ${data.to}`);
  
  // Update ERP database
  const product = erpProducts.get(data.tokenId);
  if (product) {
    product.currentOwner = data.to;
    product.transferHistory = product.transferHistory || [];
    product.transferHistory.push({
      from: data.from,
      to: data.to,
      timestamp: new Date().toISOString()
    });
  }
  
  erpTransactions.push({
    type: 'transfer',
    tokenId: data.tokenId,
    from: data.from,
    to: data.to,
    timestamp: new Date().toISOString()
  });
  
  console.log('   → ERP: Transfer recorded');
}

function handleProductReceived(data) {
  console.log(`📦 Product received: ${data.tokenId} confirmed by ${data.confirmedBy}`);
  
  // Update ERP database
  const product = erpProducts.get(data.tokenId);
  if (product) {
    product.receiptConfirmed = true;
    product.receiptConfirmedBy = data.confirmedBy;
    product.receiptConfirmedAt = new Date().toISOString();
  }
  
  console.log('   → ERP: Receipt confirmed');
}

function handleProductBurned(data) {
  console.log(`🔥 Product burned: ${data.tokenId}`);
  
  // Update ERP database
  const product = erpProducts.get(data.tokenId);
  if (product) {
    product.status = 'burned';
    product.burnedAt = new Date().toISOString();
  }
  
  console.log('   → ERP: Product deleted');
}

/**
 * ============================================
 * PART 2: SEND PRODUCTS TO OWN-ON-CHAIN
 * ============================================
 */

function createSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

async function sendProductToOwnOnChain(productData) {
  const timestamp = Date.now().toString();
  const signature = createSignature(productData, WEBHOOK_SECRET);

  const url = new URL(`${OWN_ON_CHAIN_URL}/api/webhooks/incoming`);
  const postData = JSON.stringify(productData);

  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': timestamp
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ERP API endpoint - create product (called from your ERP system)
app.post('/api/products/create', async (req, res) => {
  try {
    const productData = req.body;
    
    console.log(`\n📤 Creating product in Own-on-Chain: ${productData.productName}`);
    
    // Send to Own-on-Chain
    const result = await sendProductToOwnOnChain(productData);
    
    if (result.status === 200 && result.data.success) {
      console.log(`✅ Product queued: ${result.data.pendingProductId}`);
      res.json({
        success: true,
        pendingProductId: result.data.pendingProductId,
        message: 'Product creation request sent. Waiting for producer approval.'
      });
    } else {
      throw new Error(result.data.error || 'Failed to send product');
    }
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// ERP API endpoint - get product status
app.get('/api/products/:tokenId', (req, res) => {
  const product = erpProducts.get(req.params.tokenId);
  if (product) {
    res.json({ success: true, data: product });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// ERP API endpoint - list all products
app.get('/api/products', (req, res) => {
  const products = Array.from(erpProducts.values());
  res.json({ success: true, data: products, count: products.length });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'ERP Integration Example',
    products: erpProducts.size,
    transactions: erpTransactions.length
  });
});

// Start ERP server
app.listen(ERP_PORT, () => {
  console.log(`\n🚀 ERP Integration Server running on port ${ERP_PORT}`);
  console.log(`📡 Webhook receiver: http://localhost:${ERP_PORT}/webhooks/own-on-chain`);
  console.log(`📡 Product API: http://localhost:${ERP_PORT}/api/products`);
  console.log(`\n⚠️  Configuration:`);
  console.log(`   OWN_ON_CHAIN_URL: ${OWN_ON_CHAIN_URL}`);
  console.log(`   WEBHOOK_SECRET: ${WEBHOOK_SECRET.substring(0, 20)}...`);
  console.log(`\n📋 Usage:`);
  console.log(`   1. Register webhook in Producer Dashboard:`);
  console.log(`      URL: http://localhost:${ERP_PORT}/webhooks/own-on-chain`);
  console.log(`   2. Create product via API:`);
  console.log(`      POST http://localhost:${ERP_PORT}/api/products/create`);
  console.log(`   3. Check products:`);
  console.log(`      GET http://localhost:${ERP_PORT}/api/products\n`);
});

