const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  console.log("🔍 DIAGNOSING DISTRIBUTOR PRODUCTS\n");

  // Contract addresses from deployment
  const PARTICIPANT_REGISTRY = "0xB882B408727c752bEb54D7CA91750f2BDe38AAa0";
  const PRODUCT_NFT = "0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59";
  const SUPPLY_CHAIN = "0x64c647e4c3cA34C421b446F01EC5B7Cdd7ceDecF";

  // Accounts (Sepolia)
  const DISTRIBUTOR_ADDRESS = "0x2a69f68e866de2847c8ca06af306de0d0015da15";
  const PRODUCER_ADDRESS = "0xfed8e82bb1d254774fc694bc4e60f41fba80c09a";

  console.log("📍 Network: Sepolia");
  console.log("📍 Distributor:", DISTRIBUTOR_ADDRESS);
  console.log("📍 Producer:", PRODUCER_ADDRESS);
  console.log("");

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/demo");
  
  // Get contract instances
  const ProductNFT = await ethers.getContractAt("ProductNFT", PRODUCT_NFT, provider);
  const SupplyChain = await ethers.getContractAt("SupplyChain", SUPPLY_CHAIN, provider);
  const ParticipantRegistry = await ethers.getContractAt("ParticipantRegistry", PARTICIPANT_REGISTRY, provider);

  console.log("📦 STEP 1: Check NFT Ownership (ERC721)");
  console.log("━".repeat(60));
  
  // Check balance
  const distributorBalance = await ProductNFT.balanceOf(DISTRIBUTOR_ADDRESS);
  console.log(`Distributor NFT Balance: ${distributorBalance}`);

  // Get all tokens owned by Distributor using getTokensByOwner if available
  try {
    const tokens = await ProductNFT.getTokensByOwner(DISTRIBUTOR_ADDRESS);
    console.log(`Tokens owned by Distributor:`, tokens.map(t => t.toString()));
    
    if (tokens.length > 0) {
      console.log("\n📋 Checking each token:");
      for (const tokenId of tokens) {
        const owner = await ProductNFT.ownerOf(tokenId);
        const tokenURI = await ProductNFT.tokenURI(tokenId);
        console.log(`  Token #${tokenId}:`);
        console.log(`    Owner: ${owner}`);
        console.log(`    URI: ${tokenURI}`);
        
        // Check SupplyChain data
        try {
          const product = await SupplyChain.getProduct(tokenId);
          console.log(`    SupplyChain Status: ${product.status}`);
          console.log(`    SupplyChain Owner: ${product.currentOwner}`);
          console.log(`    Match: ${owner.toLowerCase() === product.currentOwner.toLowerCase() ? "✅" : "❌"}`);
        } catch (err) {
          console.log(`    SupplyChain Error: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.log(`Error getting tokens: ${err.message}`);
    // Fallback: Check first 10 tokens manually
    console.log("\nTrying manual check for first 10 tokens...");
    for (let i = 1; i <= 10; i++) {
      try {
        const owner = await ProductNFT.ownerOf(i);
        if (owner.toLowerCase() === DISTRIBUTOR_ADDRESS.toLowerCase()) {
          console.log(`  Token #${i} owned by Distributor ✅`);
        }
      } catch (err) {
        // Token doesn't exist
      }
    }
  }

  console.log("\n\n📦 STEP 2: Check SupplyChain Contract State");
  console.log("━".repeat(60));
  
  // Try to check products with status WITH_DISTRIBUTOR
  // Note: There's no direct way to query all products, so we'll check known tokens
  console.log("Checking SupplyChain.products[] for known tokens...");

  console.log("\n\n📦 STEP 3: Check Producer's Tokens");
  console.log("━".repeat(60));
  const producerBalance = await ProductNFT.balanceOf(PRODUCER_ADDRESS);
  console.log(`Producer NFT Balance: ${producerBalance}`);
  
  try {
    const producerTokens = await ProductNFT.getTokensByOwner(PRODUCER_ADDRESS);
    console.log(`Tokens owned by Producer:`, producerTokens.map(t => t.toString()));
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }

  console.log("\n✅ Diagnosis complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

