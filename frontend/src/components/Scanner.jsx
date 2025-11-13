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
 * @param {boolean} props.continuous - Keep scanner open after scan for batch mode (default: false)
 */
function Scanner({ 
  onScan, 
  onError, 
  onClose,
  mode: initialMode = 'qr',
  fps = 10,
  qrbox = 250,
  continuous = false // For batch scanning mode
}) {
  const [mode, setMode] = useState(initialMode);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(0); // Track when last scan occurred
  const scannedCodesRef = useRef(new Set()); // Use ref for synchronous duplicate checking
  const scannerRef = useRef(null);
  const qrScannerRef = useRef(null);
  
  useEffect(() => {
    let isMounted = true;
    
    // Start scanner when component mounts or mode changes
    const init = async () => {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 50));
      if (isMounted) {
        await startScanner();
      }
    };
    
    init();
    
    // Cleanup when component unmounts or mode changes
    return () => {
      isMounted = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  
  const stopScanner = async () => {
    try {
      if (mode === 'qr' && qrScannerRef.current) {
        try {
          await qrScannerRef.current.clear().catch(err => {
            console.warn('Error clearing QR scanner:', err);
          });
        } catch (err) {
          console.warn('Error stopping QR scanner:', err);
        }
        qrScannerRef.current = null;
        
        // Clear the container
        const container = document.getElementById('qr-scanner-region');
        if (container) {
          container.innerHTML = '';
        }
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
    
    // Ensure DOM element exists before initializing
    const element = document.getElementById(scannerId);
    if (!element) {
      // Wait a bit for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      const elementAfterWait = document.getElementById(scannerId);
      if (!elementAfterWait) {
        throw new Error('QR scanner container not found in DOM');
      }
    }
    
    // Clean up any existing scanner first
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.clear().catch(err => {
          console.warn('Error clearing previous QR scanner:', err);
        });
      } catch (err) {
        console.warn('Error stopping previous QR scanner:', err);
      }
      qrScannerRef.current = null;
    }
    
    // Clear the container
    const container = document.getElementById(scannerId);
    if (container) {
      container.innerHTML = '';
    }
    
    // Create QR scanner
    // Note: Removed formatsToSupport to avoid BarcodeDetector API issues with empty hints
    const qrScanner = new Html5QrcodeScanner(
      scannerId,
      {
        fps,
        qrbox: { width: qrbox, height: qrbox },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        rememberLastUsedCamera: true
        // Don't specify formatsToSupport - let it use default QR code detection
        // This avoids "Hint option provided, but is empty" error
      },
      false // verbose
    );
    
    qrScannerRef.current = qrScanner;
    
    // Success callback
    const onScanSuccess = (decodedText, decodedResult) => {
      console.log('QR scan success:', decodedText);
      
      // STRICT duplicate prevention: Use ref for synchronous checking
      // This prevents security issues where users can add the same product multiple times
      if (scannedCodesRef.current.has(decodedText)) {
        console.log('🔒 Duplicate scan BLOCKED (same QR code already scanned)');
        return; // Completely block duplicate scans
      }
      
      // Additional time-based check for rapid scanning (2 seconds)
      const now = Date.now();
      if (decodedText === lastScan && (now - lastScanTime) < 2000) {
        console.log('🔒 Duplicate scan prevented (same QR within 2 seconds)');
        return;
      }
      
      // Mark this code as scanned IMMEDIATELY and SYNCHRONOUSLY to prevent duplicates
      scannedCodesRef.current.add(decodedText);
      setLastScan(decodedText);
      setLastScanTime(now);
      
      // Parse the URL if it's a verification link
      let result = {
        raw: decodedText,
        type: 'qr',
        format: decodedResult?.result?.format?.formatName || 'QR_CODE'
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
      
      // Only auto-close scanner if not in continuous mode (batch scanning)
      if (!continuous) {
        setTimeout(() => {
          stopScanner();
        }, 500);
      }
      // In continuous mode, keep scanner open but don't reset scannedCodesRef
      // This ensures the same QR code can never be scanned twice in the same session
    };
    
    // Error callback
    const onScanFailure = (error) => {
      // Ignore "NotFoundException" errors (no QR code in frame)
      if (!error || !error.includes || !error.includes('NotFoundException')) {
        console.warn('QR scan error:', error);
      }
    };
    
    // Render the scanner
    try {
      qrScanner.render(onScanSuccess, onScanFailure);
      setIsScanning(true);
    } catch (renderError) {
      console.error('Error rendering QR scanner:', renderError);
      setError(`Failed to start QR scanner: ${renderError.message}`);
      setIsScanning(false);
      throw renderError;
    }
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
        
        // STRICT duplicate prevention: Use ref for synchronous checking
        if (scannedCodesRef.current.has(code)) {
          console.log('🔒 Duplicate scan BLOCKED (same barcode already scanned)');
          return; // Completely block duplicate scans
        }
        
        // Additional time-based check for rapid scanning (2 seconds)
        const now = Date.now();
        if (code === lastScan && (now - lastScanTime) < 2000) {
          console.log('🔒 Duplicate scan prevented (same barcode within 2 seconds)');
          return;
        }
        
        // Mark this code as scanned IMMEDIATELY and SYNCHRONOUSLY to prevent duplicates
        scannedCodesRef.current.add(code);
        setLastScan(code);
        setLastScanTime(now);
        
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
        
        // Only auto-close scanner if not in continuous mode (batch scanning)
        if (!continuous) {
          setTimeout(() => {
            stopScanner();
          }, 500);
        }
        // In continuous mode, keep scanner open but don't reset scannedCodesRef
      });
    });
  };
  
  const handleModeSwitch = () => {
    stopScanner();
    setMode(mode === 'qr' ? 'barcode' : 'qr');
    setLastScan(null);
    scannedCodesRef.current.clear(); // Clear scanned codes when switching modes
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

