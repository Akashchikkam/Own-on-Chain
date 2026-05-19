#!/bin/bash

# Start Test ERP Server (No Docker Required)

echo "🚀 Starting Test ERP Server..."

cd "$(dirname "$0")/examples"

WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6"
OWN_ON_CHAIN_URL="http://localhost:3001"
ERP_PORT=3002

echo "📦 Starting on port $ERP_PORT..."
echo ""

node erp-integration-complete.js

