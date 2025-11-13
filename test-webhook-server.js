// Simple webhook test server
// Run: node test-webhook-server.js
// Then use ngrok to expose it: npx ngrok http 3002

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = 3002;

app.use(express.json());

// Store received webhooks
const receivedWebhooks = [];

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  
  console.log('\n📥 Webhook Received!');
  console.log('Timestamp:', timestamp);
  console.log('Signature:', signature);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  // Store webhook
  receivedWebhooks.push({
    timestamp: new Date().toISOString(),
    signature,
    body: req.body
  });
  
  // Always return success for testing
  res.json({ 
    success: true, 
    message: 'Webhook received successfully',
    receivedAt: new Date().toISOString()
  });
});

// View all received webhooks
app.get('/webhooks', (req, res) => {
  res.json({
    count: receivedWebhooks.length,
    webhooks: receivedWebhooks
  });
});

// Clear webhooks
app.delete('/webhooks', (req, res) => {
  receivedWebhooks.length = 0;
  res.json({ message: 'Webhooks cleared' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Webhook Test Server running on http://localhost:${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`\n📋 To expose publicly, run: npx ngrok http ${PORT}`);
  console.log(`   Then use the ngrok URL in your webhook registration\n`);
});

