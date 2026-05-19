#!/usr/bin/env node

/**
 * Test script to send incoming webhook to Own-on-Chain
 * 
 * Usage:
 *   node test-incoming-webhook.js <webhook-secret> <producer-wallet-address>
 * 
 * Example:
 *   node test-incoming-webhook.js "your-secret-key" "0xfed8e82bb1d254774fc694bc4e60f41fba80c09a"
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Get command line arguments
const secret = process.argv[2];
const walletAddress = process.argv[3];
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

if (!secret || !walletAddress) {
  console.error('❌ Error: Missing required arguments');
  console.log('\nUsage:');
  console.log('  node test-incoming-webhook.js <webhook-secret> <producer-wallet-address>');
  console.log('\nExample:');
  console.log('  node test-incoming-webhook.js "abc123..." "0xfed8e82bb1d254774fc694bc4e60f41fba80c09a"');
  console.log('\nTo get your webhook secret:');
  console.log('  1. Go to Producer Dashboard');
  console.log('  2. Click "🔗 Webhooks"');
  console.log('  3. Register a webhook (or view existing one)');
  console.log('  4. Copy the secret key shown');
  process.exit(1);
}

// Sample product data
const productData = {
  productName: "Test Product from ERP",
  serialNumber: `SN-TEST-${Date.now()}`,
  description: "This is a test product created via incoming webhook",
  category: "Electronics",
  model: "TEST-MODEL-001",
  productType: "physical",
  warrantyPeriod: 365,
  manufacturer: {
    name: "Test Manufacturer",
    address: "123 Test Street",
    country: "USA",
    website: "https://example.com"
  },
  specifications: {
    color: "Black",
    weight: "500g",
    dimensions: "10x5x2 cm"
  },
  images: [
    {
      url: "https://via.placeholder.com/400",
      type: "main"
    }
  ]
};

// Create signature
function createSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Send webhook
async function sendWebhook() {
  const timestamp = Date.now().toString();
  const signature = createSignature(productData, secret);

  const url = new URL(`${backendUrl}/api/webhooks/incoming`);
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

  console.log('\n📤 Sending incoming webhook...');
  console.log(`   URL: ${url.toString()}`);
  console.log(`   Producer: ${walletAddress}`);
  console.log(`   Product: ${productData.productName}`);
  console.log(`   Serial: ${productData.serialNumber}`);
  console.log(`   Signature: ${signature.substring(0, 20)}...`);

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('\n✅ Webhook sent successfully!');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response:`, JSON.stringify(response, null, 2));
            
            if (response.pendingProductId) {
              console.log(`\n📦 Pending Product ID: ${response.pendingProductId}`);
              console.log('   → Check Producer Dashboard to approve this product');
            }
          } else {
            console.log('\n❌ Webhook failed!');
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response:`, JSON.stringify(response, null, 2));
          }
          
          resolve(response);
        } catch (err) {
          console.error('\n❌ Error parsing response:', err);
          console.log('Raw response:', data);
          reject(err);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run
sendWebhook()
  .then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

