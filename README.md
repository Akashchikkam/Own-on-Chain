# Own-on-Chain 🔗

**A Decentralized Product Ownership and Supply Chain Management System**

## 🎯 What is Own-on-Chain?

Own-on-Chain is a blockchain-based system that helps people prove and manage ownership of their products—both **physical things** (like phones, clothes, electronics) and **digital things** (like software licenses, NFTs, digital assets). 

The core idea is to link **every product to a unique digital ID on a blockchain**, making it easy to:
- ✅ **Verify ownership** - Know who owns what
- ✅ **Track purchase history** - See when and where it was bought
- ✅ **Transfer ownership** - Securely transfer products between parties
- ✅ **Maintain provenance** - Complete audit trail of product journey

## 🔑 Key Concept

Each product gets a **unique digital identity (NFT token)** stored on the blockchain. This token is:
- **Immutable** - Cannot be changed or faked
- **Transferable** - Can be moved between owners
- **Verifiable** - Anyone can check authenticity and ownership
- **Linked to metadata** - Stores product details, images, specifications on IPFS

## 🏗️ Current Development Status

**⚠️ This project is currently in active development.**

### ✅ What's Implemented

- **Product Ownership System**
  - Unique digital IDs (NFT tokens) for each product
  - Product metadata storage (images, descriptions, specifications)
  - Ownership tracking and verification on blockchain
  - Product transfer functionality

- **Supply Chain Management**
  - Multi-role system (Producer, Distributor, Retailer, Buyer)
  - Role-based access control
  - Supply chain tracking and audit trail
  - Flexible transfer system (anyone-to-anyone)

- **Decentralized Infrastructure**
  - Smart contracts deployed on Ethereum Sepolia testnet
  - IPFS for metadata and document storage
  - No centralized database - all data on blockchain

### 🚧 In Development / Planned

**User Identity System:**
- ⚠️ **User identities are not completely implemented yet**
- Currently, the system focuses on **building provable product history** using wallet addresses
- **Coming Soon:** User identity linking to real-world user IDs
- This will allow linking products to actual user profiles (KYC/identity verification)

**Next Steps:**
- Implement KYC/identity verification system
- Link wallet addresses to verified user identities
- Enhanced user profile system
- Social features (product sharing, ownership history)

## 🚀 Features

### For Producers/Manufacturers
- Create unique digital identities for products
- Upload product information (images, specs, warranty)
- Track products through supply chain

### For Distributors
- Receive products from producers
- Transfer to retailers
- Maintain inventory on blockchain

### For Retailers
- Receive products from distributors
- Sell to end customers (Buyers)
- Record sale details on blockchain

### For Buyers
- Verify product authenticity
- Check warranty status
- Transfer products (resell or gift)
- Complete ownership history

## 📋 Tech Stack

- **Blockchain:** Ethereum (Sepolia Testnet)
- **Smart Contracts:** Solidity
- **Frontend:** React 19, Vite, Ethers.js v6
- **Storage:** IPFS (Pinata)
- **Development:** Hardhat

## 🌐 Deployment

**Network:** Ethereum Sepolia Testnet  
**Chain ID:** 11155111

**Contract Addresses:**
- ParticipantRegistry: `0xB882B408727c752bEb54D7CA91750f2BDe38AAa0`
- ProductNFT: `0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59`
- SupplyChain: `0x64c647e4c3cA34C421b446F01EC5B7Cdd7ceDecF`

## 📦 Installation

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Run Hardhat node (for local testing)
npm run node

# Deploy contracts
npm run deploy:local

# Start frontend
cd frontend && npm run dev
```

## 🔐 Security & Privacy

- All product data is stored on decentralized infrastructure (blockchain + IPFS)
- No centralized server storing user data
- Ownership verified on-chain (cannot be faked)
- Role-based access control
- Verified participants only

## 📝 License

MIT

## 🤝 Contributing

This project is currently in active development. Contributions and feedback are welcome!

## 📧 Contact

For questions or issues, please open an issue on GitHub.

---

**Note:** This system is designed for provable product history and ownership tracking. User identity verification is planned for future implementation to enhance the system with real-world identity linking.

---

**Graphite Setup Test:** Testing Graphite CLI workflow for managing pull requests and stacks.
