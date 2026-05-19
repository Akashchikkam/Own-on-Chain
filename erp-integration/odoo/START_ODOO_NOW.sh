#!/bin/bash

echo "🚀 Starting Odoo with Docker..."
echo ""

# Clean up old container
docker stop odoo-test 2>/dev/null
docker rm odoo-test 2>/dev/null

# Start Odoo
echo "📦 Pulling Odoo image (first time only, may take 2-3 minutes)..."
cd "$(dirname "$0")"
docker run -d \
  --name odoo-test \
  -p 8069:8069 \
  -v "$(pwd)/custom-addons:/mnt/extra-addons" \
  odoo:latest

echo ""
echo "✅ Odoo container started!"
echo ""
echo "⏳ Waiting for Odoo to be ready (1-2 minutes)..."
echo ""

# Wait and check
for i in {1..12}; do
  sleep 10
  if curl -s http://localhost:8069 > /dev/null 2>&1; then
    echo "✅ Odoo is ready!"
    echo ""
    echo "🌐 Access Odoo at: http://localhost:8069"
    echo ""
    echo "📋 First-time setup:"
    echo "   Database: test_erp"
    echo "   Email: admin@test.com"
    echo "   Password: admin"
    exit 0
  fi
  echo "   Still starting... ($i/12)"
done

echo ""
echo "⏳ Odoo is still starting..."
echo "   Check manually: http://localhost:8069"
echo "   First startup can take 2-3 minutes"
echo ""
echo "Check status: docker ps | grep odoo"
echo "Check logs: docker logs odoo-test"

