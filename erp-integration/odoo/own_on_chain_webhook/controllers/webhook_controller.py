import json
import hmac
import hashlib
import logging
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

class OwnOnChainWebhook(http.Controller):
    
    @http.route('/webhooks/own-on-chain', type='json', auth='none', methods=['POST'], csrf=False)
    def receive_webhook(self):
        """Receive webhooks from Own-on-Chain"""
        try:
            data = request.jsonrequest
            signature = request.httprequest.headers.get('X-Webhook-Signature')
            
            # Get webhook secret from system parameter
            webhook_secret = request.env['ir.config_parameter'].sudo().get_param('own_on_chain.webhook_secret', '')
            
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
            _logger.error(f"Error processing webhook: {e}")
            return {'error': str(e)}
    
    def _handle_product_created(self, data):
        """Handle product.created event"""
        _logger.info(f"Product created: {data.get('tokenId')}")
        # Create or update product in Odoo
        # You can customize this to match your product structure
        product = request.env['product.product'].sudo()
        # Add your product creation logic here
        
    def _handle_product_transferred(self, data):
        """Handle product.transferred event"""
        _logger.info(f"Product transferred: {data.get('tokenId')}")
        # Update product ownership in Odoo
        # Add your transfer logic here
        
    def _handle_product_received(self, data):
        """Handle product.received event"""
        _logger.info(f"Product received: {data.get('tokenId')}")
        # Update product status in Odoo
        # Add your receipt logic here
        
    def _handle_product_burned(self, data):
        """Handle product.burned event"""
        _logger.info(f"Product burned: {data.get('tokenId')}")
        # Mark product as deleted in Odoo
        # Add your deletion logic here

