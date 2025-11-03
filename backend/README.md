# Own-on-Chain Backend API

Backend API server for the Own-on-Chain product identity layer. Provides country-specific product ID standards, government ID verification, and webhook endpoints for ERP integration.

## Features

- 🌍 **Country Detection:** Auto-detect user country from IP address
- 🆔 **Government ID Verification:** Support for GSTIN, VAT, EIN, and more
- 📋 **Product ID Standards:** Country-specific GTIN/UPC/EAN/JAN standards
- 🔗 **Webhook System:** (Coming soon) ERP integration endpoints
- 🔐 **Secure:** Helmet.js security headers, CORS configuration

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Blockchain:** Ethers.js v6 (Ethereum/Sepolia)
- **Database:** PostgreSQL (planned)
- **Verification:** Axios for external APIs

## Installation

```bash
cd backend
npm install
```

## Configuration

Create a `.env` file in the `backend/` directory:

```env
# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (future use)
DATABASE_URL=postgresql://user:pass@localhost:5432/ownonchain

# Ethereum
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SERVER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# Smart Contract Addresses
PARTICIPANT_REGISTRY_ADDRESS=0xYourAddress
PRODUCT_NFT_ADDRESS=0xYourAddress
SUPPLY_CHAIN_ADDRESS=0xYourAddress

# IPFS / Pinata
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# JWT
JWT_SECRET=your_jwt_secret_here

# Government ID Verification APIs
GST_API_KEY=your_gst_api_key
UIDAI_API_KEY=your_uidai_api_key
```

## Running the Server

### Development Mode
```bash
npm run dev    # Uses nodemon for auto-restart
```

### Production Mode
```bash
npm start
```

Server will start on `http://localhost:3001` (or the PORT specified in .env)

## API Endpoints

### Health Check
```http
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-02T...",
  "service": "Own-on-Chain Backend API"
}
```

### Country Detection
```http
GET /api/country/detect
```

Auto-detects country from IP address using free geolocation service.

Response:
```json
{
  "country": "IND",
  "name": "India",
  "confidence": "high",
  "source": "ip-geolocation",
  "details": {
    "city": "Mumbai",
    "region": "Maharashtra"
  }
}
```

### List Countries
```http
GET /api/country/list
```

Returns all supported countries with flags.

Response:
```json
{
  "countries": [
    { "code": "IND", "name": "India", "flag": "🇮🇳" },
    { "code": "USA", "name": "United States", "flag": "🇺🇸" },
    ...
  ]
}
```

### Get Country Standards
```http
GET /api/country/standards/:countryCode
```

Returns product ID standards and government ID requirements for a specific country.

Example: `GET /api/country/standards/IND`

Response:
```json
{
  "country": "IND",
  "standard": {
    "name": "India",
    "productId": {
      "primary": "GTIN-13/EAN-13",
      "formats": ["GTIN-13", "EAN-13", "GTIN-14"],
      "registrar": "GS1 India",
      "prefixes": ["890"]
    },
    "governmentId": {
      "types": [
        {
          "value": "GSTIN",
          "label": "GSTIN (GST Identification Number)",
          "format": "15 alphanumeric characters",
          "verificationMethod": "GST API",
          "forBusinessOnly": true
        },
        ...
      ]
    }
  }
}
```

### Get Government ID Types
```http
GET /api/country/government-ids/:countryCode
```

Returns available government ID types for a country.

Example: `GET /api/country/government-ids/USA`

Response:
```json
{
  "country": "USA",
  "governmentIds": [
    {
      "value": "EIN",
      "label": "EIN (Employer Identification Number)",
      "format": "9 digits (XX-XXXXXXX)",
      "verificationMethod": "IRS Database",
      "forBusinessOnly": true
    },
    ...
  ]
}
```

### Verify Government ID
```http
POST /api/verify/government-id
Content-Type: application/json

{
  "countryCode": "IND",
  "idType": "GSTIN",
  "idNumber": "29AABCU9603R1ZM",
  "additionalInfo": {}
}
```

Verifies government ID based on country and type. Some countries support automatic verification (e.g., EU VAT via VIES), others require manual review.

Response:
```json
{
  "success": true,
  "countryCode": "IND",
  "idType": "GSTIN",
  "verified": false,
  "status": "pending_manual",
  "message": "Manual verification required by admin"
}
```

### Send OTP (Aadhaar - India only)
```http
POST /api/verify/send-otp
Content-Type: application/json

{
  "aadhaarNumber": "123456789012",
  "mobileNumber": "+919876543210"
}
```

### Verify OTP
```http
POST /api/verify/verify-otp
Content-Type: application/json

{
  "sessionId": "session_123...",
  "otp": "123456"
}
```

### Check Verification Status
```http
GET /api/verify/status/:walletAddress
```

## Directory Structure

```
backend/
├── server.js                    # Main Express server
├── package.json                 # Dependencies
├── .env.example                 # Environment variables template
├── config/
│   └── database.js              # Database configuration (future)
├── api/
│   └── country.js               # Country endpoints
├── verification/
│   ├── verification-routes.js   # Verification endpoints
│   ├── india-gstin.js           # India GSTIN verification
│   └── eu-vat.js                # EU VAT verification (VIES)
├── product-ids/
│   └── country-standards.js     # Country standards config
├── blockchain/
│   └── contract-service.js      # (Future) Contract interactions
├── webhooks/
│   └── webhook-controller.js    # (Future) Webhook endpoints
├── payments/
│   └── stripe-handler.js        # (Future) Stripe integration
└── utils/
    └── qr-sheet-pdf.js          # (Future) QR sheet generator
```

## Supported Countries

### Current Support
- 🇮🇳 **India:** GSTIN, Aadhaar, PAN
- 🇺🇸 **USA:** EIN, SSN
- 🇬🇧 **UK:** VAT, Company Number
- 🇩🇪 **Germany:** VAT ID
- 🇫🇷 **France:** VAT, SIREN
- 🇨🇳 **China:** USCC
- 🇯🇵 **Japan:** Corporate Number
- 🌍 **Others:** Passport, Business Registration

### Verification Methods
- **Automatic:** EU VAT (via VIES API - free)
- **Manual:** Most other countries (admin review required)
- **OTP:** Aadhaar (India) - requires UIDAI API integration

## Product ID Standards

Each country has specific product identification standards:

| Country | Primary Standard | Formats | Registrar |
|---------|-----------------|---------|-----------|
| India | GTIN-13/EAN-13 | GTIN-13, EAN-13, GTIN-14 | GS1 India |
| USA | UPC-A | UPC-A, UPC-E, GTIN-12 | GS1 US |
| UK | GTIN-13/GTIN-14 | GTIN-13, GTIN-14 | GS1 UK |
| Germany | EAN-13 | EAN-13, EAN-8, GTIN-13 | GS1 Germany |
| France | EAN-13 | EAN-13, EAN-8, GTIN-13 | GS1 France |
| China | GTIN-13 | GTIN-13 (prefix 690-699) | GS1 China |
| Japan | JAN | JAN-13, JAN-8 | GS1 Japan |
| Other | Private ID | PLK-* format | Own-on-Chain |

## External Services

### IP Geolocation
- Service: `http://ip-api.com/json/{ip}`
- Free tier: 45 requests/minute
- Fallback: Returns "OTHER" if detection fails

### EU VAT Verification (VIES)
- Service: `http://ec.europa.eu/taxation_customs/vies/services/checkVatService`
- Free EU service
- SOAP API
- Returns company name and address if valid

### Future Integrations
- GST API (India) - for GSTIN verification
- UIDAI API (India) - for Aadhaar OTP verification
- IRS Database (USA) - for EIN verification via Stripe Identity
- HMRC API (UK) - for VAT/Company Number verification

## Error Handling

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "message": "Detailed description",
  "details": "Additional context"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `500` - Internal Server Error

## Security

- **Helmet.js:** Security headers
- **CORS:** Configured for frontend origin only
- **Rate Limiting:** (Future) To prevent abuse
- **Input Validation:** All inputs validated before processing
- **No Plaintext IDs:** Government IDs are hashed (sha256) before blockchain storage

## Development

### Adding a New Country

1. Update `backend/product-ids/country-standards.js`:
```javascript
export const COUNTRY_STANDARDS = {
  ...
  'BRA': {
    name: 'Brazil',
    code: 'BRA',
    productId: {
      primary: 'GTIN-13',
      formats: ['GTIN-13', 'EAN-13'],
      registrar: 'GS1 Brazil',
      prefixes: ['789', '790']
    },
    governmentId: {
      types: [
        {
          value: 'CNPJ',
          label: 'CNPJ (Company Registration)',
          format: '14 digits',
          pattern: /^[0-9]{14}$/,
          verificationMethod: 'Manual',
          forBusinessOnly: true
        }
      ]
    }
  }
};
```

2. Add to `COUNTRY_LIST`:
```javascript
export const COUNTRY_LIST = [
  ...
  { code: 'BRA', name: 'Brazil', flag: '🇧🇷' }
];
```

3. (Optional) Add verification service in `backend/verification/brazil-cnpj.js`

### Testing

```bash
# Test health check
curl http://localhost:3001/api/health

# Test country detection
curl http://localhost:3001/api/country/detect

# Test country standards
curl http://localhost:3001/api/country/standards/IND

# Test government ID verification
curl -X POST http://localhost:3001/api/verify/government-id \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"IND","idType":"GSTIN","idNumber":"29AABCU9603R1ZM"}'
```

## Troubleshooting

### Server won't start
- Check if port 3001 is already in use: `lsof -i :3001`
- Verify all dependencies are installed: `npm install`
- Check .env file exists and is properly formatted

### Country detection not working
- Ensure internet connection is available
- Check IP geolocation service is not rate-limited
- Fallback will default to "IND" for localhost

### CORS errors
- Verify `FRONTEND_URL` in .env matches your frontend URL
- Check that frontend is running on the specified port

## Future Enhancements

- [ ] Database integration (PostgreSQL)
- [ ] Webhook system for ERP integration
- [ ] Product ID → Token ID mapping database
- [ ] API key management for third-party access
- [ ] Rate limiting and request throttling
- [ ] Comprehensive logging system
- [ ] Admin dashboard API
- [ ] Batch verification endpoints
- [ ] Webhook retry logic with exponential backoff
- [ ] QR sheet PDF generation endpoint

## License

MIT

## Support

For issues or questions, please open an issue in the GitHub repository.

---

**Backend Status:** ✅ Running  
**Version:** 1.0.0  
**Last Updated:** November 2, 2025

