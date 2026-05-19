#!/usr/bin/env node

/**
 * Approve pending product programmatically
 * Note: This still requires wallet signature for blockchain transaction
 */

const { ethers } = require('ethers');
const http = require('http');

const BACKEND_URL = 'http://localhost:3001';
const WALLET_ADDRESS = '0xfed8e82bb1d254774fc694bc4e60f41fba80c09a';

// Get pending products
async function getPendingProducts() {
  return new Promise((resolve, reject) => {
    const url = `${BACKEND_URL}/api/webhooks/pending-products?walletAddress=${WALLET_ADDRESS}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.data || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('📋 Checking pending products...');
    const pending = await getPendingProducts();
    
    if (pending.length === 0) {
      console.log('✅ No pending products');
      return;
    }
    
    console.log(`\n📦 Found ${pending.length} pending product(s):\n`);
    pending.forEach((p, i) => {
      console.log(`${i + 1}. ${p.productData.name}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Serial: ${p.productData.serialNumber || 'N/A'}`);
      console.log(`   Created: ${new Date(p.createdAt).toLocaleString()}`);
      console.log('');
    });
    
    console.log('⚠️  To approve products, you need to:');
    console.log('   1. Go to Producer Dashboard: http://localhost:5173');
    console.log('   2. Scroll to "Pending Product Requests"');
    console.log('   3. Click "✅ Approve & Create" for each product');
    console.log('   4. Confirm in MetaMask');
    console.log('');
    console.log('   (Blockchain transactions require wallet signature)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();

