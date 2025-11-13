const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Checking Polygon deployment status...\n");
  
  const networkName = "polygon";
  
  // Check if deployment file exists
  const deploymentPath = path.join(__dirname, "../frontend/src/contracts", `deployment-${networkName}.json`);
  const deploymentExists = fs.existsSync(deploymentPath);
  
  if (deploymentExists) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("✅ Found existing deployment file:");
    console.log("   ParticipantRegistry:", deployment.contracts.ParticipantRegistry);
    console.log("   ProductNFT:         ", deployment.contracts.ProductNFT);
    console.log("   SupplyChain:        ", deployment.contracts.SupplyChain);
    
    // Try to verify contracts exist on-chain
    try {
      const [deployer] = await hre.ethers.getSigners();
      const provider = deployer.provider;
      
      console.log("\n🔍 Verifying contracts on Polygon...");
      
      const ParticipantRegistry = await hre.ethers.getContractAt("ParticipantRegistry", deployment.contracts.ParticipantRegistry, provider);
      const ProductNFT = await hre.ethers.getContractAt("ProductNFT", deployment.contracts.ProductNFT, provider);
      const SupplyChain = await hre.ethers.getContractAt("SupplyChain", deployment.contracts.SupplyChain, provider);
      
      await ParticipantRegistry.name();
      await ProductNFT.name();
      await SupplyChain.participantRegistry();
      
      console.log("✅ All contracts verified on Polygon!");
      console.log("\n📋 Status: Contracts exist on Polygon");
      console.log("👉 Next step: Run migration to update SupplyChain with batch functions");
      console.log("   Command: npx hardhat run scripts/migrate-supplychain.js --network polygon");
    } catch (err) {
      console.log("⚠️ Contracts in file may not exist on-chain or RPC issue");
      console.log("👉 Next step: Deploy fresh contracts to Polygon");
      console.log("   Command: npx hardhat run scripts/deploy.js --network polygon");
    }
  } else {
    console.log("❌ No Polygon deployment found");
    console.log("\n📋 Status: No contracts deployed on Polygon yet");
    console.log("👉 Next step: Deploy all contracts fresh to Polygon");
    console.log("   Command: npx hardhat run scripts/deploy.js --network polygon");
    console.log("\n   Then run migration:");
    console.log("   Command: npx hardhat run scripts/migrate-supplychain.js --network polygon");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

