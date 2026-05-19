#!/bin/bash

echo "🚀 Starting Odoo ERP..."

# Stop existing
docker stop odoo-test 2>/dev/null
docker rm odoo-test 2>/dev/null

# Start Odoo
echo "📦 Pulling Odoo image (first time only, may take 2-3 minutes)..."
docker run -d \
  --name odoo-test \
  -p 8069:8069 \
  odoo:latest

echo ""
echo "✅ Odoo is starting..."
echo "⏳ Wait 1-2 minutes, then open: http://localhost:8069"
echo ""
echo "📋 First-time setup:"
echo "   Database: test_erp"
echo "   Email: admin@test.com"
echo "   Password: admin"
echo ""
echo "Checking status..."
sleep 10

if curl -s http://localhost:8069 > /dev/null; then
    echo "✅ Odoo is ready! Open: http://localhost:8069"
else
    echo "⏳ Still starting... Check: http://localhost:8069"
fi

