import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateWebhookSecret, verifyWebhookSignature, deliverWebhook, retryWebhookDelivery } from './webhook-service.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const WEBHOOKS_FILE = path.join(DATA_DIR, 'webhooks.json');
const WEBHOOK_LOGS_FILE = path.join(DATA_DIR, 'webhook-logs.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

// Read webhooks from file
async function readWebhooks() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(WEBHOOKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading webhooks file:', error);
    throw error;
  }
}

// Write webhooks to file
async function writeWebhooks(webhooks) {
  try {
    await ensureDataDir();
    await fs.writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing webhooks file:', error);
    throw error;
  }
}

// Read webhook logs
async function readWebhookLogs() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(WEBHOOK_LOGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading webhook logs file:', error);
    throw error;
  }
}

// Write webhook logs
async function writeWebhookLogs(logs) {
  try {
    await ensureDataDir();
    await fs.writeFile(WEBHOOK_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing webhook logs file:', error);
    throw error;
  }
}

// Add log entry
async function addWebhookLog(webhookId, event, payload, result) {
  try {
    const logs = await readWebhookLogs();
    logs.push({
      id: Date.now().toString(),
      webhookId,
      event,
      payload,
      result,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 logs per webhook
    const webhookLogs = logs.filter(log => log.webhookId === webhookId);
    if (webhookLogs.length > 1000) {
      const toKeep = webhookLogs.slice(-1000);
      const otherLogs = logs.filter(log => log.webhookId !== webhookId);
      await writeWebhookLogs([...otherLogs, ...toKeep]);
    } else {
      await writeWebhookLogs(logs);
    }
  } catch (error) {
    console.error('Error adding webhook log:', error);
  }
}

// POST /api/webhooks/register - Register a new webhook
router.post('/register', async (req, res) => {
  try {
    const { url, walletAddress, events = ['product.created', 'product.transferred'] } = req.body;

    if (!url || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'URL and wallet address are required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Validate events array
    const validEvents = ['product.created', 'product.transferred', 'product.received', 'product.burned'];
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${validEvents.join(', ')}`
      });
    }

    const webhooks = await readWebhooks();
    
    // Check for duplicate URL for same wallet
    const existing = webhooks.find(
      w => w.url === url && w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Webhook with this URL already exists for this wallet'
      });
    }

    const secret = generateWebhookSecret();
    const newWebhook = {
      id: Date.now().toString(),
      url,
      walletAddress: walletAddress.toLowerCase(),
      secret,
      events,
      active: true,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      deliveryCount: 0,
      successCount: 0,
      failureCount: 0
    };

    webhooks.push(newWebhook);
    await writeWebhooks(webhooks);

    console.log(`✅ Webhook registered: ${newWebhook.id} for ${walletAddress}`);

    // Return webhook without secret (security)
    const { secret: _, ...webhookResponse } = newWebhook;
    
    res.status(201).json({
      success: true,
      data: webhookResponse,
      message: 'Webhook registered successfully. Save your secret key - it will not be shown again!',
      secret // Show secret only once during registration
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register webhook'
    });
  }
});

// GET /api/webhooks/list - List webhooks for a wallet
router.get('/list', async (req, res) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const webhooks = await readWebhooks();
    const userWebhooks = webhooks
      .filter(w => w.walletAddress.toLowerCase() === walletAddress.toLowerCase())
      .map(({ secret, ...webhook }) => webhook); // Remove secret from response

    res.json({
      success: true,
      data: userWebhooks
    });
  } catch (error) {
    console.error('Error listing webhooks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list webhooks'
    });
  }
});

// GET /api/webhooks/pending-products - Get pending product creation requests
// IMPORTANT: This must come BEFORE /:id route to avoid route conflict
router.get('/pending-products', async (req, res) => {
  try {
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const { getPendingProducts } = await import('./incoming-product-service.js');
    const pendingProducts = await getPendingProducts(walletAddress);

    res.json({
      success: true,
      data: pendingProducts,
      count: pendingProducts.length
    });
  } catch (error) {
    console.error('Error getting pending products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending products'
    });
  }
});

// POST /api/webhooks/pending-products/:id/process - Process a pending product (called from frontend)
// IMPORTANT: This must come BEFORE /:id routes to avoid route conflict
router.post('/pending-products/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress, tokenId, txHash } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    // Update pending product status
    const { updatePendingProduct, getPendingProductById } = await import('./incoming-product-service.js');
    const pendingProduct = await getPendingProductById(id);

    if (!pendingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Pending product not found'
      });
    }

    if (pendingProduct.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: This product belongs to a different wallet'
      });
    }

    // Update status
    const updated = await updatePendingProduct(id, {
      status: 'completed',
      processedAt: new Date().toISOString(),
      tokenId: tokenId || null,
      txHash: txHash || null
    });

    res.json({
      success: true,
      data: updated,
      message: 'Product creation request marked as completed'
    });
  } catch (error) {
    console.error('Error processing pending product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process pending product'
    });
  }
});

// DELETE /api/webhooks/pending-products/:id - Delete/reject a pending product
// IMPORTANT: This must come BEFORE /:id routes to avoid route conflict
router.delete('/pending-products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const { updatePendingProduct, getAllPendingProducts } = await import('./incoming-product-service.js');
    const allPending = await getAllPendingProducts();
    const pendingProduct = allPending.find(p => p.id === id);

    if (!pendingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Pending product not found'
      });
    }

    if (pendingProduct.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    await updatePendingProduct(id, {
      status: 'rejected',
      processedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Pending product request rejected'
    });
  } catch (error) {
    console.error('Error deleting pending product:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete pending product'
    });
  }
});

// GET /api/webhooks/:id - Get webhook details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const webhooks = await readWebhooks();
    const webhook = webhooks.find(
      w => w.id === id && w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    const { secret, ...webhookResponse } = webhook;
    res.json({
      success: true,
      data: webhookResponse
    });
  } catch (error) {
    console.error('Error getting webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get webhook'
    });
  }
});

// DELETE /api/webhooks/:id - Delete webhook
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const webhooks = await readWebhooks();
    const index = webhooks.findIndex(
      w => w.id === id && w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    webhooks.splice(index, 1);
    await writeWebhooks(webhooks);

    console.log(`🗑️ Webhook deleted: ${id}`);

    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete webhook'
    });
  }
});

// PUT /api/webhooks/:id/toggle - Toggle webhook active status
router.put('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const webhooks = await readWebhooks();
    const webhook = webhooks.find(
      w => w.id === id && w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    webhook.active = !webhook.active;
    await writeWebhooks(webhooks);

    res.json({
      success: true,
      data: { active: webhook.active },
      message: `Webhook ${webhook.active ? 'activated' : 'deactivated'}`
    });
  } catch (error) {
    console.error('Error toggling webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle webhook'
    });
  }
});

// POST /api/webhooks/:id/test - Test webhook delivery
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const webhooks = await readWebhooks();
    const webhook = webhooks.find(
      w => w.id === id && w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    if (!webhook.active) {
      return res.status(400).json({
        success: false,
        error: 'Webhook is not active'
      });
    }

    // Send test payload
    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Own-on-Chain',
        webhookId: webhook.id
      }
    };

    const result = await deliverWebhook(webhook.url, testPayload, webhook.secret);
    
    // Update webhook stats
    webhook.lastTriggered = new Date().toISOString();
    webhook.deliveryCount++;
    if (result.success) {
      webhook.successCount++;
    } else {
      webhook.failureCount++;
    }
    await writeWebhooks(webhooks);

    // Log the test
    await addWebhookLog(webhook.id, 'webhook.test', testPayload, result);

    res.json({
      success: true,
      data: result,
      message: result.success ? 'Test webhook delivered successfully' : 'Test webhook delivery failed'
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test webhook'
    });
  }
});

// GET /api/webhooks/:id/logs - Get webhook delivery logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress, limit = 50 } = req.query;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    // Verify webhook belongs to wallet
    const webhooks = await readWebhooks();
    const webhook = webhooks.find(
      w => w.id === id && w.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Webhook not found'
      });
    }

    const logs = await readWebhookLogs();
    const webhookLogs = logs
      .filter(log => log.webhookId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: webhookLogs
    });
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get webhook logs'
    });
  }
});

// POST /api/webhooks/incoming - Incoming webhook endpoint (for ERP systems to trigger product creation)
router.post('/incoming', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const payload = req.body;

    // Validate signature
    if (!signature || !timestamp) {
      return res.status(401).json({
        success: false,
        error: 'Missing webhook signature or timestamp'
      });
    }

    // Find webhook by signature (we'll need to check all webhooks)
    // In production, you might want to include webhook ID in headers
    const webhooks = await readWebhooks();
    let webhook = null;
    let isValid = false;

    // Try to find matching webhook by verifying signature
    for (const w of webhooks) {
      if (verifyWebhookSignature(payload, signature, w.secret)) {
        webhook = w;
        isValid = true;
        break;
      }
    }

    if (!isValid || !webhook) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    if (!webhook.active) {
      return res.status(400).json({
        success: false,
        error: 'Webhook is not active'
      });
    }

    // Process the incoming webhook - create product creation request
    console.log(`📥 Incoming webhook from ${webhook.url}:`, payload);

    // Validate product data
    const { validateProductData, storePendingProduct } = await import('./incoming-product-service.js');
    const validation = validateProductData(payload);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product data',
        details: validation.errors
      });
    }

    // Store pending product creation request
    // Note: Actual product creation requires producer's wallet signature
    // This will be processed when producer approves it in the dashboard
    const pendingProduct = await storePendingProduct(
      webhook.id,
      webhook.walletAddress,
      validation.validatedData
    );

    // Update webhook stats
    webhook.lastTriggered = new Date().toISOString();
    webhook.deliveryCount++;
    await writeWebhooks(webhooks);

    // Log the incoming webhook
    await addWebhookLog(webhook.id, 'webhook.incoming', payload, {
      success: true,
      status: 200,
      message: 'Product creation request queued',
      pendingProductId: pendingProduct.id
    });

    res.json({
      success: true,
      message: 'Product creation request received and queued',
      webhookId: webhook.id,
      pendingProductId: pendingProduct.id,
      note: 'Product will be created when producer approves the request'
    });
  } catch (error) {
    console.error('Error processing incoming webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process webhook'
    });
  }
});

// POST /api/webhooks/trigger - Trigger webhooks for an event (internal use)
router.post('/trigger', async (req, res) => {
  try {
    const { event, data, walletAddress } = req.body;

    if (!event || !data) {
      return res.status(400).json({
        success: false,
        error: 'Event and data are required'
      });
    }

    // Import trigger function
    const { triggerWebhooks } = await import('./webhook-trigger.js');
    
    const result = await triggerWebhooks(event, data, walletAddress);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger webhooks'
    });
  }
});


export { router };

