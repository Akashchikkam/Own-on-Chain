const { ethers } = require("ethers");

async function main() {
  console.log("🔍 Checking Token Ownership on Sepolia\n");

  // Contract addresses
  const productNFTAddress = "0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59";
  
  // Accounts to check
  const distributorAddress = "0x2a69f68e866de2847c8ca06af306de0d0015da15";
  const retailerAddress = "0x4324f04ece680543c7a533601edd5436baf1f186";
  
  // Transaction hashes from user
  const tx1 = "0x0d024017704c148a1b671a4961a30b3a2d4f0a549a050f2f54028f88fad42465"; // Producer to Distributor
  const tx2 = "0x3fa41eac97a3935fb166a96e7bb2ee7a940e9702fca4ed57d5684d28e351e205"; // Producer to Retailer

  console.log("Transaction 1 (Producer → Distributor):", tx1);
  console.log("Transaction 2 (Producer → Retailer):", tx2);
  console.log("");

  // Connect to Sepolia
  const rpcUrls = [
    "https://eth-sepolia.g.alchemy.com/v2/demo",
    "https://rpc.sepolia.org",
  ];
  
  let provider;
  for (const rpcUrl of rpcUrls) {
    try {
      provider = new ethers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
      console.log("✅ Connected to:", rpcUrl);
      break;
    } catch (err) {
      console.log("❌ Failed to connect to:", rpcUrl);
    }
  }
  
  if (!provider) {
    throw new Error("Could not connect to any Sepolia RPC");
  }

  const ProductNFTABI = [
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)"
  ];

  const productNFT = new ethers.Contract(
    productNFTAddress,
    ProductNFTABI,
    provider
  );

  // Get transaction details to find token IDs
  try {
    console.log("📋 Checking transaction details...");
    const tx1Details = await provider.getTransaction(tx1);
    const tx2Details = await provider.getTransaction(tx2);
    
    console.log("Tx1 logs:", tx1Details);
    console.log("Tx2 logs:", tx2Details);
    
    // Try to get receipt to find token ID from events
    const receipt1 = await provider.getTransactionReceipt(tx1);
    const receipt2 = await provider.getTransactionReceipt(tx2);
    
    console.log("\n📦 Transaction 1 Receipt:");
    console.log("Status:", receipt1.status === 1 ? "Success ✅" : "Failed ❌");
    console.log("Logs:", receipt1.logs.length);
    
    console.log("\n📦 Transaction 2 Receipt:");
    console.log("Status:", receipt2.status === 1 ? "Success ✅" : "Failed ❌");
    console.log("Logs:", receipt2.logs.length);
    
    // Get all tokens owned by Distributor
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Checking Distributor Balance:");
    const distributorBalance = await productNFT.balanceOf(distributorAddress);
    console.log("Distributor balance:", Number(distributorBalance));
    
    if (Number(distributorBalance) > 0) {
      const distributorTokens = [];
      for (let i = 0; i < Number(distributorBalance); i++) {
        const tokenId = await productNFT.tokenOfOwnerByIndex(distributorAddress, i);
        const owner = await productNFT.ownerOf(tokenId);
        distributorTokens.push({
          tokenId: Number(tokenId),
          owner: owner
        });
      }
      console.log("Distributor tokens:", distributorTokens);
    }
    
    // Get all tokens owned by Retailer
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Checking Retailer Balance:");
    const retailerBalance = await productNFT.balanceOf(retailerAddress);
    console.log("Retailer balance:", Number(retailerBalance));
    
    if (Number(retailerBalance) > 0) {
      const retailerTokens = [];
      for (let i = 0; i < Number(retailerBalance); i++) {
        const tokenId = await productNFT.tokenOfOwnerByIndex(retailerAddress, i);
        const owner = await productNFT.ownerOf(tokenId);
        retailerTokens.push({
          tokenId: Number(tokenId),
          owner: owner
        });
      }
      console.log("Retailer tokens:", retailerTokens);
    }
    
    // Get total supply to check all tokens
    const totalSupply = await productNFT.totalSupply();
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Total Supply:", Number(totalSupply));
    
    if (Number(totalSupply) > 0) {
      console.log("\n📋 All Token Owners:");
      // Note: We can't iterate through all tokens without knowing the token IDs
      // But we can check specific ranges if needed
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

