#!/bin/bash

echo "🔍 Checking Odoo Status..."
echo ""

# Check if container exists
if docker ps -a | grep -q odoo-test; then
    echo "✅ Odoo container found"
    docker ps --filter "name=odoo-test" --format "   Status: {{.Status}}"
else
    echo "❌ Odoo container not found"
    echo "   Starting Odoo..."
    cd "$(dirname "$0")"
    docker run -d --name odoo-test -p 8069:8069 -v "$(pwd)/custom-addons:/mnt/extra-addons" odoo:latest
    echo "   ⏳ Wait 1-2 minutes for Odoo to start"
fi

echo ""
echo "🌐 Access Odoo at: http://localhost:8069"
echo ""

# Check if accessible
if curl -s http://localhost:8069 > /dev/null 2>&1; then
    echo "✅ Odoo is ready!"
else
    echo "⏳ Odoo is still starting..."
    echo "   First startup takes 1-2 minutes"
    echo "   Keep checking: http://localhost:8069"
fi

