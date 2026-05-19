#!/bin/bash

echo "🚀 Starting Docker and Odoo..."
echo ""

# Step 1: Start Docker Desktop
echo "1. Starting Docker Desktop..."
if ! docker info &> /dev/null; then
    echo "   Docker is not running, attempting to start..."
    open -a Docker 2>/dev/null || open -a "Docker Desktop" 2>/dev/null
    
    echo "   ⏳ Waiting for Docker to start (30 seconds)..."
    for i in {1..30}; do
        sleep 1
        if docker info &> /dev/null; then
            echo "   ✅ Docker is running!"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "   ⚠️  Docker didn't start automatically"
            echo "   → Please start Docker Desktop manually from Applications"
            echo "   → Then run this script again"
            exit 1
        fi
    done
else
    echo "   ✅ Docker is already running"
fi

# Step 2: Clean up old container
echo ""
echo "2. Cleaning up old Odoo container..."
docker stop odoo-test 2>/dev/null
docker rm odoo-test 2>/dev/null

# Step 3: Start Odoo
echo ""
echo "3. Starting Odoo container..."
docker run -d --name odoo-test -p 8069:8069 odoo:latest

if [ $? -eq 0 ]; then
    echo "   ✅ Odoo container started"
else
    echo "   ❌ Failed to start container"
    exit 1
fi

# Step 4: Wait and check
echo ""
echo "4. Waiting for Odoo to be ready..."
echo "   ⏳ This takes 1-2 minutes on first startup..."
echo ""

for i in {1..12}; do
    sleep 10
    if curl -s http://localhost:8069 > /dev/null 2>&1; then
        echo ""
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

