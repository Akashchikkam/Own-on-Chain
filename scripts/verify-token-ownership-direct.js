const { ethers } = require("ethers");

async function main() {
  console.log("🔍 Direct Token Ownership Verification\n");

  const productNFTAddress = "0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59";
  const distributorAddress = "0x2a69f68e866de2847c8ca06af306de0d0015da15";
  const retailerAddress = "0x4324f04ece680543c7a533601edd5436baf1f186";

  const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/demo";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  console.log("✅ Connected to Sepolia\n");

  const ProductNFTABI = [
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function getTokensByOwner(address _owner) external view returns (uint256[] memory)"
  ];

  const productNFT = new ethers.Contract(productNFTAddress, ProductNFTABI, provider);

  try {
    // Check Distributor
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 DISTRIBUTOR (0x2a69...)");
    const distributorBalance = await productNFT.balanceOf(distributorAddress);
    console.log("Balance:", Number(distributorBalance));
    
    if (Number(distributorBalance) > 0) {
      const distributorTokens = await productNFT.getTokensByOwner(distributorAddress);
      console.log("Tokens:", distributorTokens.map(t => Number(t)));
      
      // Verify ownership
      for (const tokenId of distributorTokens) {
        const owner = await productNFT.ownerOf(tokenId);
        console.log(`  Token ${Number(tokenId)} owner: ${owner}`);
        console.log(`  ✅ Match: ${owner.toLowerCase() === distributorAddress.toLowerCase()}`);
      }
    } else {
      console.log("❌ No tokens found");
    }

    // Check Retailer
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 RETAILER (0x4324...)");
    const retailerBalance = await productNFT.balanceOf(retailerAddress);
    console.log("Balance:", Number(retailerBalance));
    
    if (Number(retailerBalance) > 0) {
      const retailerTokens = await productNFT.getTokensByOwner(retailerAddress);
      console.log("Tokens:", retailerTokens.map(t => Number(t)));
      
      // Verify ownership
      for (const tokenId of retailerTokens) {
        const owner = await productNFT.ownerOf(tokenId);
        console.log(`  Token ${Number(tokenId)} owner: ${owner}`);
        console.log(`  ✅ Match: ${owner.toLowerCase() === retailerAddress.toLowerCase()}`);
      }
    } else {
      console.log("❌ No tokens found");
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

