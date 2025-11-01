import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { Role, RoleName, VerificationStatusName } from '../contracts/config';
import { participantRegistryService } from '../utils/contractHelpers';
import { uploadVerificationDocument } from '../utils/ipfs';
import './Register.css';

function Register() {
  const { signer, account, isConnected, provider } = useWeb3();
  const [role, setRole] = useState(Role.BUYER);
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [holderAddress, setHolderAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [existingRegistration, setExistingRegistration] = useState(null);

  // Check if user is already registered when component loads or account changes
  useEffect(() => {
    // Clear existing registration immediately when account changes to prevent stale data
    if (!isConnected || !account || !provider) {
      setExistingRegistration(null);
      setCheckingRegistration(false);
      setError('');
      return;
    }
    
    // Small delay to ensure state is cleared, then check registration
    const timer = setTimeout(() => {
      checkExistingRegistration();
    }, 150);
    
    return () => clearTimeout(timer);
  }, [isConnected, account, provider]);

  const checkExistingRegistration = async () => {
    if (!provider || !account) {
      setExistingRegistration(null);
      return;
    }
    
    // Verify account hasn't changed during async operation
    const currentAccount = account;
    
    try {
      setCheckingRegistration(true);
      setError(''); // Clear previous errors
      
      const participant = await participantRegistryService.getParticipant(provider, currentAccount);
      
      // Double-check account hasn't changed
      if (currentAccount !== account) {
        console.log('⚠️ Account changed during check, ignoring result');
        return;
      }
      
      // Check if participant exists (participantAddress != address(0))
      if (participant.participantAddress && 
          participant.participantAddress !== '0x0000000000000000000000000000000000000000') {
        // If rejected, allow re-registration - don't block the form
        if (Number(participant.status) === 2) { // REJECTED = 2
          setExistingRegistration(null); // Allow registration
          setError(''); // Clear any errors
        } else {
          // PENDING or VERIFIED - block registration
          setExistingRegistration(participant);
          setError('');
        }
      } else {
        setExistingRegistration(null);
      }
    } catch (err) {
      // Double-check account hasn't changed
      if (currentAccount !== account) {
        console.log('⚠️ Account changed during check, ignoring error');
        return;
      }
      
      // If participant not found, that's fine - they can register
      if (err.message && err.message.includes('Participant not found')) {
        setExistingRegistration(null);
      } else {
        console.error('Error checking registration:', err);
        // Don't show error if it's just "not found"
      }
    } finally {
      // Only update loading state if account hasn't changed
      if (currentAccount === account) {
        setCheckingRegistration(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    // Check if already registered before submitting
    // Allow re-registration if previously rejected
    if (existingRegistration && Number(existingRegistration.status) !== 2) {
      setError(`You are already registered as ${RoleName[Number(existingRegistration.role)]}. Status: ${VerificationStatusName[Number(existingRegistration.status)]}. You cannot register again with the same wallet address unless your previous registration was rejected.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Upload verification document to IPFS
      const documentData = {
        documentType,
        documentNumber,
        holderName,
        holderAddress,
        issuer: 'Self-submitted',
        issueDate: new Date().toISOString(),
        walletAddress: account,
      };

      const ipfsResult = await uploadVerificationDocument(documentData);
      
      if (!ipfsResult.success) {
        throw new Error('Failed to upload verification document to IPFS');
      }

      // Register participant on blockchain
      await participantRegistryService.register(
        signer,
        role,
        ipfsResult.ipfsUrl
      );

      setSuccess(true);
      setError('');
      
      // Reset form
      setDocumentType('');
      setDocumentNumber('');
      setHolderName('');
      setHolderAddress('');
      
      // Refresh registration status
      await checkExistingRegistration();
      
    } catch (err) {
      console.error('Registration error:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err.message) {
        if (err.message.includes('Already registered') || err.message.includes('cannot register again')) {
          // Check if user was rejected - if so, show helpful message
          try {
            const participant = await participantRegistryService.getParticipant(provider, account);
            if (Number(participant.status) === 2) { // REJECTED = 2
              errorMessage = 'Your previous registration was rejected, but the contract still has a record. Please refresh the page and try again. If the problem persists, the contracts may need to be redeployed.';
            } else {
              errorMessage = 'This wallet address is already registered. You cannot register multiple times with the same address unless your previous registration was rejected.';
            }
            // Refresh to get the existing registration
            await checkExistingRegistration();
          } catch (checkErr) {
            // If we can't check, show generic error
            errorMessage = 'This wallet address may already be registered. If your previous registration was rejected, please refresh the page and try again.';
            await checkExistingRegistration();
          }
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction was cancelled. Please try again if you want to register.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="register-page">
        <div className="card">
          <h2>Please Connect Wallet</h2>
          <p>You need to connect your wallet to register as a participant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <h1>Register as Participant</h1>
        <p className="subtitle">
          Register your account and submit verification documents for admin approval
        </p>

        {success && (
          <div className="alert alert-success">
            <strong>Success!</strong> Your registration has been submitted.
            An admin will review your application and verify your account.
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {checkingRegistration && (
          <div className="alert alert-info">
            Checking registration status...
          </div>
        )}

        {existingRegistration && (
          <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
            <strong>Already Registered!</strong>
            <p style={{ margin: '0.5rem 0 0 0' }}>
              Your wallet address is already registered as: <strong>{RoleName[Number(existingRegistration.role)]}</strong>
            </p>
            <p style={{ margin: '0.5rem 0 0 0' }}>
              Status: <strong>{VerificationStatusName[Number(existingRegistration.status)]}</strong>
              {existingRegistration.isActive && ' (Active)'}
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Registration Date: {new Date(Number(existingRegistration.registrationDate) * 1000).toLocaleString()}
            </p>
            {Number(existingRegistration.status) === 2 ? (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#28a745' }}>
                ✅ Your previous registration was rejected. You can register again with a new role or updated information.
              </p>
            ) : (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                ⚠️ You cannot register again with the same wallet address. Each wallet can only be registered once.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form card">
          <div className="input-group">
            <label htmlFor="role">Select Role *</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(Number(e.target.value))}
              required
            >
              <option value={Role.PRODUCER}>Producer/Manufacturer</option>
              <option value={Role.DISTRIBUTOR}>Distributor</option>
              <option value={Role.RETAILER}>Retailer/Seller</option>
              <option value={Role.BUYER}>Buyer/Consumer</option>
            </select>
            <small>Choose your role in the supply chain</small>
          </div>

          <div className="input-group">
            <label htmlFor="documentType">Verification Document Type *</label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              required
            >
              <option value="">Select document type</option>
              <option value="GST">GST Certificate (for businesses)</option>
              <option value="Aadhar">Aadhar Card (for individuals)</option>
              <option value="Business License">Business License</option>
              <option value="PAN">PAN Card</option>
              <option value="Other">Other Government ID</option>
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="documentNumber">Document Number *</label>
            <input
              type="text"
              id="documentNumber"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="Enter document number"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="holderName">Full Name *</label>
            <input
              type="text"
              id="holderName"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="Enter full name as per document"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="holderAddress">Address *</label>
            <textarea
              id="holderAddress"
              value={holderAddress}
              onChange={(e) => setHolderAddress(e.target.value)}
              placeholder="Enter complete address"
              rows="3"
              required
            />
          </div>

          <div className="alert alert-warning">
            <strong>Note:</strong> Your verification documents will be stored on IPFS and
            reviewed by an admin. This is a temporary verification process. In future updates,
            we will implement more decentralized verification methods.
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || checkingRegistration || existingRegistration !== null}
          >
            {loading ? (
              <>
                <span className="loading"></span> Submitting...
              </>
            ) : existingRegistration ? (
              'Already Registered'
            ) : (
              'Submit Registration'
            )}
          </button>
        </form>

        <div className="info-card card">
          <h3>What happens next?</h3>
          <ol>
            <li>Your registration is submitted to the blockchain</li>
            <li>An admin reviews your verification documents</li>
            <li>Upon approval, your account is verified and activated</li>
            <li>You can then access role-specific features</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default Register;

