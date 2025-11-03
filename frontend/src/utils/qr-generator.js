import QRCode from 'qrcode';

/**
 * Generate QR code for a product
 * @param {number|string} tokenId - NFT token ID
 * @param {string} productId - Product ID (GTIN/UPC/etc.) - optional
 * @param {string} serial - Serial number - optional
 * @returns {Promise<string>} - Data URL for QR code image
 */
export async function generateProductQR(tokenId, productId = null, serial = null) {
  try {
    // Build verification URL
    const baseUrl = window.location.origin;
    let verifyUrl;
    
    if (productId && serial) {
      // Use product ID and serial for verification
      verifyUrl = `${baseUrl}/verify?id=${productId}&serial=${serial}`;
    } else {
      // Use token ID for verification
      verifyUrl = `${baseUrl}/verify/${tokenId}`;
    }
    
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generate QR code with custom options
 * @param {string} url - URL to encode
 * @param {object} options - QR code options
 * @returns {Promise<string>} - Data URL for QR code image
 */
export async function generateQRCode(url, options = {}) {
  const defaultOptions = {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  };
  
  const qrOptions = { ...defaultOptions, ...options };
  
  try {
    const qrDataUrl = await QRCode.toDataURL(url, qrOptions);
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Download QR code as PNG image
 * @param {string} qrDataUrl - QR code data URL
 * @param {string} filename - Filename for download
 */
export function downloadQRCode(qrDataUrl, filename = 'product-qr-code.png') {
  const link = document.createElement('a');
  link.href = qrDataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate and download QR code for a product
 * @param {number|string} tokenId - NFT token ID
 * @param {string} productName - Product name (for filename)
 * @param {string} productId - Product ID (GTIN/UPC/etc.) - optional
 * @param {string} serial - Serial number - optional
 */
export async function downloadProductQR(tokenId, productName = 'Product', productId = null, serial = null) {
  try {
    const qrDataUrl = await generateProductQR(tokenId, productId, serial);
    const filename = `${productName.replace(/\s+/g, '-')}-QR-${tokenId}.png`;
    downloadQRCode(qrDataUrl, filename);
  } catch (error) {
    console.error('Error downloading QR code:', error);
    throw error;
  }
}

/**
 * Generate QR codes for multiple products (returns array of data URLs)
 * @param {Array} products - Array of product objects with tokenId, productId, serial
 * @returns {Promise<Array>} - Array of QR code data URLs
 */
export async function generateBulkQRCodes(products) {
  try {
    const qrPromises = products.map(product => 
      generateProductQR(product.tokenId, product.productId, product.serial)
    );
    
    const qrCodes = await Promise.all(qrPromises);
    return qrCodes.map((qr, index) => ({
      ...products[index],
      qrCode: qr
    }));
  } catch (error) {
    console.error('Error generating bulk QR codes:', error);
    throw error;
  }
}

/**
 * Generate QR code as canvas element (for rendering in React)
 * @param {string} url - URL to encode
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {object} options - QR code options
 */
export async function generateQRToCanvas(url, canvas, options = {}) {
  const defaultOptions = {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  };
  
  const qrOptions = { ...defaultOptions, ...options };
  
  try {
    await QRCode.toCanvas(canvas, url, qrOptions);
  } catch (error) {
    console.error('Error generating QR code to canvas:', error);
    throw error;
  }
}

