import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import './Home.css';

function Home() {
  const { isConnected, connectWallet } = useWeb3();

  return (
    <div className="home">
      <section className="hero">
        <h1 className="hero-title">Decentralized Product Ownership</h1>
        <p className="hero-subtitle">
          Prove, track, and transfer ownership of physical and digital products on the blockchain
        </p>
        {!isConnected ? (
          <button onClick={connectWallet} className="btn btn-primary btn-large">
            Get Started
          </button>
        ) : (
          <Link to="/register" className="btn btn-primary btn-large">
            Register Now
          </Link>
        )}
      </section>

      <section className="features">
        <h2>Key Features</h2>
        <div className="grid grid-3">
          <div className="feature-card card">
            <h3>🔒 Secure Ownership</h3>
            <p>
              Blockchain-based proof of ownership that cannot be forged or manipulated
            </p>
          </div>
          <div className="feature-card card">
            <h3>📦 Supply Chain Tracking</h3>
            <p>
              Full transparency from manufacturer to end-buyer with verified chain of custody
            </p>
          </div>
          <div className="feature-card card">
            <h3>✅ Authenticity Verification</h3>
            <p>
              Verify genuine products and protect against counterfeits
            </p>
          </div>
          <div className="feature-card card">
            <h3>🔄 Easy Transfers</h3>
            <p>
              Securely transfer ownership for resale or gifting with complete history
            </p>
          </div>
          <div className="feature-card card">
            <h3>📜 Warranty Management</h3>
            <p>
              Automated warranty tracking and validation on the blockchain
            </p>
          </div>
          <div className="feature-card card">
            <h3>🌐 Decentralized Storage</h3>
            <p>
              Product metadata stored on IPFS for permanent, censorship-resistant access
            </p>
          </div>
        </div>
      </section>

      <section className="use-cases">
        <h2>Use Cases</h2>
        <div className="grid grid-2">
          <div className="use-case-card card">
            <h3>Manufacturers & Brands</h3>
            <ul>
              <li>Register products on blockchain</li>
              <li>Prevent counterfeiting</li>
              <li>Track distribution channels</li>
              <li>Manage warranty claims</li>
            </ul>
          </div>
          <div className="use-case-card card">
            <h3>Retailers & Distributors</h3>
            <ul>
              <li>Verify product authenticity</li>
              <li>Transparent supply chain</li>
              <li>Efficient inventory management</li>
              <li>Build customer trust</li>
            </ul>
          </div>
          <div className="use-case-card card">
            <h3>Consumers & Buyers</h3>
            <ul>
              <li>Prove ownership of products</li>
              <li>Access warranty information</li>
              <li>Resell with verified history</li>
              <li>Verify authenticity before purchase</li>
            </ul>
          </div>
          <div className="use-case-card card">
            <h3>Digital Products</h3>
            <ul>
              <li>Software licenses</li>
              <li>Digital subscriptions</li>
              <li>NFT-based services</li>
              <li>Transferable digital rights</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="workflow">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <h3>Register</h3>
            <p>Create an account and get verified as a producer, distributor, retailer, or buyer</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step">
            <div className="step-number">2</div>
            <h3>Create/Track</h3>
            <p>Manufacturers create products, track through supply chain to end customers</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step">
            <div className="step-number">3</div>
            <h3>Transfer</h3>
            <p>Securely transfer ownership between verified participants on the blockchain</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step">
            <div className="step-number">4</div>
            <h3>Verify</h3>
            <p>Anyone can verify authenticity, ownership history, and warranty status</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;

