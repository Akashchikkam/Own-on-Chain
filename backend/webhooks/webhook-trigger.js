import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { retryWebhookDelivery } from './webhook-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const WEBHOOKS_FILE = path.join(DATA_DIR, 'webhooks.json');
const WEBHOOK_LOGS_FILE = path.join(DATA_DIR, 'webhook-logs.json');

// Read webhooks from file
async function readWebhooks() {
  try {
    const data = await fs.readFile(WEBHOOKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Write webhooks to file
async function writeWebhooks(webhooks) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf8');
}

// Read webhook logs
async function readWebhookLogs() {
  try {
    const data = await fs.readFile(WEBHOOK_LOGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// Write webhook logs
async function writeWebhookLogs(logs) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WEBHOOK_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
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

/**
 * Trigger webhooks for a specific event
 * @param {string} event - Event name (e.g., 'product.created', 'product.transferred')
 * @param {object} data - Event data payload
 * @param {string} walletAddress - Wallet address to filter webhooks (optional)
 */
export async function triggerWebhooks(event, data, walletAddress = null) {
  try {
    const webhooks = await readWebhooks();
    
    // Filter webhooks by:
    // 1. Active webhooks only
    // 2. Webhooks subscribed to this event
    // 3. Optional: wallet address match
    const activeWebhooks = webhooks.filter(webhook => {
      if (!webhook.active) return false;
      if (!webhook.events.includes(event)) return false;
      if (walletAddress && webhook.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return false;
      }
      return true;
    });

    if (activeWebhooks.length === 0) {
      console.log(`ℹ️ No active webhooks found for event: ${event}`);
      return { triggered: 0, results: [] };
    }

    console.log(`📤 Triggering ${activeWebhooks.length} webhook(s) for event: ${event}`);

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    const results = await Promise.allSettled(
      activeWebhooks.map(async (webhook) => {
        try {
          // Deliver webhook with retry
          const result = await retryWebhookDelivery(
            webhook.url,
            payload,
            webhook.secret,
            3 // max retries
          );

          // Update webhook stats
          webhook.lastTriggered = new Date().toISOString();
          webhook.deliveryCount++;
          if (result.success) {
            webhook.successCount++;
          } else {
            webhook.failureCount++;
          }

          // Log the delivery
          await addWebhookLog(webhook.id, event, payload, result);

          return {
            webhookId: webhook.id,
            url: webhook.url,
            success: result.success,
            status: result.status,
            error: result.error
          };
        } catch (err) {
          console.error(`❌ Error delivering webhook ${webhook.id}:`, err);
          webhook.failureCount++;
          return {
            webhookId: webhook.id,
            url: webhook.url,
            success: false,
            error: err.message
          };
        }
      })
    );

    // Save updated webhook stats
    await writeWebhooks(webhooks);

    const triggered = results.filter(r => r.status === 'fulfilled').length;
    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;

    console.log(`✅ Webhook delivery complete: ${successful}/${triggered} successful`);

    return {
      triggered,
      successful,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
    };
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    return { triggered: 0, results: [], error: error.message };
  }
}

