import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { formatAddress } from '../utils/contractHelpers';
import './Layout.css';

function Layout({ children }) {
  const { account, isConnected, connectWallet, disconnectWallet, isCorrectNetwork } = useWeb3();

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="container navbar-content">
          <div className="navbar-brand">
            <Link to="/">
              <h1>Own-on-Chain</h1>
            </Link>
          </div>
          
          <div className="navbar-links">
            {isConnected && (
              <>
                <Link to="/register">Register</Link>
                <Link to="/producer">Producer</Link>
                <Link to="/distributor">Distributor</Link>
                <Link to="/retailer">Retailer</Link>
                <Link to="/buyer">Buyer</Link>
                <Link to="/admin">Admin</Link>
              </>
            )}
          </div>

          <div className="navbar-actions">
            {!isConnected ? (
              <button onClick={connectWallet} className="btn btn-primary">
                Connect Wallet
              </button>
            ) : (
              <div className="wallet-info">
                {!isCorrectNetwork && (
                  <span className="badge badge-error">Wrong Network</span>
                )}
                <span className="wallet-address">{formatAddress(account)}</span>
                <button onClick={disconnectWallet} className="btn btn-secondary">
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="container">
          {children}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 Own-on-Chain. Decentralized Product Ownership System.</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;

