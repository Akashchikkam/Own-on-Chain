import crypto from 'crypto';
import axios from 'axios';

/**
 * Generate a secure random secret key for webhook authentication
 */
export function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create HMAC signature for webhook payload
 */
export function createWebhookSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = createWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Deliver webhook to external URL
 */
export async function deliverWebhook(webhookUrl, payload, secret, timeout = 10000) {
  const signature = createWebhookSignature(payload, secret);
  
  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': Date.now().toString(),
        'User-Agent': 'Own-on-Chain-Webhook/1.0'
      },
      timeout: timeout,
      validateStatus: (status) => status < 500 // Accept 2xx, 3xx, 4xx as delivered
    });

    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      deliveredAt: new Date().toISOString(),
      response: response.data
    };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        status: 0,
        statusText: 'Timeout',
        deliveredAt: new Date().toISOString(),
        error: 'Request timeout'
      };
    }
    
    if (error.response) {
      return {
        success: false,
        status: error.response.status,
        statusText: error.response.statusText,
        deliveredAt: new Date().toISOString(),
        error: error.message
      };
    }

    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      deliveredAt: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Retry webhook delivery with exponential backoff
 */
export async function retryWebhookDelivery(webhookUrl, payload, secret, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30s delay
    
    if (attempt > 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const result = await deliverWebhook(webhookUrl, payload, secret);
    
    if (result.success) {
      return { ...result, attempts: attempt };
    }
    
    lastError = result;
  }
  
  return { ...lastError, attempts: maxRetries };
}

