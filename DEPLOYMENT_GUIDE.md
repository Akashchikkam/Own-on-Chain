# Deployment Guide

Step-by-step guide to deploy Own-on-Chain to Polygon Mumbai testnet and mainnet.

## Prerequisites

- Node.js v18 or higher
- MetaMask wallet
- MATIC tokens (Mumbai for testnet, MATIC for mainnet)
- Pinata account for IPFS
- Polygonscan API key (for verification)

## Environment Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd Own-on-Chain
   npm install
   cd frontend && npm install && cd ..
   ```

2. **Configure Environment Variables**
   
   Create `.env` in root directory:
   ```env
   # Private key of deployer wallet (KEEP SECRET!)
   PRIVATE_KEY=your_private_key_here
   
   # RPC URLs
   MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
   POLYGON_RPC_URL=https://polygon-rpc.com
   
   # Polygonscan API key for contract verification
   POLYGONSCAN_API_KEY=your_api_key
   
   # Pinata for IPFS
   PINATA_API_KEY=your_pinata_api_key
   PINATA_SECRET_KEY=your_pinata_secret_key
   ```

   Create `frontend/.env`:
   ```env
   VITE_PINATA_API_KEY=your_pinata_api_key
   VITE_PINATA_SECRET_KEY=your_pinata_secret_key
   VITE_NETWORK_NAME=mumbai
   VITE_CHAIN_ID=80001
   ```

## Mumbai Testnet Deployment

### Step 1: Get Test MATIC

Visit [Polygon Faucet](https://faucet.polygon.technology/) to get free Mumbai MATIC.

### Step 2: Compile Contracts

```bash
npm run compile
```

Verify compilation succeeded. Check for any errors.

### Step 3: Run Tests

```bash
npm test
```

Ensure all tests pass before deployment.

### Step 4: Deploy to Mumbai

```bash
npm run deploy:mumbai
```

Expected output:
```
Starting deployment...
Deploying contracts with account: 0x...
Account balance: 2.5 MATIC

1. Deploying ParticipantRegistry...
ParticipantRegistry deployed to: 0x...

2. Deploying ProductNFT...
ProductNFT deployed to: 0x...

3. Deploying SupplyChain...
SupplyChain deployed to: 0x...

4. Setting SupplyChain contract in ProductNFT...
SupplyChain contract set in ProductNFT

5. Deployment info saved to: frontend/src/contracts/deployment-mumbai.json

6. Copying ABIs to frontend...
  - ParticipantRegistry ABI copied
  - ProductNFT ABI copied
  - SupplyChain ABI copied

✅ Deployment completed successfully!
```

### Step 5: Verify Contracts (Optional but Recommended)

```bash
npx hardhat verify --network mumbai PARTICIPANT_REGISTRY_ADDRESS
npx hardhat verify --network mumbai PRODUCT_NFT_ADDRESS
npx hardhat verify --network mumbai SUPPLY_CHAIN_ADDRESS PARTICIPANT_REGISTRY_ADDRESS PRODUCT_NFT_ADDRESS
```

Or use the verification script:
```bash
node scripts/verify.js
```

### Step 6: Update Frontend Configuration

The deployment script automatically:
- Saves contract addresses to `frontend/src/contracts/deployment-mumbai.json`
- Copies ABIs to `frontend/src/contracts/`

Verify files were created:
```bash
ls frontend/src/contracts/
# Should show:
# - deployment-mumbai.json
# - ParticipantRegistry.json
# - ProductNFT.json
# - SupplyChain.json
```

### Step 7: Start Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` and test the application.

## Polygon Mainnet Deployment

⚠️ **Warning:** Mainnet deployment costs real MATIC. Test thoroughly on Mumbai first!

### Step 1: Get MATIC

Purchase MATIC from exchanges and transfer to your deployer wallet.
Recommended: Have at least 0.5 MATIC for deployment and initial testing.

### Step 2: Update Environment

Update `.env`:
```env
POLYGON_RPC_URL=https://polygon-rpc.com
# Or use Infura/Alchemy for better reliability
```

Update `frontend/.env`:
```env
VITE_NETWORK_NAME=polygon
VITE_CHAIN_ID=137
```

### Step 3: Final Testing

Run complete test suite one more time:
```bash
npm test
```

### Step 4: Deploy to Mainnet

```bash
npm run deploy:polygon
```

⚠️ **Review transaction costs before confirming each transaction!**

### Step 5: Verify on Polygonscan

```bash
# Update network to 'polygon' in verify script
node scripts/verify.js
```

Verification makes your contract code public and verifiable.

### Step 6: Update Frontend

Contract addresses automatically saved to `deployment-polygon.json`.

Build frontend for production:
```bash
cd frontend
npm run build
```

### Step 7: Deploy Frontend

Deploy the `frontend/dist` folder to your hosting service:

**Option A: Vercel**
```bash
npm install -g vercel
cd frontend
vercel
```

**Option B: Netlify**
```bash
npm install -g netlify-cli
cd frontend
netlify deploy --prod --dir=dist
```

**Option C: IPFS (Fully Decentralized)**
```bash
# Build first
npm run build

# Upload dist folder to IPFS via Pinata or Fleek
```

## Post-Deployment Tasks

### 1. Test All Flows

- [ ] Register accounts for all roles
- [ ] Admin verification workflow
- [ ] Create test product
- [ ] Complete full supply chain flow
- [ ] Test direct sale
- [ ] Test secondary market transfer
- [ ] Verify all data on Polygonscan

### 2. Set Up Admin Access

The deployer account is the contract owner/admin. To add more admins:

1. Consider implementing multi-sig for admin operations
2. Document admin procedures
3. Secure admin private keys properly

### 3. Monitor Gas Usage

Track gas costs for common operations:
- Product creation
- Transfers
- Registrations

Optimize if necessary.

### 4. Set Up Monitoring

Consider setting up:
- Contract event monitoring (TheGraph, Moralis)
- Error tracking (Sentry)
- Analytics (Google Analytics, Plausible)

### 5. Documentation

Update your documentation with:
- Deployed contract addresses
- Frontend URL
- Admin contacts
- User guides

## Troubleshooting

### Deployment Fails

**Error: "Insufficient funds"**
- Solution: Add more MATIC to deployer wallet

**Error: "Transaction underpriced"**
- Solution: Increase gas price in `hardhat.config.js`

**Error: "Nonce too high"**
- Solution: Reset MetaMask account or adjust nonce manually

### Verification Fails

**Error: "Already verified"**
- Solution: Contract is already verified, no action needed

**Error: "Compiler version mismatch"**
- Solution: Ensure compiler version in verification matches hardhat.config.js

### Frontend Issues

**Contract addresses not found**
- Solution: Check deployment JSON files exist in `frontend/src/contracts/`

**MetaMask shows wrong network**
- Solution: Manually switch to Polygon in MetaMask

## Upgrading Contracts

Smart contracts are immutable. To upgrade:

1. Deploy new versions of contracts
2. Migrate data if necessary
3. Update frontend to point to new addresses
4. Communicate changes to users

Consider implementing proxy pattern for upgradeability in future versions.

## Security Best Practices

1. **Never commit private keys** - Use `.gitignore`
2. **Use hardware wallet** for mainnet admin account
3. **Implement multi-sig** for critical operations
4. **Audit contracts** before mainnet deployment
5. **Start with low limits** and gradually increase
6. **Monitor transactions** regularly
7. **Have emergency pause mechanism** ready

## Cost Estimation

### Testnet (Mumbai):
- Free (just need testnet MATIC from faucet)

### Mainnet (Polygon):
- Contract deployment: ~0.05-0.1 MATIC
- Product creation: ~0.001-0.002 MATIC
- Transfers: ~0.0005-0.001 MATIC
- Registrations: ~0.001-0.002 MATIC

*Costs vary based on network congestion*

## Maintenance

### Regular Tasks:
1. Monitor contract events
2. Process pending verifications
3. Handle user support
4. Update frontend as needed
5. Monitor IPFS pinning status

### Updates:
1. Test new features on Mumbai first
2. Deploy new contracts if changes needed
3. Update frontend
4. Communicate with users

## Support

For issues during deployment:
1. Check Hardhat documentation
2. Review Polygon documentation
3. Check Polygonscan for transaction details
4. Review error logs carefully

## Next Steps

After successful deployment:
1. Announce launch to users
2. Create user tutorials/videos
3. Set up support channels
4. Monitor adoption
5. Gather feedback
6. Plan future features

---

**Remember:** Test everything thoroughly on Mumbai before mainnet deployment!

