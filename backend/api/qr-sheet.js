import express from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract addresses
const CONTRACTS = {
  sepolia: {
    ProductNFT: '0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59'
  },
  localhost: {
    ProductNFT: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE'
  }
};

// Get RPC URL
function getRpcUrl() {
  const network = process.env.VITE_NETWORK_NAME || 'sepolia';
  if (network === 'localhost') return 'http://127.0.0.1:8545';
  
  const rpcEndpoints = [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.publicnode.com'
  ];
  
  return rpcEndpoints[0];
}

// Load ABI
let ProductNFTABI = null;
async function getABI() {
  if (!ProductNFTABI) {
    try {
      const abiPath = path.join(__dirname, '../../frontend/src/contracts/ProductNFT.js');
      const module = await import(abiPath);
      ProductNFTABI = module.default;
    } catch (err) {
      throw new Error('Failed to load ABI: ' + err.message);
    }
  }
  return ProductNFTABI;
}

// Get contract address
function getContractAddress() {
  const network = process.env.VITE_NETWORK_NAME || 'sepolia';
  return CONTRACTS[network]?.ProductNFT || CONTRACTS.sepolia.ProductNFT;
}

// Helper to convert data URL to buffer
function dataURLToBuffer(dataURL) {
  const base64Data = dataURL.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}

// Generate QR code as buffer
async function generateQRBuffer(verifyUrl) {
  try {
    const qrDataURL = await QRCode.toDataURL(verifyUrl, {
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    return dataURLToBuffer(qrDataURL);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Fetch product metadata from IPFS
async function fetchProductMetadata(tokenURI) {
  if (!tokenURI || tokenURI === '') {
    console.warn('⚠️ Empty tokenURI provided');
    return null;
  }
  
  try {
    const metadataUrl = tokenURI.startsWith('ipfs://') 
      ? `https://gateway.pinata.cloud/ipfs/${tokenURI.replace('ipfs://', '')}`
      : tokenURI;

    console.log(`🔍 Fetching metadata from: ${metadataUrl}`);
    
    const response = await axios.get(metadataUrl, { 
      timeout: 10000, // Increased timeout
      validateStatus: (status) => status === 200
    });
    
    console.log(`✅ Metadata fetched successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.warn(`❌ Failed to fetch metadata for ${tokenURI}:`, error.message);
    
    // Try alternative gateways if Pinata fails
    if (tokenURI.startsWith('ipfs://')) {
      const hash = tokenURI.replace('ipfs://', '');
      const alternativeGateways = [
        `https://cloudflare-ipfs.com/ipfs/${hash}`,
        `https://ipfs.io/ipfs/${hash}`,
        `https://dweb.link/ipfs/${hash}`
      ];
      
      for (const gateway of alternativeGateways) {
        try {
          console.log(`🔄 Trying alternative gateway: ${gateway}`);
          const response = await axios.get(gateway, { 
            timeout: 5000,
            validateStatus: (status) => status === 200
          });
          console.log(`✅ Successfully fetched from alternative gateway`);
          return response.data;
        } catch (altError) {
          console.warn(`❌ Gateway ${gateway} failed:`, altError.message);
          continue;
        }
      }
    }
    
    return null;
  }
}

// POST /api/qr-sheet/generate - Generate QR sheet PDF
router.post('/generate', async (req, res) => {
  try {
    const { tokenIds, productData, baseUrl } = req.body;

    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Token IDs array is required'
      });
    }

    // Use productData if provided (from frontend), otherwise fetch from blockchain
    let products = [];
    
    if (productData && Array.isArray(productData) && productData.length > 0) {
      // Use provided product data (preferred - faster and more reliable)
      console.log('✅ Using provided product data from frontend');
      
      // Create a map for quick lookup by tokenId
      const productDataMap = new Map();
      productData.forEach(pd => {
        productDataMap.set(pd.tokenId?.toString(), pd);
      });
      
      products = tokenIds.map((tokenId) => {
        const providedData = productDataMap.get(tokenId.toString());
        return {
          tokenId: tokenId.toString(),
          name: providedData?.name || `Product #${tokenId}`,
          serialNumber: providedData?.serialNumber || 'N/A',
          model: providedData?.model || 'N/A',
          productId: providedData?.productId || null,
          tokenURI: null
        };
      });
      
      console.log(`📦 Processed ${products.length} products from frontend data`);
      products.forEach(p => console.log(`  - Token ${p.tokenId}: "${p.name}"`));
    } else {
      // Fallback: Fetch from blockchain/IPFS
      console.log('⚠️ Product data not provided, fetching from blockchain/IPFS');
      
      // Get provider
      let provider;
      const network = process.env.VITE_NETWORK_NAME || 'sepolia';
      if (network === 'localhost') {
        provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      } else {
        const rpcUrls = [
          'https://rpc.sepolia.org',
          'https://ethereum-sepolia-rpc.publicnode.com',
          'https://sepolia.publicnode.com'
        ];
        
        let lastError;
        for (const rpcUrl of rpcUrls) {
          try {
            provider = new ethers.JsonRpcProvider(rpcUrl);
            await provider.getBlockNumber();
            break;
          } catch (err) {
            lastError = err;
            continue;
          }
        }
        if (!provider) {
          throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
        }
      }

      const abi = await getABI();
      const contractAddress = getContractAddress();
      const contract = new ethers.Contract(contractAddress, abi.abi, provider);

      // Fetch product data
      for (const tokenId of tokenIds) {
        try {
          const tokenURI = await contract.tokenURI(tokenId).catch(() => '');
          console.log(`📦 Fetching metadata for token ${tokenId}, URI: ${tokenURI}`);
          
          const metadata = await fetchProductMetadata(tokenURI);
          console.log(`✅ Metadata for token ${tokenId}:`, JSON.stringify(metadata, null, 2));
          
          // Extract product name - check multiple possible fields
          const productName = metadata?.name || 
                            metadata?.productName || 
                            metadata?.title ||
                            `Product #${tokenId}`;
          
          console.log(`📝 Product name for token ${tokenId}: "${productName}"`);
          
          products.push({
            tokenId: tokenId.toString(),
            name: productName,
            serialNumber: metadata?.serialNumber || 'N/A',
            model: metadata?.model || 'N/A',
            productId: metadata?.productId || null,
            tokenURI,
            rawMetadata: metadata // Keep for debugging
          });
        } catch (err) {
          console.warn(`Failed to fetch product ${tokenId}:`, err.message);
          products.push({
            tokenId: tokenId.toString(),
            name: `Product #${tokenId}`,
            serialNumber: 'N/A',
            model: 'N/A',
            productId: null,
            tokenURI: null,
            rawMetadata: null
          });
        }
      }
    }

    // Generate verification URLs and QR codes in parallel for better performance
    console.log(`🔄 Generating ${products.length} QR codes in parallel...`);
    const qrPromises = products.map(async (product) => {
      try {
        const verifyUrl = product.productId && product.serialNumber !== 'N/A'
          ? `${baseUrl || 'http://localhost:5173'}/verify?id=${product.productId}&serial=${product.serialNumber}`
          : `${baseUrl || 'http://localhost:5173'}/verify/${product.tokenId}`;
        
        const qrBuffer = await generateQRBuffer(verifyUrl);
        return {
          ...product,
          qrBuffer,
          verifyUrl
        };
      } catch (err) {
        console.warn(`Failed to generate QR for product ${product.tokenId}:`, err.message);
        return null; // Return null for failed products
      }
    });
    
    // Wait for all QR codes to generate in parallel
    const qrResults = await Promise.all(qrPromises);
    const qrData = qrResults.filter(result => result !== null); // Filter out failed ones
    console.log(`✅ Generated ${qrData.length}/${products.length} QR codes successfully`);

    if (qrData.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate QR codes for any products'
      });
    }

    // Set response headers BEFORE piping
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="qr-sheet-${Date.now()}.pdf"`);

    // Generate PDF
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 30,
      layout: 'landscape' // Landscape for better QR code layout
    });

    // Pipe PDF to response AFTER headers are set
    doc.pipe(res);

    // Add header
    doc.fontSize(18).text('Product QR Codes Sheet', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Layout: 2 QR codes per row (landscape LETTER: 11" x 8.5")
    const QR_SIZE = 200; // Size of QR code in PDF points
    const INFO_HEIGHT = 90; // Increased height for product info (was 70)
    const ROW_HEIGHT = QR_SIZE + INFO_HEIGHT + 30; // Total height per row
    const COLS_PER_ROW = 2;
    const PAGE_WIDTH = doc.page.width - 60; // Account for margins
    const COL_WIDTH = PAGE_WIDTH / COLS_PER_ROW;
    const QR_X_OFFSET = (COL_WIDTH - QR_SIZE) / 2; // Center QR in column
    
    let currentRow = 0;
    let currentCol = 0;
    let y = 120; // Start below header

    for (let i = 0; i < qrData.length; i++) {
      const product = qrData[i];
      currentCol = i % COLS_PER_ROW;

      // Calculate X position based on column
      const x = 30 + (currentCol * COL_WIDTH) + QR_X_OFFSET; // 30 = left margin

      // New row check
      if (currentCol === 0 && i > 0) {
        currentRow++;
        y += ROW_HEIGHT;
        
        // Check if we need a new page
        if (y + ROW_HEIGHT > doc.page.height - 50) {
          doc.addPage();
          y = 50;
        }
      }

      // Add QR code image
      doc.image(product.qrBuffer, x, y, {
        width: QR_SIZE,
        height: QR_SIZE
      });

      // Add product info below QR code
      const infoY = y + QR_SIZE + 5;
      const infoX = 30 + (currentCol * COL_WIDTH); // Left edge of column
      const infoWidth = COL_WIDTH - 20; // Leave some margin
      
      // Debug: Log what we're about to render
      console.log(`📄 Rendering QR for product:`, {
        tokenId: product.tokenId,
        name: product.name,
        hasName: !!product.name,
        nameLength: product.name?.length
      });
      
      // Product name (bold, larger font, more prominent) - ALWAYS show
      const displayName = product.name || `Product #${product.tokenId}`;
      doc.fontSize(12).fillColor('#000000');
      doc.font('Helvetica-Bold')
        .text(displayName, infoX + 10, infoY, {
          width: infoWidth - 20,
          align: 'center',
          ellipsis: true
        });
      
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      let textY = infoY + 20; // Increased spacing after name
      
      // Token ID
      doc.text(`Token ID: ${product.tokenId}`, infoX + 10, textY, {
        width: infoWidth - 20,
        align: 'center'
      });
      
      textY += 12;
      
      // Serial Number
      if (product.serialNumber !== 'N/A') {
        doc.text(`Serial: ${product.serialNumber}`, infoX + 10, textY, {
          width: infoWidth - 20,
          align: 'center',
          ellipsis: true
        });
        textY += 12;
      }
      
      // Model (if available)
      if (product.model !== 'N/A') {
        doc.text(`Model: ${product.model}`, infoX + 10, textY, {
          width: infoWidth - 20,
          align: 'center',
          ellipsis: true
        });
      }

      // Reset color
      doc.fillColor('#000000');
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating QR sheet PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate QR sheet PDF'
      });
    } else {
      // If headers already sent (PDF stream started), try to end gracefully
      res.end();
    }
  }
});

export { router };

