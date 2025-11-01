# Quick Setup Guide

Follow these steps to get Own-on-Chain running on your local machine.

## Prerequisites Installation

### 1. Install Node.js
Download and install Node.js v18 or higher from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version  # Should show v18.x.x or higher
npm --version
```

### 2. Install MetaMask
- Install MetaMask browser extension from [metamask.io](https://metamask.io/)
- Create a new wallet or import existing
- Switch to Polygon Mumbai Testnet:
  - Network Name: Mumbai Testnet
  - RPC URL: https://rpc-mumbai.maticvigil.com
  - Chain ID: 80001
  - Currency Symbol: MATIC
  - Block Explorer: https://mumbai.polygonscan.com

### 3. Get Test MATIC
Visit [Polygon Faucet](https://faucet.polygon.technology/) to get free Mumbai testnet MATIC

### 4. Create Pinata Account
1. Sign up at [pinata.cloud](https://app.pinata.cloud/)
2. Generate API keys from dashboard
3. Save API Key and Secret Key for later

## Project Setup

### Step 1: Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Configure Environment

Create `.env` file in root directory:
```env
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGON_RPC_URL=https://polygon-rpc.com
PRIVATE_KEY=your_metamask_private_key_here
POLYGONSCAN_API_KEY=your_polygonscan_api_key
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

**How to get your private key from MetaMask:**
1. Click on the 3 dots menu
2. Select "Account Details"
3. Click "Export Private Key"
4. Enter password
5. Copy the private key

⚠️ **Never share your private key or commit it to git!**

Create `frontend/.env` file:
```env
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET_KEY=your_pinata_secret_key
VITE_NETWORK_NAME=mumbai
VITE_CHAIN_ID=80001
```

### Step 3: Compile Smart Contracts

```bash
npm run compile
```

Expected output:
```
Compiled 15 Solidity files successfully
```

### Step 4: Run Tests

```bash
npm test
```

All tests should pass (30+ tests). This may take 1-2 minutes.

### Step 5: Deploy to Mumbai Testnet

```bash
npm run deploy:mumbai
```

This will:
1. Deploy all three contracts
2. Link contracts together
3. Save addresses and ABIs to frontend
4. Display deployment summary

Save the contract addresses shown in the output!

### Step 6: Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will start at: `http://localhost:5173`

## First Time Usage

### 1. Connect Wallet
- Open `http://localhost:5173` in your browser
- Click "Connect Wallet"
- MetaMask will popup - click "Connect"
- Ensure you're on Mumbai testnet

### 2. Register as Admin
Since you deployed the contracts, your wallet is automatically the admin!

### 3. Register Test Accounts
For testing, create multiple MetaMask accounts and register them:

**Account 1: Producer**
- Create new MetaMask account
- Get Mumbai MATIC from faucet
- Connect wallet to app
- Go to Register
- Select "Producer/Manufacturer"
- Fill in details
- Submit

**Switch back to admin account**
- Go to Admin Dashboard
- You'll see pending registration
- Click "Verify"

Repeat for:
- **Account 2**: Distributor
- **Account 3**: Retailer
- **Account 4**: Buyer

### 4. Test Full Flow

**As Producer (Account 1):**
1. Go to Producer Dashboard
2. Click "Create Product"
3. Fill in product details
4. Upload image (optional)
5. Submit and wait for confirmation
6. Note the Token ID

**As Producer → Distributor:**
1. In Producer Dashboard
2. Click "Transfer to Distributor"
3. Enter Account 2's address
4. Confirm

**As Distributor (Account 2):**
1. Go to Distributor Dashboard
2. Product should appear
3. Click "Transfer to Retailer"
4. Enter Account 3's address
5. Confirm

**As Retailer (Account 3):**
1. Go to Retailer Dashboard
2. Product should appear
3. Click "Sell to Buyer"
4. Enter Account 4's address
5. Confirm

**As Buyer (Account 4):**
1. Go to Buyer Dashboard
2. Product should appear in "My Products"
3. Click on product to view details
4. See complete transfer history

## Troubleshooting

### "Wrong Network" Warning
**Solution**: Switch MetaMask to Polygon Mumbai (Chain ID: 80001)

### Transaction Fails
**Solution**: Ensure you have Mumbai MATIC. Get more from faucet.

### "Contract not found"
**Solution**: Make sure you ran `npm run deploy:mumbai` and it completed successfully

### Frontend Won't Start
**Solution**: 
```bash
cd frontend
rm -rf node_modules
npm install
npm run dev
```

### IPFS Upload Fails
**Solution**: Check your Pinata API keys in `.env` files

### MetaMask Not Connecting
**Solution**: Refresh page, ensure MetaMask is unlocked, clear site data and try again

## Common Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Mumbai
npm run deploy:mumbai

# Start local Hardhat node (for development)
npm run node

# Deploy to local node
npm run deploy:local

# Start frontend
cd frontend && npm run dev

# Build frontend for production
cd frontend && npm run build
```

## Development Workflow

1. Make changes to smart contracts in `contracts/`
2. Run `npm run compile`
3. Run `npm test` to verify
4. Deploy to local node or testnet
5. Test in frontend
6. Iterate

## Next Steps

After successful setup:
1. Read [TESTING.md](./TESTING.md) for comprehensive testing guide
2. Explore [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for mainnet deployment
3. Check [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for architecture details
4. Review smart contract code in `contracts/`
5. Explore frontend code in `frontend/src/`

## Getting Help

If you encounter issues:
1. Check console for error messages
2. Review this guide again
3. Check Hardhat/Ethers.js documentation
4. Check Polygon/MetaMask documentation
5. Review contract tests for examples

## Security Reminders

- ✅ Never commit `.env` files
- ✅ Keep private keys secure
- ✅ Use test accounts for Mumbai
- ✅ Don't share your mnemonic phrase
- ✅ Always verify contract addresses
- ✅ Test thoroughly before mainnet

---

**Ready to go!** 🚀

Start exploring the decentralized ownership system you've just set up!

