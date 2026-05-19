#!/bin/bash

echo "🔧 Fixing Odoo Connection Issue..."
echo ""

# Check Docker
echo "1. Checking Docker..."
if ! docker info &> /dev/null; then
    echo "   ❌ Docker is not running!"
    echo "   → Please start Docker Desktop manually"
    echo "   → Then run this script again"
    exit 1
fi
echo "   ✅ Docker is running"

# Clean up
echo ""
echo "2. Cleaning up..."
docker stop odoo-test 2>/dev/null
docker rm odoo-test 2>/dev/null
echo "   ✅ Cleaned"

# Start Odoo
echo ""
echo "3. Starting Odoo..."
CONTAINER_ID=$(docker run -d --name odoo-test -p 8069:8069 odoo:latest 2>&1)
if [ $? -eq 0 ]; then
    echo "   ✅ Container started: $CONTAINER_ID"
else
    echo "   ❌ Failed to start: $CONTAINER_ID"
    exit 1
fi

# Wait and check
echo ""
echo "4. Waiting for Odoo (this takes 1-2 minutes)..."
for i in {1..24}; do
    sleep 5
    if curl -s http://localhost:8069 > /dev/null 2>&1; then
        echo ""
        echo "✅ SUCCESS! Odoo is ready!"
        echo ""
        echo "🌐 Access: http://localhost:8069"
        exit 0
    fi
    if [ $((i % 6)) -eq 0 ]; then
        echo "   Still starting... ($((i*5)) seconds)"
    fi
done

echo ""
echo "⏳ Odoo is still starting..."
echo "   Check: http://localhost:8069"
echo "   First startup takes 2-3 minutes"
echo ""
echo "Container status:"
docker ps --filter "name=odoo-test"
echo ""
echo "Recent logs:"
docker logs odoo-test 2>&1 | tail -5

