#!/usr/bin/env node

/**
 * ERP Webhook Sender Example
 * 
 * This shows how to send product creation requests from your ERP to Own-on-Chain.
 * 
 * Usage:
 *   node erp-webhook-sender.js
 * 
 * Or integrate into your existing ERP system.
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Configuration
const OWN_ON_CHAIN_URL = process.env.OWN_ON_CHAIN_URL || 'http://localhost:3001';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'YOUR_SECRET_KEY_HERE';

/**
 * Create HMAC-SHA256 signature
 */
function createSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Send product creation request to Own-on-Chain
 */
async function sendProductCreationRequest(productData) {
  const timestamp = Date.now().toString();
  const signature = createSignature(productData, WEBHOOK_SECRET);

  const url = new URL(`${OWN_ON_CHAIN_URL}/api/webhooks/incoming`);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  const postData = JSON.stringify(productData);

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
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
    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            response
          });
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Example: Create a product from ERP
 */
async function createProductFromERP() {
  // Example product data from your ERP system
  const productData = {
    productName: "iPhone 15 Pro Max",
    serialNumber: `SN-${Date.now()}`,
    description: "Latest iPhone model with 256GB storage",
    category: "Electronics",
    model: "A2849",
    productType: "physical",
    warrantyPeriod: 365,
    manufacturer: {
      name: "Apple Inc.",
      address: "1 Apple Park Way",
      country: "USA",
      website: "https://apple.com"
    },
    specifications: {
      storage: "256GB",
      color: "Natural Titanium",
      screenSize: "6.7 inches"
    },
    images: [
      {
        url: "https://example.com/iphone-image.jpg",
        type: "main"
      }
    ]
  };

  console.log('📤 Sending product creation request to Own-on-Chain...');
  console.log(`   Product: ${productData.productName}`);
  console.log(`   Serial: ${productData.serialNumber}`);

  try {
    const result = await sendProductCreationRequest(productData);

    if (result.status === 200 && result.response.success) {
      console.log('\n✅ Product creation request sent successfully!');
      console.log(`   Pending Product ID: ${result.response.pendingProductId}`);
      console.log(`   Webhook ID: ${result.response.webhookId}`);
      console.log('\n📋 Next Steps:');
      console.log('   1. Producer will see this in Producer Dashboard');
      console.log('   2. Producer clicks "✅ Approve & Create"');
      console.log('   3. Product will be created on blockchain');
      console.log('   4. You will receive product.created webhook');
    } else {
      console.error('\n❌ Request failed:');
      console.error(`   Status: ${result.status}`);
      console.error(`   Error: ${result.response.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('\n❌ Error sending request:', error.message);
    console.error('   Make sure:');
    console.error('   - Own-on-Chain backend is running');
    console.error('   - WEBHOOK_SECRET is correct');
    console.error('   - URL is correct');
  }
}

/**
 * Example: Batch create products from ERP
 */
async function batchCreateProducts(products) {
  console.log(`📦 Sending ${products.length} products to Own-on-Chain...\n`);

  const results = [];
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`[${i + 1}/${products.length}] Creating: ${product.productName}`);
    
    try {
      const result = await sendProductCreationRequest(product);
      results.push({
        product: product.productName,
        success: result.status === 200,
        pendingProductId: result.response.pendingProductId
      });
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      results.push({
        product: product.productName,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n📊 Batch Creation Results:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  return results;
}

// Run example
if (require.main === module) {
  if (WEBHOOK_SECRET === 'YOUR_SECRET_KEY_HERE') {
    console.error('❌ Error: WEBHOOK_SECRET not set');
    console.log('\nUsage:');
    console.log('  WEBHOOK_SECRET="your-secret" node erp-webhook-sender.js');
    console.log('\nOr set in .env file:');
    console.log('  WEBHOOK_SECRET=your-secret');
    process.exit(1);
  }

  createProductFromERP()
    .then(() => {
      console.log('\n✅ Example complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Example failed:', error);
      process.exit(1);
    });
}

module.exports = {
  sendProductCreationRequest,
  batchCreateProducts,
  createSignature
};

