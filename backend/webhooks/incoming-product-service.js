import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const PENDING_PRODUCTS_FILE = path.join(DATA_DIR, 'pending-products.json');

/**
 * Store pending product creation request from incoming webhook
 */
export async function storePendingProduct(webhookId, walletAddress, productData) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    let pendingProducts = [];
    try {
      const data = await fs.readFile(PENDING_PRODUCTS_FILE, 'utf8');
      pendingProducts = JSON.parse(data);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const pendingProduct = {
      id: Date.now().toString(),
      webhookId,
      walletAddress: walletAddress.toLowerCase(),
      productData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      processedAt: null,
      tokenId: null,
      error: null
    };

    pendingProducts.push(pendingProduct);
    await fs.writeFile(PENDING_PRODUCTS_FILE, JSON.stringify(pendingProducts, null, 2), 'utf8');

    console.log(`📦 Stored pending product creation request: ${pendingProduct.id}`);
    return pendingProduct;
  } catch (error) {
    console.error('Error storing pending product:', error);
    throw error;
  }
}

/**
 * Get pending products for a wallet address
 */
export async function getPendingProducts(walletAddress) {
  try {
    const data = await fs.readFile(PENDING_PRODUCTS_FILE, 'utf8');
    const allPending = JSON.parse(data);
    
    return allPending.filter(
      p => p.walletAddress.toLowerCase() === walletAddress.toLowerCase() && p.status === 'pending'
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get all pending products (for admin)
 */
export async function getAllPendingProducts() {
  try {
    const data = await fs.readFile(PENDING_PRODUCTS_FILE, 'utf8');
    return JSON.parse(data).filter(p => p.status === 'pending');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get pending product by ID
 */
export async function getPendingProductById(productId) {
  try {
    const data = await fs.readFile(PENDING_PRODUCTS_FILE, 'utf8');
    const pendingProducts = JSON.parse(data);
    // Handle both string and number ID matching
    return pendingProducts.find(p => String(p.id) === String(productId)) || null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Update pending product status
 */
export async function updatePendingProduct(productId, updates) {
  try {
    const data = await fs.readFile(PENDING_PRODUCTS_FILE, 'utf8');
    const pendingProducts = JSON.parse(data);
    
    // Handle both string and number ID matching
    const index = pendingProducts.findIndex(p => String(p.id) === String(productId));
    if (index === -1) {
      throw new Error('Pending product not found');
    }

    pendingProducts[index] = {
      ...pendingProducts[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(PENDING_PRODUCTS_FILE, JSON.stringify(pendingProducts, null, 2), 'utf8');
    return pendingProducts[index];
  } catch (error) {
    console.error('Error updating pending product:', error);
    throw error;
  }
}

/**
 * Validate incoming product data from ERP
 */
export function validateProductData(payload) {
  const errors = [];

  if (!payload.productName && !payload.name) {
    errors.push('productName or name is required');
  }

  // Optional but recommended fields
  const recommendedFields = ['serialNumber', 'description', 'category', 'model'];
  const missingRecommended = recommendedFields.filter(field => !payload[field]);
  
  if (missingRecommended.length > 0) {
    console.warn(`⚠️ Missing recommended fields: ${missingRecommended.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    validatedData: {
      name: payload.productName || payload.name || 'Unnamed Product',
      description: payload.description || '',
      category: payload.category || '',
      serialNumber: payload.serialNumber || '',
      model: payload.model || '',
      productType: payload.productType || 'physical',
      warrantyPeriod: payload.warrantyPeriod || 365,
      manufacturer: payload.manufacturer || {
        name: payload.manufacturerName || '',
        address: payload.manufacturerAddress || '',
        country: payload.manufacturerCountry || '',
        website: payload.manufacturerWebsite || ''
      },
      specifications: payload.specifications || payload.metadata?.specifications || {},
      images: payload.images || payload.metadata?.images || []
    }
  };
}

