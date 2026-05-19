#!/bin/bash

# Setup Odoo for Own-on-Chain Integration

echo "🚀 Setting up Odoo ERP..."

# Create data directory
mkdir -p odoo-data
mkdir -p postgres-data

# Stop existing containers
docker stop odoo-own-on-chain postgres-own-on-chain 2>/dev/null
docker rm odoo-own-on-chain postgres-own-on-chain 2>/dev/null

# Start PostgreSQL
echo "📦 Starting PostgreSQL..."
docker run -d \
  --name postgres-own-on-chain \
  -e POSTGRES_USER=odoo \
  -e POSTGRES_PASSWORD=odoo \
  -e POSTGRES_DB=postgres \
  -v "$(pwd)/postgres-data:/var/lib/postgresql/data" \
  postgres:13

sleep 3

# Start Odoo
echo "📦 Starting Odoo..."
docker run -d \
  --name odoo-own-on-chain \
  --link postgres-own-on-chain:db \
  -p 8069:8069 \
  -v "$(pwd)/odoo-data:/var/lib/odoo" \
  -v "$(pwd)/custom-addons:/mnt/extra-addons" \
  -e HOST=postgres-own-on-chain \
  -e USER=odoo \
  -e PASSWORD=odoo \
  odoo:latest

sleep 5

echo ""
echo "✅ Odoo is starting..."
echo "📋 Access Odoo at: http://localhost:8069"
echo ""
echo "📝 First-time setup:"
echo "   1. Create database: test_erp"
echo "   2. Email: admin@test.com (any email)"
echo "   3. Password: admin (or your choice)"
echo "   4. Language: English"
echo "   5. Country: Your country"
echo "   6. Click 'Create Database'"
echo ""
echo "⏳ Waiting for Odoo to be ready..."
sleep 10

# Check if Odoo is ready
if curl -s http://localhost:8069 > /dev/null; then
    echo "✅ Odoo is ready!"
    echo ""
    echo "🔗 Open: http://localhost:8069"
else
    echo "⏳ Odoo is still starting... (this may take 1-2 minutes)"
    echo "   Check: http://localhost:8069"
fi

echo ""
echo "📋 Next: Run integration setup"
echo "   cd /Users/c.v.akash/Own-on-Chain/erp-integration/odoo"
echo "   ./setup-integration.sh"

