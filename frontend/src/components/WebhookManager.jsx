import { useState, useEffect } from 'react';
import { getBackendApiUrl } from '../utils/api';
import './WebhookManager.css';

function WebhookManager({ account, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [viewingLogs, setViewingLogs] = useState(null);
  const [logs, setLogs] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    url: '',
    events: ['product.created', 'product.transferred']
  });

  useEffect(() => {
    if (account) {
      loadWebhooks();
    }
  }, [account]);

  const loadWebhooks = async () => {
    if (!account) return;
    
    try {
      setLoading(true);
      setError('');
      const response = await fetch(
        `${getBackendApiUrl('/webhooks/list')}?walletAddress=${account}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load webhooks');
      }
      
      const result = await response.json();
      if (result.success) {
        setWebhooks(result.data || []);
      }
    } catch (err) {
      console.error('Error loading webhooks:', err);
      setError(err.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!formData.url) {
      setError('Webhook URL is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(getBackendApiUrl('/webhooks/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formData.url,
          walletAddress: account,
          events: formData.events
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to register webhook');
      }

      setSuccess(`Webhook registered! Secret key: ${result.secret}`);
      setFormData({ url: '', events: ['product.created', 'product.transferred'] });
      setShowRegisterForm(false);
      await loadWebhooks();
      
      // Show secret key in alert (user should save it)
      alert(`⚠️ IMPORTANT: Save this secret key - it will not be shown again!\n\nSecret: ${result.secret}`);
    } catch (err) {
      console.error('Error registering webhook:', err);
      setError(err.message || 'Failed to register webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (webhookId) => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(
        `${getBackendApiUrl(`/webhooks/${webhookId}`)}?walletAddress=${account}`,
        {
          method: 'DELETE'
        }
      );

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete webhook');
      }

      setSuccess('Webhook deleted successfully');
      await loadWebhooks();
    } catch (err) {
      console.error('Error deleting webhook:', err);
      setError(err.message || 'Failed to delete webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (webhookId) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(getBackendApiUrl(`/webhooks/${webhookId}/toggle`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to toggle webhook');
      }

      setSuccess(`Webhook ${result.data.active ? 'activated' : 'deactivated'}`);
      await loadWebhooks();
    } catch (err) {
      console.error('Error toggling webhook:', err);
      setError(err.message || 'Failed to toggle webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (webhookId) => {
    try {
      setTestingWebhook(webhookId);
      setError('');
      
      const response = await fetch(getBackendApiUrl(`/webhooks/${webhookId}/test`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to test webhook');
      }

      if (result.data.success) {
        setSuccess('Test webhook delivered successfully!');
      } else {
        setError(`Test failed: ${result.data.statusText || 'Unknown error'}`);
      }
      
      await loadWebhooks();
    } catch (err) {
      console.error('Error testing webhook:', err);
      setError(err.message || 'Failed to test webhook');
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleViewLogs = async (webhookId) => {
    try {
      setViewingLogs(webhookId);
      setError('');
      
      const response = await fetch(
        `${getBackendApiUrl(`/webhooks/${webhookId}/logs`)}?walletAddress=${account}&limit=50`
      );

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load logs');
      }

      setLogs(result.data || []);
    } catch (err) {
      console.error('Error loading logs:', err);
      setError(err.message || 'Failed to load logs');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const validEvents = ['product.created', 'product.transferred', 'product.received', 'product.burned'];

  console.log('WebhookManager rendering, account:', account);

  return (
    <div className="webhook-manager">
      <div className="webhook-manager-header">
        <h2>🔗 Webhook Management</h2>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message" style={{ marginBottom: '1rem' }}>
          {success}
        </div>
      )}

      <div className="webhook-actions">
        <button
          className="btn btn-primary"
          onClick={() => setShowRegisterForm(!showRegisterForm)}
        >
          {showRegisterForm ? 'Cancel' : '+ Register New Webhook'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={loadWebhooks}
          disabled={loading}
        >
          {loading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {showRegisterForm && (
        <div className="webhook-register-form">
          <h3>Register New Webhook</h3>
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Webhook URL *</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://your-erp-system.com/webhook"
                required
              />
              <small>Your ERP system endpoint that will receive webhook notifications</small>
            </div>

            <div className="form-group">
              <label>Events to Subscribe</label>
              <div className="event-checkboxes">
                {validEvents.map(event => (
                  <label key={event} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            events: [...formData.events, event]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            events: formData.events.filter(ev => ev !== event)
                          });
                        }
                      }}
                    />
                    <span>{event}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Registering...' : 'Register Webhook'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowRegisterForm(false);
                  setFormData({ url: '', events: ['product.created', 'product.transferred'] });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="webhooks-list">
        <h3>Your Webhooks ({webhooks.length})</h3>
        
        {loading && webhooks.length === 0 ? (
          <div className="loading">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="empty-state">
            <p>No webhooks registered yet.</p>
            <p>Register a webhook to receive automatic notifications when products are created or transferred.</p>
          </div>
        ) : (
          <div className="webhooks-grid">
            {webhooks.map(webhook => (
              <div key={webhook.id} className={`webhook-card ${!webhook.active ? 'inactive' : ''}`}>
                <div className="webhook-card-header">
                  <div>
                    <h4>{webhook.url}</h4>
                    <span className={`status-badge ${webhook.active ? 'active' : 'inactive'}`}>
                      {webhook.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    className="btn-toggle"
                    onClick={() => handleToggle(webhook.id)}
                    title={webhook.active ? 'Deactivate' : 'Activate'}
                  >
                    {webhook.active ? '⏸️' : '▶️'}
                  </button>
                </div>

                <div className="webhook-info">
                  <div className="info-row">
                    <span className="label">Events:</span>
                    <span className="value">
                      {webhook.events.map(e => (
                        <span key={e} className="event-tag">{e}</span>
                      ))}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">Deliveries:</span>
                    <span className="value">
                      {webhook.deliveryCount} total
                      {' '}({webhook.successCount} success, {webhook.failureCount} failed)
                    </span>
                  </div>
                  {webhook.lastTriggered && (
                    <div className="info-row">
                      <span className="label">Last Triggered:</span>
                      <span className="value">{formatDate(webhook.lastTriggered)}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="label">Created:</span>
                    <span className="value">{formatDate(webhook.createdAt)}</span>
                  </div>
                </div>

                <div className="webhook-actions">
                  <button
                    className="btn btn-small btn-primary"
                    onClick={() => handleTest(webhook.id)}
                    disabled={testingWebhook === webhook.id || !webhook.active}
                  >
                    {testingWebhook === webhook.id ? 'Testing...' : '🧪 Test'}
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => handleViewLogs(webhook.id)}
                  >
                    📋 Logs
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleDelete(webhook.id)}
                    disabled={loading}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingLogs && (
        <div className="webhook-logs-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Webhook Delivery Logs</h3>
              <button className="btn-close" onClick={() => setViewingLogs(null)}>✕</button>
            </div>
            <div className="logs-content">
              {logs.length === 0 ? (
                <p>No logs yet.</p>
              ) : (
                <div className="logs-list">
                  {logs.map(log => (
                    <div key={log.id} className={`log-entry ${log.result.success ? 'success' : 'failed'}`}>
                      <div className="log-header">
                        <span className="log-event">{log.event}</span>
                        <span className="log-time">{formatDate(log.timestamp)}</span>
                      </div>
                      <div className="log-result">
                        {log.result.success ? (
                          <span className="success">✅ Success ({log.result.status})</span>
                        ) : (
                          <span className="failed">
                            ❌ Failed ({log.result.status} {log.result.statusText})
                          </span>
                        )}
                      </div>
                      {log.result.error && (
                        <div className="log-error">{log.result.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebhookManager;

