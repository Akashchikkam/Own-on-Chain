import express from 'express';
import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const CONFIRMATIONS_FILE = path.join(DATA_DIR, 'confirmations.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

// Read confirmations from file
async function readConfirmations() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(CONFIRMATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading confirmations file:', error);
    throw error;
  }
}

// Write confirmations to file
async function writeConfirmations(confirmations) {
  try {
    await ensureDataDir();
    await fs.writeFile(CONFIRMATIONS_FILE, JSON.stringify(confirmations, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing confirmations file:', error);
    throw error;
  }
}

// Verify signature
function verifySignature(message, signature, expectedAddress) {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

// POST /api/confirmations - Record a receipt confirmation with signature
router.post('/', async (req, res) => {
  try {
    const { tokenId, confirmedBy, signature, timestamp, message } = req.body;

    if (!tokenId || !confirmedBy || !signature) {
      return res.status(400).json({ 
        success: false,
        error: 'Token ID, confirmedBy address, and signature are required.' 
      });
    }

    // Verify signature
    if (!verifySignature(message, signature, confirmedBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature. Signature does not match the confirmedBy address.'
      });
    }

    const confirmations = await readConfirmations();
    
    // Check if already confirmed (prevent duplicates)
    const existingConfirmation = confirmations.find(
      c => c.tokenId === tokenId.toString() && 
           c.confirmedBy.toLowerCase() === confirmedBy.toLowerCase()
    );

    if (existingConfirmation) {
      return res.status(400).json({
        success: false,
        error: 'Receipt already confirmed for this product.'
      });
    }

    const newConfirmation = {
      id: Date.now().toString(),
      tokenId: tokenId.toString(),
      confirmedBy,
      signature,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      message: message || `Receipt confirmed for Product #${tokenId}`,
      createdAt: new Date().toISOString()
    };

    confirmations.push(newConfirmation);
    await writeConfirmations(confirmations);

    console.log(`✅ Receipt confirmation recorded: Token ${tokenId} by ${confirmedBy}`);

    res.status(201).json({ 
      success: true, 
      data: newConfirmation 
    });
  } catch (error) {
    console.error('Error recording confirmation:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to record confirmation.' 
    });
  }
});

// GET /api/confirmations/:tokenId - Get all confirmations for a token
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const confirmations = await readConfirmations();
    const tokenConfirmations = confirmations.filter(
      c => c.tokenId === tokenId.toString()
    );

    res.json({ 
      success: true, 
      data: tokenConfirmations 
    });
  } catch (error) {
    console.error('Error fetching confirmations:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to fetch confirmations.' 
    });
  }
});

export { router };

