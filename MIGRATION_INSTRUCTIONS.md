# Migration Instructions

## Option 1: Deploy to Localhost (Recommended for Testing)

### Step 1: Start Local Hardhat Node
```bash
# Terminal 1: Start local node
npx hardhat node
```

### Step 2: Run Migration (in another terminal)
```bash
# Terminal 2: Run migration
npx hardhat run scripts/migrate-supplychain.js --network localhost
```

---

## Option 2: Deploy to Sepolia Testnet

### Step 1: Make sure you have:
- Sepolia ETH in your wallet
- PRIVATE_KEY set in .env file
- SEPOLIA_RPC_URL set in .env file

### Step 2: Run Migration
```bash
npx hardhat run scripts/migrate-supplychain.js --network sepolia
```

---

## What the Migration Does:

✅ **Preserves:**
- All your products (NFTs)
- All participant registrations  
- All NFT transfer history
- All metadata (IPFS)

🆕 **Updates:**
- Only SupplyChain contract (with batch functions)
- ProductNFT will point to new SupplyChain
- Config file will be updated automatically

---

## After Migration:

Your batch transfers will work with **1 signature** for multiple products! 🎉

