import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { participantRegistryService } from '../utils/contractHelpers';
import { formatAddress } from '../utils/contractHelpers';
import { RoleName, VerificationStatusName } from '../contracts/config';
import './Dashboard.css';

function AdminDashboard() {
  const { provider, signer, account, isConnected } = useWeb3();
  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isConnected) {
      loadPendingParticipants();
    }
  }, [isConnected]);

  const loadPendingParticipants = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading pending participants...');
      
      const addresses = await participantRegistryService.getPendingParticipants(provider);
      console.log('📋 Pending addresses:', addresses);
      
      const participantsData = await Promise.all(
        addresses.map(async (addr) => {
          const participant = await participantRegistryService.getParticipant(provider, addr);
          console.log(`👤 Participant ${addr}:`, participant);
          return {
            address: addr,
            ...participant
          };
        })
      );

      console.log('✅ All participants loaded:', participantsData);
      setPendingParticipants(participantsData);
    } catch (err) {
      console.error('❌ Error loading pending participants:', err);
      setError('Failed to load pending participants: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (participantAddress) => {
    try {
      setActionLoading(participantAddress);
      setError('');
      setSuccess('');

      console.log('🔄 Starting verification for:', participantAddress);
      await participantRegistryService.verifyParticipant(signer, participantAddress);

      setSuccess(`Participant ${formatAddress(participantAddress)} verified successfully!`);
      await loadPendingParticipants();
    } catch (err) {
      console.error('❌ Verification error:', err);
      
      let errorMessage = 'Failed to verify participant';
      
      // Extract meaningful error message
      if (err.reason) {
        errorMessage = err.reason;
      } else if (err.message) {
        if (err.message.includes('Only admin')) {
          errorMessage = err.message;
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (err.message.includes('Already processed')) {
          errorMessage = 'Participant already verified or rejected';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (participantAddress) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      setActionLoading(participantAddress);
      setError('');
      setSuccess('');

      await participantRegistryService.rejectParticipant(signer, participantAddress, reason);

      setSuccess(`Participant ${formatAddress(participantAddress)} rejected.`);
      await loadPendingParticipants();
    } catch (err) {
      console.error('Rejection error:', err);
      setError('Failed to reject participant');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="dashboard">
        <div className="card">
          <h2>Please Connect Wallet</h2>
          <p>Connect your wallet to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Review and approve participant registrations</p>
      </div>

      {success && (
        <div className="alert alert-success">{success}</div>
      )}

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className="card">
        <h2>Pending Verifications ({pendingParticipants.length})</h2>

        {loading ? (
          <div className="loading-container">
            <span className="loading"></span> Loading...
          </div>
        ) : pendingParticipants.length === 0 ? (
          <p className="empty-state">No pending verifications at this time.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Role</th>
                  <th>Registration Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingParticipants.map((participant) => (
                  <tr key={participant.address}>
                    <td>{formatAddress(participant.address)}</td>
                    <td>
                      <span className="badge badge-primary">
                        {RoleName[Number(participant.role)]}
                      </span>
                    </td>
                    <td>
                      {new Date(Number(participant.registrationDate) * 1000).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-success"
                          onClick={() => handleVerify(participant.address)}
                          disabled={actionLoading === participant.address}
                        >
                          {actionLoading === participant.address ? (
                            <>
                              <span className="loading"></span>
                            </>
                          ) : (
                            'Verify'
                          )}
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleReject(participant.address)}
                          disabled={actionLoading === participant.address}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;

