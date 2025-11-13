#!/usr/bin/env python3
"""
Simple webhook test server
Run: python3 test-webhook-server.py
Then use ngrok to expose it: ngrok http 3002
"""

from flask import Flask, request, jsonify
from datetime import datetime
import json

app = Flask(__name__)

# Store received webhooks
received_webhooks = []

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Webhook-Signature')
    timestamp = request.headers.get('X-Webhook-Timestamp')
    
    print('\n📥 Webhook Received!')
    print(f'Timestamp: {timestamp}')
    print(f'Signature: {signature}')
    print(f'Body: {json.dumps(request.json, indent=2)}')
    
    # Store webhook
    received_webhooks.append({
        'timestamp': datetime.now().isoformat(),
        'signature': signature,
        'body': request.json
    })
    
    return jsonify({
        'success': True,
        'message': 'Webhook received successfully',
        'receivedAt': datetime.now().isoformat()
    })

@app.route('/webhooks', methods=['GET'])
def list_webhooks():
    return jsonify({
        'count': len(received_webhooks),
        'webhooks': received_webhooks
    })

@app.route('/webhooks', methods=['DELETE'])
def clear_webhooks():
    received_webhooks.clear()
    return jsonify({'message': 'Webhooks cleared'})

if __name__ == '__main__':
    print('\n🚀 Webhook Test Server running on http://localhost:3002')
    print('📡 Webhook endpoint: http://localhost:3002/webhook')
    print('\n📋 To expose publicly, run: ngrok http 3002')
    print('   Then use the ngrok URL in your webhook registration\n')
    app.run(port=3002, debug=True)

