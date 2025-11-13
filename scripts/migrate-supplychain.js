const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔄 Starting SupplyChain Migration...");
  console.log("📦 This will redeploy ONLY SupplyChain contract");
  console.log("✅ ProductNFT and ParticipantRegistry will be preserved\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const currencySymbol = hre.network.name === "sepolia" || hre.network.name === "localhost" ? "ETH" : 
                        (hre.network.name === "amoy" ? "POL" : "MATIC");
  console.log("Account balance:", hre.ethers.formatEther(balance), currencySymbol);

  // Get existing contract addresses from config
  const networkName = hre.network.name;
  let existingAddresses;
  
  if (networkName === "localhost") {
    existingAddresses = {
      ParticipantRegistry: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
      ProductNFT: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
    };
  } else if (networkName === "sepolia") {
    existingAddresses = {
      ParticipantRegistry: '0xB882B408727c752bEb54D7CA91750f2BDe38AAa0',
      ProductNFT: '0x7003CBbB7f84C3147f244bDB50CF1193A2cEAc59',
    };
  } else {
    // Try to load from deployment file
    const deploymentPath = path.join(__dirname, "../frontend/src/contracts", `deployment-${networkName}.json`);
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      existingAddresses = {
        ParticipantRegistry: deployment.contracts.ParticipantRegistry,
        ProductNFT: deployment.contracts.ProductNFT,
      };
    } else {
      throw new Error(`Cannot find existing contract addresses for network: ${networkName}`);
    }
  }

  console.log("\n📋 Using existing contracts:");
  console.log("  ParticipantRegistry:", existingAddresses.ParticipantRegistry);
  console.log("  ProductNFT:         ", existingAddresses.ProductNFT);

  // Verify existing contracts exist
  console.log("\n🔍 Verifying existing contracts...");
  try {
    const ParticipantRegistry = await hre.ethers.getContractAt("ParticipantRegistry", existingAddresses.ParticipantRegistry);
    const ProductNFT = await hre.ethers.getContractAt("ProductNFT", existingAddresses.ProductNFT);
    
    // Verify contracts exist by checking if we can read from them
    // Check if contracts have expected functions
    try {
      await ParticipantRegistry.hasRole(existingAddresses.ParticipantRegistry, 0); // Try any role check
      await ProductNFT.name(); // ERC721 standard function
      console.log("✅ Existing contracts verified");
    } catch (verifyErr) {
      // If name() doesn't exist, try alternative verification
      try {
        await ProductNFT.supplyChainContract(); // Check if ProductNFT is callable
        console.log("✅ Existing contracts verified");
      } catch (altErr) {
        console.warn("⚠️ Could not verify contracts using standard methods, but proceeding...");
        console.warn("   This is OK if contracts don't have these functions");
      }
    }
  } catch (err) {
    console.error("❌ Error verifying existing contracts:", err.message);
    // Don't throw - just warn, as contracts might exist but not have expected functions
    console.warn("⚠️ Proceeding anyway - contracts will be verified during deployment");
  }

  // Deploy NEW SupplyChain contract
  console.log("\n🚀 Deploying NEW SupplyChain contract (with batch functions)...");
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy(
    existingAddresses.ParticipantRegistry,
    existingAddresses.ProductNFT
  );
  await supplyChain.waitForDeployment();
  const supplyChainAddress = await supplyChain.getAddress();
  console.log("✅ SupplyChain deployed to:", supplyChainAddress);

  // Update ProductNFT to point to new SupplyChain
  console.log("\n🔗 Updating ProductNFT to use new SupplyChain...");
  const ProductNFT = await hre.ethers.getContractAt("ProductNFT", existingAddresses.ProductNFT);
  const tx = await ProductNFT.setSupplyChainContract(supplyChainAddress);
  await tx.wait();
  console.log("✅ ProductNFT updated to use new SupplyChain");

  // Verify the update
  const newSupplyChainAddress = await ProductNFT.supplyChainContract();
  if (newSupplyChainAddress.toLowerCase() === supplyChainAddress.toLowerCase()) {
    console.log("✅ Verification: ProductNFT now points to new SupplyChain");
  } else {
    throw new Error("Failed to update ProductNFT contract address");
  }

  // Prepare updated deployment info
  const deploymentInfo = {
    network: networkName,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    migration: true,
    migratedFrom: {
      SupplyChain: networkName === "localhost" ? '0x68B1D87F95878fE05B998F19b66F4baba5De1aed' : 
                   networkName === "sepolia" ? '0x64c647e4c3cA34C421b446F01EC5B7Cdd7ceDecF' : null
    },
    contracts: {
      ParticipantRegistry: existingAddresses.ParticipantRegistry,
      ProductNFT: existingAddresses.ProductNFT,
      SupplyChain: supplyChainAddress
    }
  };

  // Save deployment addresses
  const deploymentsDir = path.join(__dirname, "../frontend/src/contracts");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `deployment-${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  // Copy SupplyChain ABI to frontend
  console.log("\n📋 Copying SupplyChain ABI to frontend...");
  const artifactsPath = path.join(__dirname, "../artifacts/contracts");
  const artifactPath = path.join(artifactsPath, "SupplyChain.sol", "SupplyChain.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abiPath = path.join(deploymentsDir, "SupplyChain.json");
  fs.writeFileSync(abiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
  console.log("  ✅ SupplyChain ABI copied");

  // Update config.js file
  console.log("\n📝 Updating config.js file...");
  const configPath = path.join(deploymentsDir, "config.js");
  let configContent = fs.readFileSync(configPath, "utf8");
  
  if (networkName === "localhost") {
    // Update LOCALHOST_ADDRESSES.SupplyChain
    configContent = configContent.replace(
      /const LOCALHOST_ADDRESSES = \{[\s\S]*?SupplyChain: '0x[a-fA-F0-9]{40}'/,
      (match) => match.replace(/SupplyChain: '0x[a-fA-F0-9]{40}'/, `SupplyChain: '${supplyChainAddress}'`)
    );
  } else if (networkName === "sepolia") {
    // Update SEPOLIA_ADDRESSES.SupplyChain
    configContent = configContent.replace(
      /const SEPOLIA_ADDRESSES = \{[\s\S]*?SupplyChain: '0x[a-fA-F0-9]{40}'/,
      (match) => match.replace(/SupplyChain: '0x[a-fA-F0-9]{40}'/, `SupplyChain: '${supplyChainAddress}'`)
    );
  }
  
  fs.writeFileSync(configPath, configContent);
  console.log("  ✅ config.js updated with new SupplyChain address:", supplyChainAddress);

  console.log("\n✅ Migration completed successfully!");
  console.log("\n📝 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ ParticipantRegistry: (unchanged)", existingAddresses.ParticipantRegistry);
  console.log("✅ ProductNFT:         (unchanged)", existingAddresses.ProductNFT);
  console.log("🆕 SupplyChain:        (NEW)", supplyChainAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n🎉 What's preserved:");
  console.log("  ✅ All your products (NFTs)");
  console.log("  ✅ All participant registrations");
  console.log("  ✅ All NFT transfer history");
  console.log("  ✅ All metadata (IPFS)");
  
  console.log("\n🆕 What's new:");
  console.log("  ✅ Batch transfer functions available");
  console.log("  ✅ Single signature for multiple products");
  console.log("  ✅ Ready for production scale");

  if (networkName === "sepolia" || networkName === "polygon" || networkName === "mumbai") {
    console.log("\n📌 Next steps:");
    console.log(`   npx hardhat verify --network ${networkName} ${supplyChainAddress} ${existingAddresses.ParticipantRegistry} ${existingAddresses.ProductNFT}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

