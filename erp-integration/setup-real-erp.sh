#!/bin/bash

# Setup Real ERP Integration
# Choose your ERP and follow the setup steps

echo "🔗 Real ERP Integration Setup"
echo "=============================="
echo ""

echo "Which ERP do you want to set up?"
echo ""
echo "1. Odoo (Open Source ERP)"
echo "2. QuickBooks Online"
echo "3. Custom ERP (Your existing system)"
echo "4. ERPNext Cloud"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "📦 Setting up Odoo..."
    echo ""
    echo "Option A: Docker (Recommended)"
    echo "  docker run -d -p 8069:8069 --name odoo odoo:latest"
    echo ""
    echo "Option B: Use our setup script"
    echo "  cd erp-integration/odoo && ./setup-odoo.sh"
    echo ""
    echo "After Odoo is running:"
    echo "  1. Open http://localhost:8069"
    echo "  2. Create database"
    echo "  3. Install Inventory app"
    echo "  4. Configure webhook endpoint"
    ;;
  2)
    echo ""
    echo "📦 QuickBooks Online Setup"
    echo ""
    echo "1. Go to https://developer.intuit.com"
    echo "2. Create app → Get Client ID & Secret"
    echo "3. Configure OAuth"
    echo "4. Use QuickBooks API"
    echo ""
    echo "See: erp-integration/REAL_ERP_SETUP.md for details"
    ;;
  3)
    echo ""
    echo "📦 Custom ERP Setup"
    echo ""
    echo "Your ERP needs:"
    echo "  1. Webhook endpoint: POST /webhooks/own-on-chain"
    echo "  2. HMAC signature verification"
    echo "  3. Product creation API"
    echo ""
    echo "Steps:"
    echo "  1. Expose webhook endpoint"
    echo "  2. Register in Producer Dashboard"
    echo "  3. Configure webhook secret"
    echo "  4. Test bidirectional sync"
    ;;
  4)
    echo ""
    echo "📦 ERPNext Cloud Setup"
    echo ""
    echo "1. Sign up: https://frappecloud.com (free tier)"
    echo "2. Create site"
    echo "3. Install ERPNext"
    echo "4. Configure webhooks"
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "✅ Setup guide created!"
echo "See erp-integration/REAL_ERP_SETUP.md for detailed instructions"

