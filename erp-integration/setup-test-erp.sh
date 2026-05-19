#!/bin/bash

# Quick setup for testing ERP integration
# Uses Docker to run a test ERP server

echo "🚀 Setting up Test ERP Server..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Installing..."
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Start test ERP server
cd "$(dirname "$0")/examples"

echo "📦 Starting Test ERP Server..."
WEBHOOK_SECRET="${WEBHOOK_SECRET:-c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6}" \
OWN_ON_CHAIN_URL="${OWN_ON_CHAIN_URL:-http://localhost:3001}" \
ERP_PORT="${ERP_PORT:-3002}" \
node erp-integration-complete.js

