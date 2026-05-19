#!/bin/bash

# Send test webhook to create pending product

SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6"
WALLET="0xfed8e82bb1d254774fc694bc4e60f41fba80c09a"

# Create product data
TIMESTAMP=$(date +%s)
PRODUCT_DATA=$(cat <<EOF
{
  "productName": "Test Product $(date +%H:%M:%S)",
  "serialNumber": "SN-TEST-$TIMESTAMP",
  "description": "Test product from webhook",
  "category": "Electronics",
  "model": "TEST-MODEL",
  "productType": "physical",
  "warrantyPeriod": 365,
  "manufacturer": {
    "name": "Test Manufacturer",
    "country": "USA"
  }
}
EOF
)

# Create signature
SIGNATURE=$(echo -n "$PRODUCT_DATA" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
TIMESTAMP_MS=$(date +%s)000

echo "📤 Sending webhook..."
echo "Product: Test Product $(date +%H:%M:%S)"

# Send webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/webhooks/incoming \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP_MS" \
  -d "$PRODUCT_DATA")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo ""
echo "Status: $HTTP_CODE"
echo "Response: $BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "✅ Webhook sent successfully!"
  echo "📦 Check Producer Dashboard for pending product"
else
  echo ""
  echo "❌ Webhook failed"
fi

