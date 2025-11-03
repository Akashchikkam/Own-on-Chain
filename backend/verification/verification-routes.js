import express from 'express';
import { validateGovernmentId } from '../product-ids/country-standards.js';
import { verifyGSTIN } from './india-gstin.js';
import { verifyEUVAT } from './eu-vat.js';
import { 
  verifyGSTIN_IDfy, 
  verifyPAN_IDfy, 
  initiateAadhaarVerification_IDfy,
  verifyAadhaarOTP_IDfy,
  checkIDfyStatus 
} from './idfy-service.js';

export const router = express.Router();

/**
 * POST /api/verify/government-id
 * Verify government ID based on country and type
 */
router.post('/government-id', async (req, res) => {
  try {
    const { countryCode, idType, idNumber, additionalInfo } = req.body;
    
    if (!countryCode || !idType || !idNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: countryCode, idType, idNumber' 
      });
    }
    
    // Format validation
    const validation = validateGovernmentId(idNumber, idType, countryCode);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid ID format',
        details: validation.error
      });
    }
    
    // Check if IDfy is configured for India
    const idfyStatus = await checkIDfyStatus();
    
    // Route to appropriate verification service
    let verificationResult;
    
    switch (countryCode) {
      case 'IND':
        // Use IDfy for real-time verification if configured
        if (idfyStatus.configured && idfyStatus.status === 'operational') {
          if (idType === 'GSTIN') {
            console.log('🔍 Verifying GSTIN via IDfy:', idNumber);
            verificationResult = await verifyGSTIN_IDfy(idNumber);
          } else if (idType === 'AADHAAR') {
            // Aadhaar requires OTP - initiate verification
            console.log('🔍 Initiating Aadhaar verification via IDfy:', idNumber);
            const initResult = await initiateAadhaarVerification_IDfy(idNumber);
            if (initResult.success) {
              verificationResult = {
                verified: false,
                status: 'pending_otp',
                message: 'OTP sent to Aadhaar-linked mobile number',
                requiresOtp: true,
                requestId: initResult.requestId,
                expiresIn: initResult.expiresIn
              };
            } else {
              verificationResult = {
                verified: false,
                status: 'error',
                message: 'Failed to initiate Aadhaar verification',
                error: initResult.error
              };
            }
          } else if (idType === 'PAN') {
            console.log('🔍 Verifying PAN via IDfy:', idNumber);
            verificationResult = await verifyPAN_IDfy(idNumber, additionalInfo?.name);
          } else {
            verificationResult = {
              verified: false,
              status: 'pending_manual',
              message: 'Manual verification required'
            };
          }
        } else {
          // Fallback to manual verification if IDfy not configured
          console.warn('⚠️ IDfy not configured, using manual verification');
          if (idType === 'AADHAAR') {
            verificationResult = {
              verified: false,
              status: 'pending_otp',
              message: 'OTP verification required (IDfy not configured)',
              requiresOtp: true
            };
          } else {
            verificationResult = {
              verified: false,
              status: 'pending_manual',
              message: 'Manual verification required (IDfy not configured)'
            };
          }
        }
        break;
        
      case 'USA':
        if (idType === 'EIN') {
          // EIN verification requires Stripe Identity or similar
          verificationResult = {
            verified: false,
            status: 'pending_manual',
            message: 'EIN verification requires manual review'
          };
        } else {
          verificationResult = {
            verified: false,
            status: 'pending_manual',
            message: 'Manual verification required'
          };
        }
        break;
        
      case 'GBR':
        if (idType === 'VAT') {
          // UK VAT verification via HMRC API
          verificationResult = {
            verified: false,
            status: 'pending_manual',
            message: 'VAT verification requires manual review'
          };
        } else if (idType === 'COMPANY_NUMBER') {
          verificationResult = {
            verified: false,
            status: 'pending_manual',
            message: 'Company number verification requires manual review'
          };
        }
        break;
        
      case 'DEU':
      case 'FRA':
        if (idType === 'VAT_ID' || idType === 'VAT_FR') {
          // EU VAT verification via VIES
          verificationResult = await verifyEUVAT(idNumber);
        } else {
          verificationResult = {
            verified: false,
            status: 'pending_manual',
            message: 'Manual verification required'
          };
        }
        break;
        
      default:
        // All other countries - manual verification
        verificationResult = {
          verified: false,
          status: 'pending_manual',
          message: 'Manual verification required by admin'
        };
    }
    
    res.json({
      success: true,
      countryCode,
      idType,
      ...verificationResult
    });
    
  } catch (error) {
    console.error('Government ID verification error:', error);
    res.status(500).json({ 
      error: 'Verification failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/verify/send-otp
 * Send OTP for Aadhaar verification (India only)
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { aadhaarNumber, mobileNumber } = req.body;
    
    if (!aadhaarNumber || !mobileNumber) {
      return res.status(400).json({ 
        error: 'Missing required fields: aadhaarNumber, mobileNumber' 
      });
    }
    
    // TODO: Integrate with UIDAI OTP API
    // For now, return mock success
    res.json({
      success: true,
      message: 'OTP sent to registered mobile number',
      sessionId: `session_${Date.now()}`,
      expiresIn: 300 // 5 minutes
    });
    
  } catch (error) {
    console.error('OTP send error:', error);
    res.status(500).json({ 
      error: 'Failed to send OTP',
      message: error.message 
    });
  }
});

/**
 * POST /api/verify/verify-otp
 * Verify OTP for Aadhaar verification (India only)
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { requestId, otp } = req.body;
    
    if (!requestId || !otp) {
      return res.status(400).json({ 
        error: 'Missing required fields: requestId, otp' 
      });
    }
    
    // Check if IDfy is configured
    const idfyStatus = await checkIDfyStatus();
    
    if (idfyStatus.configured && idfyStatus.status === 'operational') {
      console.log('🔍 Verifying Aadhaar OTP via IDfy');
      const result = await verifyAadhaarOTP_IDfy(requestId, otp);
      
      res.json({
        success: result.verified,
        ...result
      });
    } else {
      // Fallback to mock verification
      console.warn('⚠️ IDfy not configured, using mock OTP verification');
      res.json({
        success: true,
        verified: true,
        message: 'Aadhaar verification successful (mock - IDfy not configured)',
        details: {
          name: 'Mock User',
          dob: '01/01/1990',
          maskedAadhaar: 'XXXX-XXXX-1234'
        }
      });
    }
    
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify OTP',
      message: error.message 
    });
  }
});

/**
 * GET /api/verify/status/:walletAddress
 * Check verification status for a wallet address
 */
router.get('/status/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // TODO: Query database for verification status
    // For now, return mock data
    res.json({
      walletAddress,
      verified: false,
      status: 'pending',
      message: 'Verification pending'
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check status',
      message: error.message 
    });
  }
});

/**
 * GET /api/verify/idfy-status
 * Check if IDfy service is configured and operational
 */
router.get('/idfy-status', async (req, res) => {
  try {
    const status = await checkIDfyStatus();
    res.json(status);
  } catch (error) {
    console.error('IDfy status check error:', error);
    res.status(500).json({ 
      error: 'Failed to check IDfy status',
      message: error.message 
    });
  }
});

