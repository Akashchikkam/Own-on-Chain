import express from 'express';
import axios from 'axios';

export const router = express.Router();

/**
 * Proxy IPFS requests through backend to avoid CORS issues
 * GET /api/ipfs/:hash
 */
router.get('/:hash', async (req, res) => {
  const { hash } = req.params;
  
  if (!hash || hash.trim() === '') {
    return res.status(400).json({ error: 'Invalid IPFS hash provided' });
  }
  
  // Clean hash
  const cleanHash = hash.replace(/^\/+|\/+$/g, '').trim();
  
  if (cleanHash.length < 20) {
    return res.status(400).json({ 
      error: `Invalid IPFS hash: appears truncated (${cleanHash.length} chars, expected 46+)`,
      hash: cleanHash
    });
  }
  
  // Try multiple gateways in order
  const gateways = [
    `https://cloudflare-ipfs.com/ipfs/${cleanHash}`, // Primary: Cloudflare (most reliable)
    `https://ipfs.io/ipfs/${cleanHash}`, // Public IPFS gateway
    `https://dweb.link/ipfs/${cleanHash}`, // Protocol Labs gateway
    `https://gateway.pinata.cloud/ipfs/${cleanHash}` // Pinata gateway (fallback)
  ];
  
  for (const gateway of gateways) {
    try {
      console.log(`🔍 Trying IPFS gateway: ${gateway}`);
      const response = await axios.get(gateway, {
        timeout: 10000, // 10 second timeout per gateway
        validateStatus: (status) => status === 200,
        maxRedirects: 5
      });
      
      console.log(`✅ Successfully retrieved from: ${gateway}`);
      
      // Set appropriate headers
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      return res.send(response.data);
    } catch (error) {
      console.warn(`⚠️ Gateway failed (${gateway}):`, error.message);
      // Try next gateway
      continue;
    }
  }
  
  // All gateways failed
  console.error('❌ All IPFS gateways failed for hash:', cleanHash);
  res.status(500).json({
    error: 'Failed to retrieve from all IPFS gateways',
    hash: cleanHash
  });
});


