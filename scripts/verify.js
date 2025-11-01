const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Load deployment info
  const deploymentPath = path.join(__dirname, `../frontend/src/contracts/deployment-${hre.network.name}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment file not found: ${deploymentPath}`);
    console.error("Please deploy contracts first using: npm run deploy:mumbai");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { ParticipantRegistry, ProductNFT, SupplyChain } = deployment.contracts;

  console.log("Verifying contracts on Polygonscan...");
  console.log("Network:", hre.network.name);

  try {
    // Verify ParticipantRegistry
    console.log("\n1. Verifying ParticipantRegistry...");
    await hre.run("verify:verify", {
      address: ParticipantRegistry,
      constructorArguments: []
    });
    console.log("✅ ParticipantRegistry verified");
  } catch (error) {
    console.log("❌ ParticipantRegistry verification failed:", error.message);
  }

  try {
    // Verify ProductNFT
    console.log("\n2. Verifying ProductNFT...");
    await hre.run("verify:verify", {
      address: ProductNFT,
      constructorArguments: []
    });
    console.log("✅ ProductNFT verified");
  } catch (error) {
    console.log("❌ ProductNFT verification failed:", error.message);
  }

  try {
    // Verify SupplyChain
    console.log("\n3. Verifying SupplyChain...");
    await hre.run("verify:verify", {
      address: SupplyChain,
      constructorArguments: [ParticipantRegistry, ProductNFT]
    });
    console.log("✅ SupplyChain verified");
  } catch (error) {
    console.log("❌ SupplyChain verification failed:", error.message);
  }

  console.log("\nVerification process completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

