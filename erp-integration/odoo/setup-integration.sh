#!/bin/bash

# Setup Own-on-Chain Integration in Odoo

echo "🔗 Setting up Own-on-Chain Integration in Odoo..."

# Create custom addon directory
mkdir -p custom-addons/own_on_chain_integration

# Create __init__.py
cat > custom-addons/own_on_chain_integration/__init__.py << 'EOF'
from . import models
from . import controllers
EOF

# Create __manifest__.py
cat > custom-addons/own_on_chain_integration/__manifest__.py << 'EOF'
{
    'name': 'Own-on-Chain Integration',
    'version': '1.0.0',
    'category': 'Inventory',
    'summary': 'Integrate Odoo with Own-on-Chain blockchain',
    'description': """
        Own-on-Chain Integration
        ========================
        - Send products to Own-on-Chain
        - Receive webhooks from Own-on-Chain
        - Sync product data
    """,
    'depends': ['base', 'product', 'stock'],
    'data': [
        'views/product_views.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
EOF

# Create models directory
mkdir -p custom-addons/own_on_chain_integration/models
mkdir -p custom-addons/own_on_chain_integration/controllers
mkdir -p custom-addons/own_on_chain_integration/views
mkdir -p custom-addons/own_on_chain_integration/security

# Create models/__init__.py
cat > custom-addons/own_on_chain_integration/models/__init__.py << 'EOF'
from . import product_template
EOF

# Create product_template.py model
cat > custom-addons/own_on_chain_integration/models/product_template.py << 'EOF'
from odoo import models, fields, api
import requests
import hmac
import hashlib
import json
from datetime import datetime

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    own_on_chain_token_id = fields.Char(string='Own-on-Chain Token ID', readonly=True)
    own_on_chain_status = fields.Selection([
        ('not_synced', 'Not Synced'),
        ('pending', 'Pending Approval'),
        ('synced', 'Synced to Blockchain'),
        ('error', 'Error')
    ], string='Own-on-Chain Status', default='not_synced', readonly=True)
    own_on_chain_url = fields.Char(string='Own-on-Chain URL', default='http://localhost:3001')
    own_on_chain_secret = fields.Char(string='Webhook Secret', required=False)

    def send_to_own_on_chain(self):
        """Send product to Own-on-Chain"""
        self.ensure_one()
        
        if not self.own_on_chain_secret:
            raise UserError("Webhook secret is required. Set it in product settings.")
        
        # Prepare product data
        product_data = {
            'productName': self.name,
            'serialNumber': self.default_code or f'ODOO-{self.id}',
            'description': self.description or '',
            'category': self.categ_id.name if self.categ_id else '',
            'model': self.default_code or '',
            'productType': 'physical',
            'warrantyPeriod': 365,
            'manufacturer': {
                'name': self.company_id.name if self.company_id else 'Unknown',
                'country': 'USA'
            }
        }
        
        # Create signature
        timestamp = str(int(datetime.now().timestamp() * 1000))
        signature = hmac.new(
            self.own_on_chain_secret.encode('utf-8'),
            json.dumps(product_data).encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Send to Own-on-Chain
        url = f"{self.own_on_chain_url}/api/webhooks/incoming"
        headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp
        }
        
        try:
            response = requests.post(url, json=product_data, headers=headers, timeout=10)
            if response.status_code == 200:
                result = response.json()
                self.own_on_chain_status = 'pending'
                self.message_post(body=f"Product sent to Own-on-Chain. Pending ID: {result.get('pendingProductId')}")
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': 'Success',
                        'message': 'Product sent to Own-on-Chain. Waiting for approval.',
                        'type': 'success',
                        'sticky': False,
                    }
                }
            else:
                raise Exception(f"Error: {response.status_code} - {response.text}")
        except Exception as e:
            self.own_on_chain_status = 'error'
            self.message_post(body=f"Error sending to Own-on-Chain: {str(e)}")
            raise UserError(f"Failed to send product: {str(e)}")
EOF

# Create controllers/__init__.py
cat > custom-addons/own_on_chain_integration/controllers/__init__.py << 'EOF'
from . import webhook_controller
EOF

# Create webhook controller
cat > custom-addons/own_on_chain_integration/controllers/webhook_controller.py << 'EOF'
from odoo import http
import json
import hmac
import hashlib
import logging

_logger = logging.getLogger(__name__)

class OwnOnChainWebhook(http.Controller):
    
    @http.route('/webhooks/own-on-chain', type='json', auth='none', methods=['POST'], csrf=False)
    def receive_webhook(self):
        """Receive webhooks from Own-on-Chain"""
        try:
            data = http.request.jsonrequest
            signature = http.request.httprequest.headers.get('X-Webhook-Signature')
            
            # Get webhook secret from system parameter
            webhook_secret = http.request.env['ir.config_parameter'].sudo().get_param('own_on_chain.webhook_secret', '')
            
            if not webhook_secret:
                _logger.warning("Webhook secret not configured")
                return {'error': 'Webhook secret not configured'}
            
            # Verify signature
            expected_signature = hmac.new(
                webhook_secret.encode('utf-8'),
                json.dumps(data).encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected_signature):
                _logger.warning("Invalid webhook signature")
                return {'error': 'Invalid signature'}
            
            event = data.get('event')
            event_data = data.get('data', {})
            
            _logger.info(f"Received webhook: {event}")
            
            # Process event
            if event == 'product.created':
                self._handle_product_created(event_data)
            elif event == 'product.transferred':
                self._handle_product_transferred(event_data)
            elif event == 'product.received':
                self._handle_product_received(event_data)
            elif event == 'product.burned':
                self._handle_product_burned(event_data)
            
            return {'success': True, 'message': 'Webhook processed'}
            
        except Exception as e:
            _logger.error(f"Error processing webhook: {str(e)}")
            return {'error': str(e)}
    
    def _handle_product_created(self, data):
        """Handle product.created event"""
        token_id = data.get('tokenId')
        product_name = data.get('productName')
        
        # Find product by name or create log
        products = http.request.env['product.template'].sudo().search([('name', '=', product_name)])
        if products:
            products[0].write({
                'own_on_chain_token_id': str(token_id),
                'own_on_chain_status': 'synced'
            })
            products[0].message_post(body=f"Product created on Own-on-Chain. Token ID: {token_id}")
            _logger.info(f"Updated product {product_name} with token ID {token_id}")
    
    def _handle_product_transferred(self, data):
        """Handle product.transferred event"""
        token_id = data.get('tokenId')
        _logger.info(f"Product {token_id} transferred")
        # Add your logic here
    
    def _handle_product_received(self, data):
        """Handle product.received event"""
        token_id = data.get('tokenId')
        _logger.info(f"Product {token_id} received")
        # Add your logic here
    
    def _handle_product_burned(self, data):
        """Handle product.burned event"""
        token_id = data.get('tokenId')
        _logger.info(f"Product {token_id} burned")
        # Add your logic here
EOF

# Create views
cat > custom-addons/own_on_chain_integration/views/product_views.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="product_template_form_view_inherit" model="ir.ui.view">
        <field name="name">product.template.form.inherit.own.on.chain</field>
        <field name="model">product.template</field>
        <field name="inherit_id" ref="product.product_template_form_view"/>
        <field name="arch" type="xml">
            <xpath expr="//field[@name='description']" position="after">
                <group string="Own-on-Chain Integration">
                    <field name="own_on_chain_token_id"/>
                    <field name="own_on_chain_status"/>
                    <field name="own_on_chain_url"/>
                    <field name="own_on_chain_secret" password="True"/>
                    <button name="send_to_own_on_chain" string="Send to Own-on-Chain" type="object" class="btn-primary"/>
                </group>
            </xpath>
        </field>
    </record>
</odoo>
EOF

# Create security file
cat > custom-addons/own_on_chain_integration/security/ir.model.access.csv << 'EOF'
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_product_template_own_on_chain,product.template.own.on.chain,product.model_product_template,base.group_user,1,1,1,1
EOF

echo ""
echo "✅ Integration module created!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart Odoo container:"
echo "      docker restart odoo-own-on-chain"
echo ""
echo "   2. In Odoo:"
echo "      - Go to Apps menu"
echo "      - Remove 'Apps' filter"
echo "      - Search 'Own-on-Chain Integration'"
echo "      - Click Install"
echo ""
echo "   3. Configure:"
echo "      - Go to Settings → Technical → Parameters → System Parameters"
echo "      - Create: Key: own_on_chain.webhook_secret, Value: (your secret)"
echo ""
echo "   4. Test:"
echo "      - Create a product in Odoo"
echo "      - Click 'Send to Own-on-Chain' button"
echo "      - Check Producer Dashboard for pending product"

