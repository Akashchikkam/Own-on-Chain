/**
 * IDfy Integration for Real-time Government ID Verification (India)
 * 
 * IDfy provides APIs for:
 * - GSTIN verification
 * - PAN verification
 * - Aadhaar verification (via DigiLocker)
 * - Bank account verification
 * - Driving License verification
 * 
 * Website: https://idfy.com
 * Pricing: ₹5-20 per verification (pay-as-you-go or subscription)
 * 
 * Setup:
 * 1. Sign up at https://idfy.com
 * 2. Get API key and secret
 * 3. Add to .env: IDFY_API_KEY, IDFY_API_SECRET
 */

import axios from 'axios';

const IDFY_BASE_URL = 'https://api.idfy.com/v3';

/**
 * Get IDfy credentials from environment
 */
function getIDfyAuth() {
  const apiKey = process.env.IDFY_API_KEY;
  const apiSecret = process.env.IDFY_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    throw new Error('IDfy credentials not configured. Please add IDFY_API_KEY and IDFY_API_SECRET to .env');
  }
  
  return {
    username: apiKey,
    password: apiSecret
  };
}

/**
 * Verify GSTIN (GST Identification Number)
 * Returns company details from GST database
 * 
 * @param {string} gstin - 15 character GSTIN
 * @returns {Promise<Object>} Verification result
 */
export async function verifyGSTIN_IDfy(gstin) {
  try {
    const auth = getIDfyAuth();
    
    const response = await axios.post(
      `${IDFY_BASE_URL}/tasks/sync/verify_with_source/ind_gst`,
      {
        task_id: `gstin_${Date.now()}`,
        group_id: `own_on_chain_${Date.now()}`,
        data: {
          gstin: gstin
        }
      },
      {
        auth,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const result = response.data;
    
    if (result.status === 'completed' && result.result) {
      const gstData = result.result.source_output;
      
      return {
        verified: true,
        status: 'verified',
        message: 'GSTIN verified successfully',
        details: {
          gstin: gstin,
          legalName: gstData.legal_name || gstData.trade_name,
          tradeName: gstData.trade_name,
          registrationDate: gstData.registration_date,
          constitutionOfBusiness: gstData.constitution_of_business,
          taxpayerType: gstData.taxpayer_type,
          gstinStatus: gstData.gstin_status,
          address: {
            building: gstData.principal_place_of_business_address?.building_name,
            street: gstData.principal_place_of_business_address?.street,
            location: gstData.principal_place_of_business_address?.location,
            district: gstData.principal_place_of_business_address?.district,
            state: gstData.principal_place_of_business_address?.state,
            pincode: gstData.principal_place_of_business_address?.pincode
          },
          filingStatus: gstData.filing_status
        }
      };
    } else {
      return {
        verified: false,
        status: 'invalid',
        message: 'GSTIN not found or inactive',
        error: result.error || 'Verification failed'
      };
    }
    
  } catch (error) {
    console.error('IDfy GSTIN verification error:', error.message);
    
    if (error.response?.status === 401) {
      return {
        verified: false,
        status: 'error',
        message: 'IDfy authentication failed. Please check API credentials.',
        error: 'Invalid API key or secret'
      };
    }
    
    return {
      verified: false,
      status: 'error',
      message: 'Verification service error',
      error: error.message
    };
  }
}

/**
 * Verify PAN (Permanent Account Number)
 * Returns name and PAN status
 * 
 * @param {string} pan - 10 character PAN
 * @param {string} name - Name as per PAN card (optional, for name matching)
 * @returns {Promise<Object>} Verification result
 */
export async function verifyPAN_IDfy(pan, name = null) {
  try {
    const auth = getIDfyAuth();
    
    const requestData = {
      task_id: `pan_${Date.now()}`,
      group_id: `own_on_chain_${Date.now()}`,
      data: {
        id_number: pan
      }
    };
    
    // Add name for matching if provided
    if (name) {
      requestData.data.name = name;
    }
    
    const response = await axios.post(
      `${IDFY_BASE_URL}/tasks/sync/verify_with_source/ind_pan`,
      requestData,
      {
        auth,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const result = response.data;
    
    if (result.status === 'completed' && result.result) {
      const panData = result.result.source_output;
      
      return {
        verified: true,
        status: 'verified',
        message: 'PAN verified successfully',
        details: {
          pan: pan,
          name: panData.name || panData.full_name,
          category: panData.category,
          panStatus: panData.pan_status,
          aadhaarLinked: panData.aadhaar_seeding_status === 'Y',
          nameMatch: result.result.name_match || null
        }
      };
    } else {
      return {
        verified: false,
        status: 'invalid',
        message: 'PAN not found or invalid',
        error: result.error || 'Verification failed'
      };
    }
    
  } catch (error) {
    console.error('IDfy PAN verification error:', error.message);
    return {
      verified: false,
      status: 'error',
      message: 'Verification service error',
      error: error.message
    };
  }
}

/**
 * Initiate Aadhaar verification via DigiLocker
 * This is a 2-step process:
 * 1. Send OTP to Aadhaar-linked mobile
 * 2. Verify OTP and get Aadhaar details
 * 
 * @param {string} aadhaarNumber - 12 digit Aadhaar number
 * @returns {Promise<Object>} Session details for OTP verification
 */
export async function initiateAadhaarVerification_IDfy(aadhaarNumber) {
  try {
    const auth = getIDfyAuth();
    
    const response = await axios.post(
      `${IDFY_BASE_URL}/tasks/async/verify_with_source/ind_aadhaar_digilocker`,
      {
        task_id: `aadhaar_${Date.now()}`,
        group_id: `own_on_chain_${Date.now()}`,
        data: {
          aadhaar_number: aadhaarNumber
        }
      },
      {
        auth,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    const result = response.data;
    
    return {
      success: true,
      requestId: result.request_id,
      message: 'OTP sent to Aadhaar-linked mobile number',
      expiresIn: 600 // 10 minutes
    };
    
  } catch (error) {
    console.error('IDfy Aadhaar initiation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Complete Aadhaar verification with OTP
 * 
 * @param {string} requestId - Request ID from initiation step
 * @param {string} otp - 6 digit OTP
 * @returns {Promise<Object>} Verification result with Aadhaar details
 */
export async function verifyAadhaarOTP_IDfy(requestId, otp) {
  try {
    const auth = getIDfyAuth();
    
    // Submit OTP
    await axios.post(
      `${IDFY_BASE_URL}/tasks/${requestId}`,
      {
        data: {
          otp: otp
        }
      },
      {
        auth,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Poll for result (may take a few seconds)
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const resultResponse = await axios.get(
        `${IDFY_BASE_URL}/tasks/${requestId}`,
        { auth }
      );
      
      const result = resultResponse.data;
      
      if (result.status === 'completed') {
        const aadhaarData = result.result.source_output;
        
        return {
          verified: true,
          status: 'verified',
          message: 'Aadhaar verified successfully',
          details: {
            name: aadhaarData.name,
            dob: aadhaarData.dob,
            gender: aadhaarData.gender,
            address: {
              house: aadhaarData.house,
              street: aadhaarData.street,
              landmark: aadhaarData.landmark,
              locality: aadhaarData.locality,
              villageTownCity: aadhaarData.vtc,
              subDistrict: aadhaarData.sub_district,
              district: aadhaarData.district,
              state: aadhaarData.state,
              pincode: aadhaarData.pincode,
              postOffice: aadhaarData.post_office
            },
            maskedAadhaar: aadhaarData.masked_aadhaar,
            photo: aadhaarData.photo_link // Photo URL from DigiLocker
          }
        };
      } else if (result.status === 'failed') {
        return {
          verified: false,
          status: 'invalid_otp',
          message: 'Invalid OTP or OTP expired',
          error: result.error
        };
      }
      
      attempts++;
    }
    
    return {
      verified: false,
      status: 'timeout',
      message: 'Verification timeout. Please try again.',
      error: 'Result not available'
    };
    
  } catch (error) {
    console.error('IDfy Aadhaar OTP verification error:', error.message);
    return {
      verified: false,
      status: 'error',
      message: 'Verification service error',
      error: error.message
    };
  }
}

/**
 * Check if IDfy service is configured and working
 */
export async function checkIDfyStatus() {
  try {
    const auth = getIDfyAuth();
    
    // Test API connection with a lightweight endpoint
    const response = await axios.get(
      `${IDFY_BASE_URL}/account`,
      { auth, timeout: 5000 }
    );
    
    return {
      configured: true,
      status: 'operational',
      balance: response.data.balance || null
    };
  } catch (error) {
    if (error.message.includes('not configured')) {
      return {
        configured: false,
        status: 'not_configured',
        message: 'IDfy API credentials not found in environment variables'
      };
    }
    
    return {
      configured: true,
      status: 'error',
      message: error.message
    };
  }
}

