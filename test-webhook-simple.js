const crypto = require('crypto');
const http = require('http');

const secret = "c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6";
const walletAddress = "0xfed8e82bb1d254774fc694bc4e60f41fba80c09a";

const productData = {
  productName: "Test Product from ERP - " + Date.now(),
  serialNumber: `SN-TEST-${Date.now()}`,
  description: "This is a test product created via incoming webhook",
  category: "Electronics",
  model: "TEST-MODEL-001",
  productType: "physical",
  warrantyPeriod: 365,
  manufacturer: {
    name: "Test Manufacturer",
    address: "123 Test Street",
    country: "USA"
  }
};

const payload = JSON.stringify(productData);
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
const timestamp = Date.now().toString();

console.log('📤 Sending incoming webhook...');
console.log('   URL: http://localhost:3001/api/webhooks/incoming');
console.log('   Product: ' + productData.productName);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/webhooks/incoming',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('\n✅ Response Status: ' + res.statusCode);
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
      if (response.pendingProductId) {
        console.log('\n📦 Pending Product ID: ' + response.pendingProductId);
        console.log('   → Check Producer Dashboard to approve this product');
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Error: ' + error.message);
  console.error('   Make sure backend is running on port 3001');
});

req.write(payload);
req.end();

