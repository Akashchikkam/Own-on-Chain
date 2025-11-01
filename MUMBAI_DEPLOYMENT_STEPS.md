# 🚀 Mumbai Testnet Deployment - Step by Step

## ⚠️ Prerequisites

1. **MetaMask Wallet** with Mumbai testnet configured
2. **Test MATIC** in your wallet (get free MATIC from faucet)
3. **Private Key** from your deployer wallet
4. **Mumbai RPC URL** (free public RPC works)

---

## 📋 Step 1: Get Test MATIC

**You need MATIC to pay for gas fees on Mumbai testnet.**

1. Visit: https://faucet.polygon.technology/
2. Select "Mumbai" network
3. Enter your wallet address
4. Request test MATIC (you'll get 0.5 MATIC)
5. Wait for confirmation (usually instant)

**Minimum needed:** ~0.1 MATIC should be enough for deployment

---

## 📋 Step 2: Setup Environment Variables

Create a `.env` file in the **root directory** (`/Users/c.v.akash/Own-on-Chain/.env`):

```env
# Your wallet's private key (deployer account)
# ⚠️ NEVER commit this file to git!
PRIVATE_KEY=your_private_key_here

# Mumbai RPC URL (free public RPC)
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# Optional: Polygonscan API key for contract verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Optional: Polygon mainnet RPC (for future use)
POLYGON_RPC_URL=https://polygon-rpc.com
```

**How to get your private key:**
1. Open MetaMask
2. Click the account menu (3 dots)
3. Click "Account Details"
4. Click "Export Private Key"
5. Enter your password
6. Copy the private key (starts with `0x`)

**⚠️ SECURITY WARNING:**
- Never share your private key
- Never commit `.env` to git
- Use a separate wallet for testing (not your main wallet)

---

## 📋 Step 3: Compile Contracts

```bash
npm run compile
```

This will compile all Solidity contracts. Check for any errors.

---

## 📋 Step 4: Deploy to Mumbai

```bash
npm run deploy:mumbai
```

**What happens:**
1. Connects to Mumbai testnet
2. Deploys 3 contracts:
   - ParticipantRegistry
   - ProductNFT
   - SupplyChain
3. Links contracts together
4. Saves addresses to `frontend/src/contracts/deployment-mumbai.json`
5. Copies ABIs to frontend

**Expected output:**
```
Starting deployment...
Deploying contracts with account: 0x...
Account balance: 0.5 MATIC

1. Deploying ParticipantRegistry...
ParticipantRegistry deployed to: 0x...

2. Deploying ProductNFT...
ProductNFT deployed to: 0x...

3. Deploying SupplyChain...
SupplyChain deployed to: 0x...

✅ Deployment completed successfully!
```

**Cost:** ~0.05-0.1 MATIC for deployment

---

## 📋 Step 5: Update Frontend Configuration

Create/update `frontend/.env` file:

```env
VITE_NETWORK_NAME=mumbai
VITE_CHAIN_ID=80001
```

The frontend will automatically:
- Load contract addresses from `deployment-mumbai.json`
- Connect to Mumbai testnet
- Use Mumbai network configuration

---

## 📋 Step 6: Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will:
- Detect Mumbai network
- Load deployed contract addresses
- Allow you to interact with deployed contracts

---

## 📋 Step 7: Connect MetaMask to Mumbai

1. Open MetaMask
2. Click network dropdown
3. Select "Polygon Mumbai"
   - If not listed, add it:
     - Network Name: `Polygon Mumbai`
     - RPC URL: `https://rpc-mumbai.maticvigil.com`
     - Chain ID: `80001`
     - Currency Symbol: `MATIC`
     - Block Explorer: `https://mumbai.polygonscan.com`

---

## ✅ Verification Checklist

- [ ] Got test MATIC from faucet
- [ ] Created `.env` with PRIVATE_KEY
- [ ] Compiled contracts successfully
- [ ] Deployed to Mumbai successfully
- [ ] Got contract addresses from deployment
- [ ] Created `frontend/.env` with Mumbai config
- [ ] Frontend running and connecting to Mumbai
- [ ] MetaMask connected to Mumbai testnet

---

## 🔍 Verify Deployment

After deployment, you can:

1. **View on Polygonscan:**
   - Go to: https://mumbai.polygonscan.com/
   - Search your contract addresses
   - View transactions

2. **Test Registration:**
   - Connect wallet to frontend
   - Register as a participant
   - Should work on Mumbai now!

3. **Create Products:**
   - Register and verify as Producer
   - Create products
   - Data will persist permanently!

---

## 🆘 Troubleshooting

### "Insufficient funds"
- Get more MATIC from faucet: https://faucet.polygon.technology/

### "Network not found"
- Check RPC URL is correct
- Try alternative RPC: `https://matic-mumbai.chainstacklabs.com`

### "Invalid private key"
- Ensure private key starts with `0x`
- No spaces or extra characters
- Full 66 characters (0x + 64 hex chars)

### "Transaction failed"
- Check account has enough MATIC
- Check network is Mumbai (not mainnet)
- Try increasing gas limit in hardhat.config.js

---

## 📝 Next Steps After Deployment

1. **Verify Contracts** (optional but recommended):
   ```bash
   npx hardhat verify --network mumbai PARTICIPANT_REGISTRY_ADDRESS
   npx hardhat verify --network mumbai PRODUCT_NFT_ADDRESS
   npx hardhat verify --network mumbai SUPPLY_CHAIN_ADDRESS PARTICIPANT_REGISTRY_ADDRESS PRODUCT_NFT_ADDRESS
   ```

2. **Test Full Flow:**
   - Register all roles
   - Verify as admin
   - Create products
   - Test transfers
   - Verify data persists

3. **Save Contract Addresses:**
   - Keep the addresses from deployment
   - They're saved in `frontend/src/contracts/deployment-mumbai.json`

---

**Ready to deploy? Follow the steps above! 🚀**

