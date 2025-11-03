import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Quagga from '@ericblade/quagga2';
import './Scanner.css';

/**
 * Universal Scanner Component
 * Supports both QR codes and barcodes (UPC/EAN/GTIN)
 * 
 * @param {Object} props
 * @param {Function} props.onScan - Callback when scan is successful (result)
 * @param {Function} props.onError - Callback when scan fails (error)
 * @param {Function} props.onClose - Callback to close scanner
 * @param {string} props.mode - 'qr' or 'barcode' (default: 'qr')
 * @param {number} props.fps - Frames per second (default: 10)
 * @param {number} props.qrbox - Size of QR scanning box (default: 250)
 */
function Scanner({ 
  onScan, 
  onError, 
  onClose,
  mode: initialMode = 'qr',
  fps = 10,
  qrbox = 250
}) {
  const [mode, setMode] = useState(initialMode);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const scannerRef = useRef(null);
  const qrScannerRef = useRef(null);
  
  useEffect(() => {
    // Start scanner when component mounts or mode changes
    startScanner();
    
    // Cleanup when component unmounts
    return () => {
      stopScanner();
    };
  }, [mode]);
  
  const startScanner = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      if (mode === 'qr') {
        await startQRScanner();
      } else {
        await startBarcodeScanner();
      }
    } catch (err) {
      console.error('Scanner start error:', err);
      setError(err.message || 'Failed to start scanner');
      setIsScanning(false);
      if (onError) onError(err);
    }
  };
  
  const stopScanner = () => {
    try {
      if (mode === 'qr' && qrScannerRef.current) {
        qrScannerRef.current.clear();
        qrScannerRef.current = null;
      } else if (mode === 'barcode' && Quagga.initialized) {
        Quagga.stop();
      }
      setIsScanning(false);
    } catch (err) {
      console.error('Scanner stop error:', err);
    }
  };
  
  const startQRScanner = async () => {
    const scannerId = 'qr-scanner-region';
    
    // Create QR scanner
    const qrScanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps,
        qrbox: { width: qrbox, height: qrbox },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        formatsToSupport: ['QR_CODE']
      },
      false // verbose
    );
    
    qrScannerRef.current = qrScanner;
    
    // Success callback
    const onScanSuccess = (decodedText, decodedResult) => {
      console.log('QR scan success:', decodedText);
      
      // Prevent duplicate scans
      if (decodedText === lastScan) return;
      setLastScan(decodedText);
      
      // Parse the URL if it's a verification link
      let result = {
        raw: decodedText,
        type: 'qr',
        format: decodedResult.result.format?.formatName || 'QR_CODE'
      };
      
      // Try to parse as URL
      try {
        const url = new URL(decodedText);
        result.url = url;
        
        // Extract token ID or product ID from URL
        if (url.pathname.includes('/verify/')) {
          result.tokenId = url.pathname.split('/verify/')[1];
        } else if (url.searchParams.has('id')) {
          result.productId = url.searchParams.get('id');
          result.serial = url.searchParams.get('serial');
        }
      } catch (urlError) {
        // Not a URL, just use raw text
        result.text = decodedText;
      }
      
      if (onScan) onScan(result);
      
      // Auto-close scanner after successful scan
      setTimeout(() => {
        stopScanner();
      }, 500);
    };
    
    // Error callback
    const onScanFailure = (error) => {
      // Ignore "NotFoundException" errors (no QR code in frame)
      if (!error.includes('NotFoundException')) {
        console.warn('QR scan error:', error);
      }
    };
    
    // Render the scanner
    qrScanner.render(onScanSuccess, onScanFailure);
  };
  
  const startBarcodeScanner = async () => {
    const config = {
      inputStream: {
        type: 'LiveStream',
        target: scannerRef.current,
        constraints: {
          width: { min: 640 },
          height: { min: 480 },
          facingMode: 'environment', // Use back camera
          aspectRatio: { min: 1, max: 2 }
        }
      },
      locator: {
        patchSize: 'medium',
        halfSample: true
      },
      numOfWorkers: navigator.hardwareConcurrency || 4,
      decoder: {
        readers: [
          'ean_reader',      // EAN-13, EAN-8
          'ean_8_reader',    // EAN-8 specifically
          'upc_reader',      // UPC-A, UPC-E
          'upc_e_reader',    // UPC-E specifically
          'code_128_reader', // Code 128
          'code_39_reader',  // Code 39
          'i2of5_reader'     // Interleaved 2 of 5
        ],
        multiple: false
      },
      locate: true,
      frequency: fps
    };
    
    return new Promise((resolve, reject) => {
      Quagga.init(config, (err) => {
        if (err) {
          console.error('Quagga init error:', err);
          reject(err);
          return;
        }
        
        console.log('Barcode scanner initialized');
        Quagga.start();
        resolve();
      });
      
      // Register detection callback
      Quagga.onDetected((result) => {
        if (!result || !result.codeResult) return;
        
        const code = result.codeResult.code;
        const format = result.codeResult.format;
        
        console.log('Barcode detected:', code, format);
        
        // Prevent duplicate scans
        if (code === lastScan) return;
        setLastScan(code);
        
        // Validate barcode (must be numeric for GTIN/UPC/EAN)
        if (!/^[0-9]+$/.test(code)) {
          console.warn('Invalid barcode format:', code);
          return;
        }
        
        const scanResult = {
          raw: code,
          type: 'barcode',
          format,
          productId: code, // GTIN/UPC/EAN code
          confidence: result.codeResult.decodedCodes?.length || 0
        };
        
        if (onScan) onScan(scanResult);
        
        // Auto-close scanner after successful scan
        setTimeout(() => {
          stopScanner();
        }, 500);
      });
    });
  };
  
  const handleModeSwitch = () => {
    stopScanner();
    setMode(mode === 'qr' ? 'barcode' : 'qr');
    setLastScan(null);
  };
  
  return (
    <div className="scanner-modal">
      <div className="scanner-container">
        <div className="scanner-header">
          <h3>
            {mode === 'qr' ? '📱 QR Code Scanner' : '🔲 Barcode Scanner'}
          </h3>
          <button 
            className="btn-close" 
            onClick={onClose}
            aria-label="Close scanner"
          >
            ✕
          </button>
        </div>
        
        <div className="scanner-controls">
          <button 
            className={`btn-mode ${mode === 'qr' ? 'active' : ''}`}
            onClick={() => mode !== 'qr' && handleModeSwitch()}
          >
            QR Code
          </button>
          <button 
            className={`btn-mode ${mode === 'barcode' ? 'active' : ''}`}
            onClick={() => mode !== 'barcode' && handleModeSwitch()}
          >
            Barcode
          </button>
        </div>
        
        {error && (
          <div className="scanner-error">
            <p>⚠️ {error}</p>
            <button className="btn btn-small" onClick={startScanner}>
              Try Again
            </button>
          </div>
        )}
        
        <div className="scanner-viewport">
          {mode === 'qr' ? (
            <div id="qr-scanner-region" />
          ) : (
            <div ref={scannerRef} className="barcode-scanner-viewport" />
          )}
        </div>
        
        <div className="scanner-instructions">
          {mode === 'qr' ? (
            <p>📸 Point your camera at a QR code to scan</p>
          ) : (
            <p>📸 Point your camera at a barcode (UPC/EAN/GTIN)</p>
          )}
          <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
            {isScanning ? 'Scanning...' : 'Initializing camera...'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Scanner;

