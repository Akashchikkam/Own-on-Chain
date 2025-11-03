import axios from 'axios';

/**
 * Verify EU VAT ID using VIES (VAT Information Exchange System)
 * This is a FREE service provided by the European Commission
 * 
 * VIES API: http://ec.europa.eu/taxation_customs/vies/
 */

export async function verifyEUVAT(vatId) {
  try {
    // Clean VAT ID (remove spaces)
    const cleanVAT = vatId.replace(/\s/g, '').toUpperCase();
    
    // Extract country code (first 2 letters)
    const countryCode = cleanVAT.substring(0, 2);
    const vatNumber = cleanVAT.substring(2);
    
    // VIES SOAP API endpoint
    const viesUrl = 'http://ec.europa.eu/taxation_customs/vies/services/checkVatService';
    
    // Build SOAP request
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                        xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
        <soapenv:Header/>
        <soapenv:Body>
          <urn:checkVat>
            <urn:countryCode>${countryCode}</urn:countryCode>
            <urn:vatNumber>${vatNumber}</urn:vatNumber>
          </urn:checkVat>
        </soapenv:Body>
      </soapenv:Envelope>`;
    
    try {
      const response = await axios.post(viesUrl, soapRequest, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        },
        timeout: 10000 // 10 second timeout
      });
      
      // Parse SOAP response (simple XML parsing)
      const xmlResponse = response.data;
      
      // Check if valid
      const isValid = xmlResponse.includes('<valid>true</valid>');
      
      if (isValid) {
        // Extract company name and address from response
        const nameMatch = xmlResponse.match(/<name>(.*?)<\/name>/);
        const addressMatch = xmlResponse.match(/<address>(.*?)<\/address>/);
        
        return {
          verified: true,
          status: 'verified',
          message: 'VAT ID verified successfully',
          details: {
            countryCode,
            vatNumber,
            companyName: nameMatch ? nameMatch[1].trim() : null,
            address: addressMatch ? addressMatch[1].replace(/\n/g, ', ').trim() : null
          }
        };
      } else {
        return {
          verified: false,
          status: 'invalid',
          message: 'VAT ID not found in VIES database',
          error: 'Invalid VAT number'
        };
      }
      
    } catch (apiError) {
      console.error('VIES API error:', apiError.message);
      
      // VIES service might be temporarily unavailable
      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        return {
          verified: false,
          status: 'service_unavailable',
          message: 'VIES service temporarily unavailable. Please try again later or use manual verification.',
          requiresManualReview: true
        };
      }
      
      throw apiError;
    }
    
  } catch (error) {
    console.error('EU VAT verification error:', error);
    return {
      verified: false,
      status: 'error',
      error: 'Verification service error',
      message: error.message,
      requiresManualReview: true
    };
  }
}

/**
 * List of EU countries for VAT validation
 */
export const EU_COUNTRIES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
  'XI' // Northern Ireland
];

/**
 * Check if country code is EU member
 */
export function isEUCountry(countryCode) {
  return EU_COUNTRIES.includes(countryCode.toUpperCase());
}

