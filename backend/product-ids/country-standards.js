/**
 * Country-specific product identification standards and government ID verification requirements
 */

export const COUNTRY_STANDARDS = {
  'IND': {
    name: 'India',
    code: 'IND',
    productId: {
      primary: 'GTIN-13/EAN-13',
      formats: ['GTIN-13', 'EAN-13', 'GTIN-14'],
      registrar: 'GS1 India',
      registrarUrl: 'https://gs1india.org/',
      prefixes: ['890'] // India GS1 prefix
    },
    governmentId: {
      types: [
        { 
          value: 'GSTIN', 
          label: 'GSTIN (GST Identification Number)', 
          format: '15 alphanumeric characters',
          pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
          verificationMethod: 'GST API',
          forBusinessOnly: true
        },
        { 
          value: 'AADHAAR', 
          label: 'Aadhaar Card', 
          format: '12 digits',
          pattern: /^[0-9]{12}$/,
          verificationMethod: 'UIDAI OTP',
          forBusinessOnly: false
        },
        {
          value: 'PAN',
          label: 'PAN Card',
          format: '10 alphanumeric characters',
          pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
          verificationMethod: 'Manual',
          forBusinessOnly: false
        }
      ]
    }
  },
  
  'USA': {
    name: 'United States',
    code: 'USA',
    productId: {
      primary: 'UPC-A',
      formats: ['UPC-A', 'UPC-E', 'GTIN-12'],
      registrar: 'GS1 US',
      registrarUrl: 'https://www.gs1us.org/',
      prefixes: ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'] // US/Canada prefixes
    },
    governmentId: {
      types: [
        { 
          value: 'EIN', 
          label: 'EIN (Employer Identification Number)', 
          format: '9 digits (XX-XXXXXXX)',
          pattern: /^[0-9]{2}-?[0-9]{7}$/,
          verificationMethod: 'IRS Database',
          forBusinessOnly: true
        },
        { 
          value: 'SSN', 
          label: 'SSN (Last 4 digits)', 
          format: 'Last 4 digits only',
          pattern: /^[0-9]{4}$/,
          verificationMethod: 'Manual',
          forBusinessOnly: false
        }
      ]
    }
  },
  
  'GBR': {
    name: 'United Kingdom',
    code: 'GBR',
    productId: {
      primary: 'GTIN-13/GTIN-14',
      formats: ['GTIN-13', 'GTIN-14', 'EAN-13'],
      registrar: 'GS1 UK',
      registrarUrl: 'https://www.gs1uk.org/',
      prefixes: ['50'] // UK GS1 prefix
    },
    governmentId: {
      types: [
        { 
          value: 'VAT', 
          label: 'VAT Number', 
          format: 'GB followed by 9 or 12 digits',
          pattern: /^GB[0-9]{9}$|^GB[0-9]{12}$/,
          verificationMethod: 'HMRC API',
          forBusinessOnly: true
        },
        { 
          value: 'COMPANY_NUMBER', 
          label: 'Company Number', 
          format: '8 characters',
          pattern: /^[A-Z0-9]{8}$/,
          verificationMethod: 'Companies House API',
          forBusinessOnly: true
        }
      ]
    }
  },
  
  'DEU': {
    name: 'Germany',
    code: 'DEU',
    productId: {
      primary: 'EAN-13',
      formats: ['EAN-13', 'EAN-8', 'GTIN-13'],
      registrar: 'GS1 Germany',
      registrarUrl: 'https://www.gs1-germany.de/',
      prefixes: ['40', '41', '42', '43', '44'] // Germany GS1 prefixes
    },
    governmentId: {
      types: [
        { 
          value: 'VAT_ID', 
          label: 'VAT ID (USt-IdNr.)', 
          format: 'DE followed by 9 digits',
          pattern: /^DE[0-9]{9}$/,
          verificationMethod: 'VIES API',
          forBusinessOnly: true
        }
      ]
    }
  },
  
  'FRA': {
    name: 'France',
    code: 'FRA',
    productId: {
      primary: 'EAN-13',
      formats: ['EAN-13', 'EAN-8', 'GTIN-13'],
      registrar: 'GS1 France',
      registrarUrl: 'https://www.gs1.fr/',
      prefixes: ['30', '31', '32', '33', '34', '35', '36', '37'] // France GS1 prefixes
    },
    governmentId: {
      types: [
        { 
          value: 'VAT_FR', 
          label: 'VAT Number (TVA)', 
          format: 'FR followed by 11 digits',
          pattern: /^FR[0-9]{11}$/,
          verificationMethod: 'VIES API',
          forBusinessOnly: true
        },
        { 
          value: 'SIREN', 
          label: 'SIREN Number', 
          format: '9 digits',
          pattern: /^[0-9]{9}$/,
          verificationMethod: 'INSEE API',
          forBusinessOnly: true
        }
      ]
    }
  },
  
  'CHN': {
    name: 'China',
    code: 'CHN',
    productId: {
      primary: 'GTIN-13',
      formats: ['GTIN-13', 'EAN-13'],
      registrar: 'GS1 China',
      registrarUrl: 'https://www.gs1cn.org/',
      prefixes: ['690', '691', '692', '693', '694', '695', '696', '697', '698', '699'] // China GS1 prefixes
    },
    governmentId: {
      types: [
        { 
          value: 'USCC', 
          label: 'USCC (Unified Social Credit Code)', 
          format: '18 alphanumeric characters',
          pattern: /^[0-9A-Z]{18}$/,
          verificationMethod: 'Manual',
          forBusinessOnly: true
        }
      ]
    }
  },
  
  'JPN': {
    name: 'Japan',
    code: 'JPN',
    productId: {
      primary: 'JAN',
      formats: ['JAN-13', 'JAN-8'],
      registrar: 'GS1 Japan',
      registrarUrl: 'https://www.gs1jp.org/',
      prefixes: ['45', '49'] // Japan GS1 prefixes
    },
    governmentId: {
      types: [
        { 
          value: 'CORPORATE_NUMBER', 
          label: 'Corporate Number', 
          format: '13 digits',
          pattern: /^[0-9]{13}$/,
          verificationMethod: 'NTA API',
          forBusinessOnly: true
        }
      ]
    }
  },
  
  'OTHER': {
    name: 'Other Countries',
    code: 'OTHER',
    productId: {
      primary: 'Private ID',
      formats: ['Private ID (PLK-*)'],
      registrar: 'Own-on-Chain',
      registrarUrl: null,
      prefixes: ['PLK'] // Private identifier
    },
    governmentId: {
      types: [
        { 
          value: 'PASSPORT', 
          label: 'Passport Number', 
          format: 'Varies by country',
          pattern: /^[A-Z0-9]{6,15}$/,
          verificationMethod: 'Manual Upload',
          forBusinessOnly: false
        },
        { 
          value: 'BUSINESS_REG', 
          label: 'Business Registration Number', 
          format: 'Varies by country',
          pattern: /^[A-Z0-9-]{5,20}$/,
          verificationMethod: 'Manual Upload',
          forBusinessOnly: true
        }
      ]
    }
  }
};

// List of all countries for dropdown (can be expanded)
export const COUNTRY_LIST = [
  { code: 'IND', name: 'India', flag: '🇮🇳' },
  { code: 'USA', name: 'United States', flag: '🇺🇸' },
  { code: 'GBR', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DEU', name: 'Germany', flag: '🇩🇪' },
  { code: 'FRA', name: 'France', flag: '🇫🇷' },
  { code: 'CHN', name: 'China', flag: '🇨🇳' },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵' },
  { code: 'CAN', name: 'Canada', flag: '🇨🇦' },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺' },
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷' },
  { code: 'OTHER', name: 'Other', flag: '🌍' }
];

/**
 * Get country standard by code
 */
export function getCountryStandard(countryCode) {
  return COUNTRY_STANDARDS[countryCode] || COUNTRY_STANDARDS['OTHER'];
}

/**
 * Validate product ID format for a specific country
 */
export function validateProductId(productId, countryCode) {
  const standard = getCountryStandard(countryCode);
  
  // For private IDs
  if (productId.startsWith('PLK-')) {
    return { valid: true, type: 'PRIVATE' };
  }
  
  // GTIN/EAN validation (basic check digit validation)
  if (standard.productId.formats.some(f => f.includes('GTIN') || f.includes('EAN') || f.includes('UPC'))) {
    return validateGTIN(productId);
  }
  
  // JAN validation (similar to GTIN)
  if (standard.productId.formats.some(f => f.includes('JAN'))) {
    return validateGTIN(productId);
  }
  
  return { valid: false, error: 'Invalid product ID format' };
}

/**
 * Validate GTIN/EAN/UPC check digit
 */
function validateGTIN(gtin) {
  // Remove any spaces or dashes
  gtin = gtin.replace(/[\s-]/g, '');
  
  // Must be numeric
  if (!/^[0-9]+$/.test(gtin)) {
    return { valid: false, error: 'GTIN must contain only digits' };
  }
  
  // Must be 8, 12, 13, or 14 digits
  const validLengths = [8, 12, 13, 14];
  if (!validLengths.includes(gtin.length)) {
    return { valid: false, error: `GTIN must be ${validLengths.join(', ')} digits` };
  }
  
  // Calculate check digit
  const digits = gtin.split('').map(Number);
  const checkDigit = digits.pop();
  
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * (i % 2 === (digits.length - 1) % 2 ? 3 : 1);
  }
  
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  
  if (calculatedCheckDigit !== checkDigit) {
    return { valid: false, error: 'Invalid GTIN check digit' };
  }
  
  return { valid: true, type: `GTIN-${gtin.length}` };
}

/**
 * Validate government ID format
 */
export function validateGovernmentId(govId, idType, countryCode) {
  const standard = getCountryStandard(countryCode);
  const idConfig = standard.governmentId.types.find(t => t.value === idType);
  
  if (!idConfig) {
    return { valid: false, error: 'Invalid ID type for this country' };
  }
  
  // Remove spaces and dashes for validation
  const cleanId = govId.replace(/[\s-]/g, '');
  
  if (!idConfig.pattern.test(cleanId)) {
    return { 
      valid: false, 
      error: `Invalid format. Expected: ${idConfig.format}` 
    };
  }
  
  return { valid: true, idType: idConfig.value };
}

/**
 * Generate private product ID
 */
export function generatePrivateProductId(countryCode, sequence) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const seqPadded = String(sequence).padStart(6, '0');
  return `PLK-${countryCode}-${timestamp}-${seqPadded}`;
}

