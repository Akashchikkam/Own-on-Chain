import express from 'express';
import axios from 'axios';
import { COUNTRY_STANDARDS, COUNTRY_LIST, getCountryStandard } from '../product-ids/country-standards.js';

export const router = express.Router();

/**
 * GET /api/country/detect
 * Auto-detect user's country from IP address
 */
router.get('/detect', async (req, res) => {
  try {
    // Get client IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress;
    
    console.log('Detecting country for IP:', clientIp);
    
    // For localhost/development, return default
    if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp?.includes('localhost')) {
      return res.json({
        country: 'IND', // Default to India for development
        name: 'India',
        confidence: 'development',
        source: 'localhost'
      });
    }
    
    // Use free IP geolocation service
    try {
      const geoResponse = await axios.get(`http://ip-api.com/json/${clientIp}`, {
        timeout: 5000
      });
      
      if (geoResponse.data && geoResponse.data.status === 'success') {
        const countryCode = geoResponse.data.countryCode;
        const country = COUNTRY_LIST.find(c => c.code === countryCode);
        
        return res.json({
          country: country?.code || 'OTHER',
          name: country?.name || geoResponse.data.country,
          confidence: 'high',
          source: 'ip-geolocation',
          details: {
            city: geoResponse.data.city,
            region: geoResponse.data.regionName
          }
        });
      }
    } catch (geoError) {
      console.warn('IP geolocation failed:', geoError.message);
    }
    
    // Fallback
    res.json({
      country: 'OTHER',
      name: 'Other',
      confidence: 'low',
      source: 'fallback'
    });
    
  } catch (error) {
    console.error('Country detection error:', error);
    res.status(500).json({ 
      error: 'Failed to detect country',
      country: 'OTHER' // Fallback
    });
  }
});

/**
 * GET /api/country/list
 * Get list of all supported countries
 */
router.get('/list', (req, res) => {
  res.json({
    countries: COUNTRY_LIST
  });
});

/**
 * GET /api/country/standards/:countryCode
 * Get product ID standards and government ID requirements for a country
 */
router.get('/standards/:countryCode', (req, res) => {
  const { countryCode } = req.params;
  const standard = getCountryStandard(countryCode);
  
  if (!standard) {
    return res.status(404).json({ error: 'Country not found' });
  }
  
  res.json({
    country: countryCode,
    standard
  });
});

/**
 * GET /api/country/government-ids/:countryCode
 * Get government ID types for a specific country
 */
router.get('/government-ids/:countryCode', (req, res) => {
  const { countryCode } = req.params;
  const standard = getCountryStandard(countryCode);
  
  if (!standard) {
    return res.status(404).json({ error: 'Country not found' });
  }
  
  res.json({
    country: countryCode,
    governmentIds: standard.governmentId.types
  });
});

