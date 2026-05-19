#!/bin/bash

echo "🔍 Diagnosing Odoo Connection Issue..."
echo ""

# Check Docker
echo "1. Checking Docker..."
if command -v docker &> /dev/null; then
    echo "   ✅ Docker is installed"
    docker --version
else
    echo "   ❌ Docker not found"
    exit 1
fi

# Check Docker daemon
echo ""
echo "2. Checking Docker daemon..."
if docker info &> /dev/null; then
    echo "   ✅ Docker daemon is running"
else
    echo "   ❌ Docker daemon not running"
    echo "   → Start Docker Desktop application"
    exit 1
fi

# Check Odoo container
echo ""
echo "3. Checking Odoo container..."
if docker ps -a | grep -q odoo-test; then
    echo "   ✅ Container exists"
    docker ps -a | grep odoo-test
else
    echo "   ⚠️  Container doesn't exist"
fi

# Check if running
echo ""
echo "4. Checking if container is running..."
if docker ps | grep -q odoo-test; then
    echo "   ✅ Container is running"
    docker ps | grep odoo-test
else
    echo "   ❌ Container is not running"
    echo "   → Starting container..."
    docker run -d --name odoo-test -p 8069:8069 odoo:latest
    echo "   ⏳ Wait 1-2 minutes for Odoo to start"
fi

# Check port
echo ""
echo "5. Checking port 8069..."
if lsof -i :8069 &> /dev/null; then
    echo "   ✅ Port 8069 is in use"
    lsof -i :8069
else
    echo "   ⚠️  Port 8069 is not in use"
    echo "   → Container may still be starting"
fi

# Check logs
echo ""
echo "6. Recent container logs:"
docker logs odoo-test 2>&1 | tail -5

# Test connection
echo ""
echo "7. Testing connection..."
if curl -s http://localhost:8069 > /dev/null 2>&1; then
    echo "   ✅ Odoo is accessible at http://localhost:8069"
else
    echo "   ❌ Odoo is not accessible"
    echo "   → Container may still be starting (wait 1-2 minutes)"
    echo "   → Check logs: docker logs odoo-test"
fi

echo ""
echo "📋 Summary:"
echo "   Container: $(docker ps --filter 'name=odoo-test' --format '{{.Names}}' 2>/dev/null || echo 'Not running')"
echo "   Status: $(docker ps --filter 'name=odoo-test' --format '{{.Status}}' 2>/dev/null || echo 'Not running')"
echo "   Access: http://localhost:8069"

