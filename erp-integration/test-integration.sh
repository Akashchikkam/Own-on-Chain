#!/bin/bash

# Complete ERP Integration Test Script

echo "🧪 Testing ERP Integration..."
echo ""

# Configuration
WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6"
ERP_URL="http://localhost:3002"
OWN_ON_CHAIN_URL="http://localhost:3001"

# Step 1: Start ERP Server
echo "📦 Step 1: Starting Test ERP Server..."
cd "$(dirname "$0")/examples"
WEBHOOK_SECRET="$WEBHOOK_SECRET" \
OWN_ON_CHAIN_URL="$OWN_ON_CHAIN_URL" \
ERP_PORT=3002 \
node erp-integration-complete.js &
ERP_PID=$!

sleep 3
echo "✅ ERP Server started (PID: $ERP_PID)"
echo ""

# Step 2: Check if Own-on-Chain is running
echo "📦 Step 2: Checking Own-on-Chain backend..."
if curl -s "$OWN_ON_CHAIN_URL/api/health" > /dev/null; then
    echo "✅ Own-on-Chain backend is running"
else
    echo "❌ Own-on-Chain backend not running!"
    echo "   Start it with: cd backend && npm run dev"
    kill $ERP_PID 2>/dev/null
    exit 1
fi
echo ""

# Step 3: Register webhook (manual step)
echo "📋 Step 3: Register Webhook (Manual)"
echo "   1. Go to Producer Dashboard: http://localhost:5173"
echo "   2. Click '🔗 Webhooks'"
echo "   3. Register: $ERP_URL/webhooks/own-on-chain"
echo "   4. Copy the secret key shown"
echo ""
read -p "Press Enter when webhook is registered..."

# Step 4: Test sending product from ERP
echo ""
echo "📤 Step 4: Sending product from ERP to Own-on-Chain..."
PRODUCT_RESPONSE=$(curl -s -X POST "$ERP_URL/api/products/create" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Test Product from ERP",
    "serialNumber": "SN-ERP-TEST-'$(date +%s)'",
    "description": "Testing ERP integration",
    "category": "Electronics",
    "model": "ERP-TEST-001",
    "productType": "physical",
    "warrantyPeriod": 365,
    "manufacturer": {
      "name": "Test Manufacturer",
      "country": "USA"
    }
  }')

echo "$PRODUCT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PRODUCT_RESPONSE"
echo ""

# Step 5: Check pending products
echo "📋 Step 5: Check Producer Dashboard for pending product"
echo "   → Go to Producer Dashboard"
echo "   → Scroll to 'Pending Product Requests'"
echo "   → Click '✅ Approve & Create'"
echo ""
read -p "Press Enter after approving product..."

# Step 6: Check ERP received webhook
echo ""
echo "📥 Step 6: Checking if ERP received product.created webhook..."
sleep 2
curl -s "$ERP_URL/api/products" | python3 -m json.tool | head -30
echo ""

echo "✅ Integration test complete!"
echo ""
echo "To stop ERP server: kill $ERP_PID"

