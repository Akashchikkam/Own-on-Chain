# Own-on-Chain: Decentralized Product Ownership System

A complete blockchain-based platform for managing and proving ownership of physical and digital products using Polygon blockchain, smart contracts, and IPFS. The system provides transparent tracking from manufacturing through the entire supply chain to end-consumers and secondary market transfers.

## 🎯 What is Own-on-Chain?

Own-on-Chain enables anyone to:
- **Prove Ownership**: Blockchain-verified proof of product ownership
- **Track Provenance**: Complete supply chain history from manufacturer to buyer
- **Verify Authenticity**: Check if products are genuine before purchase
- **Transfer Ownership**: Securely sell or gift products with full history
- **Manage Warranties**: Automated warranty tracking and validation
- **Support Both Physical & Digital**: Works for everything from phones to software licenses

## ✨ Key Features

- ✅ **Decentralized Ownership**: No central authority controls the records
- ✅ **Supply Chain Tracking**: Full transparency from manufacturer to end-buyer
- ✅ **NFT-Based Products**: Each product is a unique ERC-721 token
- ✅ **Role-Based Access**: Producers, distributors, retailers, and buyers
- ✅ **IPFS Storage**: Decentralized, permanent metadata storage
- ✅ **Secondary Market**: Easy peer-to-peer resales
- ✅ **Warranty Management**: Automated warranty period tracking
- ✅ **Authenticity Verification**: Verify genuine products
- ✅ **Complete History**: Every transfer recorded permanently

## 🏗️ Architecture

### Smart Contracts
- **ParticipantRegistry**: Role registration and verification (Producer, Distributor, Retailer, Buyer)
- **ProductNFT**: ERC-721 tokens representing products with metadata and transfer history
- **SupplyChain**: Main orchestration contract for product lifecycle management

### Frontend
- **React + Vite**: Modern web application
- **MetaMask Integration**: Wallet connection and transaction signing
- **Role-Specific Dashboards**: Custom interfaces for each participant type
- **Product Details**: Complete history and metadata visualization

### Storage
- **IPFS (Pinata)**: Decentralized storage for product metadata, images, and documents
- **Polygon Blockchain**: Cost-effective, fast transactions for ownership records

## 🚀 Quick Start

### 1. Prerequisites
- Node.js v18+
- MetaMask browser extension
- Mumbai testnet MATIC ([Get from faucet](https://faucet.polygon.technology/))
- Pinata account ([Sign up](https://app.pinata.cloud/))

### 2. Installation

```bash
# Clone repository
git clone <repository-url>
cd Own-on-Chain

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Setup environment
cp .env.example .env
# Edit .env with your keys

# Compile contracts
npm run compile

# Run tests (30+ test cases)
npm test

# Deploy to Mumbai testnet
npm run deploy:mumbai

# Start frontend
cd frontend && npm run dev
```

Visit `http://localhost:5173` to access the application.

### 3. First Steps
1. Connect MetaMask (ensure you're on Mumbai testnet)
2. Register as a participant (Producer, Distributor, Retailer, or Buyer)
3. Admin verifies your registration
4. Access your role-specific dashboard
5. Start managing products!

## 📖 Documentation

- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[TESTING.md](./TESTING.md)** - Comprehensive testing guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview

## 🧪 Testing

### Run Smart Contract Tests
```bash
npm test
```

Covers:
- ✅ Participant registration and verification
- ✅ Role-based access control
- ✅ Product creation and NFT minting
- ✅ All transfer types (supply chain, direct, secondary)
- ✅ Warranty management
- ✅ Transfer history tracking
- ✅ Authenticity verification

### End-to-End Testing
See [TESTING.md](./TESTING.md) for detailed E2E testing scenarios covering:
- Full supply chain flow (Producer → Distributor → Retailer → Buyer)
- Direct sale flow (Producer → Buyer)
- Secondary market flow (Buyer → Buyer)
- Warranty verification
- Admin operations

## 📦 Project Structure

```
Own-on-Chain/
├── contracts/              # Solidity smart contracts
│   ├── ParticipantRegistry.sol
│   ├── ProductNFT.sol
│   └── SupplyChain.sol
├── scripts/                # Deployment automation
│   ├── deploy.js
│   └── verify.js
├── test/                   # Comprehensive test suite
│   ├── ParticipantRegistry.test.js
│   ├── ProductNFT.test.js
│   └── SupplyChain.test.js
├── metadata/               # IPFS schemas and utilities
│   ├── product-schema.json
│   ├── example-*.json
│   └── utils/ipfs.js
├── frontend/               # React web application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Dashboard pages
│   │   ├── context/        # Web3 context
│   │   ├── utils/          # Contract helpers
│   │   └── contracts/      # ABIs and config
│   └── package.json
├── hardhat.config.js       # Hardhat configuration
├── package.json
├── README.md               # This file
├── SETUP.md                # Setup guide
├── TESTING.md              # Testing guide
├── DEPLOYMENT_GUIDE.md     # Deployment instructions
└── PROJECT_SUMMARY.md      # Complete overview
```

## 💻 Tech Stack

**Blockchain**
- Polygon (Low gas fees, fast transactions)
- Solidity 0.8.20
- OpenZeppelin Contracts
- Hardhat Development Environment
- Ethers.js v6

**Storage**
- IPFS (via Pinata)
- JSON metadata schemas

**Frontend**
- React 19
- Vite (Build tool)
- React Router v6
- MetaMask integration
- Custom CSS

## 🎭 User Roles

### Producer/Manufacturer
- Create products with detailed metadata
- Register products on blockchain as NFTs
- Transfer to distributors or sell directly
- View product inventory

### Distributor
- Receive products from producers
- Forward products to retailers
- Track inventory

### Retailer/Seller
- Receive products from distributors or producers
- Sell products to buyers
- Manage available inventory

### Buyer/Consumer
- Purchase products from retailers
- View owned products with full history
- Resell products in secondary market
- Check warranty status

### Admin
- Verify participant registrations
- Approve/reject applications
- Manage system participants

## 🔒 Security Features

- ✅ Role-based access control
- ✅ Ownership verification for all transfers
- ✅ Verified participant checks
- ✅ Immutable metadata on IPFS
- ✅ Smart contract security best practices
- ✅ OpenZeppelin battle-tested contracts

## 🌐 Deployment

### Testnet (Mumbai)
```bash
npm run deploy:mumbai
```

### Mainnet (Polygon)
```bash
npm run deploy:polygon
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions.

## 📊 Use Cases

### For Manufacturers
- Prevent counterfeiting
- Track distribution
- Manage warranties
- Build brand trust

### For Retailers
- Verify authenticity
- Transparent supply chain
- Easy inventory management
- Customer confidence

### For Consumers
- Prove ownership
- Verify authenticity before purchase
- Easy resale with history
- Warranty tracking

### For Digital Products
- Software licenses
- Digital subscriptions
- NFT-based services
- Transferable digital rights

## 🛣️ Roadmap

### Phase 1 (✅ Completed)
- ✅ Core smart contracts
- ✅ Full supply chain support
- ✅ Web application with all dashboards
- ✅ IPFS integration
- ✅ Comprehensive testing
- ✅ Documentation

### Phase 2 (Planned)
- Multi-language support
- Mobile application
- QR code generation
- Advanced analytics
- Bulk operations
- Email notifications

### Phase 3 (Future)
- Multi-chain support
- Decentralized verification (DAO)
- Marketplace integration
- IoT integration
- AI fraud detection

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

Need help?
- Check [SETUP.md](./SETUP.md) for setup issues
- See [TESTING.md](./TESTING.md) for testing questions
- Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment help
- Open an issue on GitHub

## 🙏 Acknowledgments

- OpenZeppelin for secure contract libraries
- Polygon for scalable blockchain infrastructure
- IPFS/Pinata for decentralized storage
- Hardhat for development tools
- React and Vite teams

---

**Status**: ✅ Production Ready  
**Network**: Polygon Mumbai (Testnet) / Polygon (Mainnet Ready)  
**Version**: 1.0.0

Built with ❤️ for a decentralized future of product ownership.

