const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy ProductIdentifier and GtinLinker modules
 * Then update SupplyChain to use them (or redeploy SupplyChain with module addresses)
 */
async function main() {
  console.log("🚀 Starting module deployment...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Load existing contract addresses
  const network = hre.network.name;
  const deploymentsDir = path.join(__dirname, "../frontend/src/contracts");
  const deploymentPath = path.join(deploymentsDir, `deployment-${network}.json`);
  
  let existingDeployment = null;
  if (fs.existsSync(deploymentPath)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("\n📋 Found existing deployment:", deploymentPath);
    console.log("   SupplyChain:", existingDeployment.contracts?.SupplyChain);
  } else {
    console.log("\n⚠️  No existing deployment found. Deploying all contracts...");
    // Deploy core contracts first
    await deployCoreContracts(deployer, network, deploymentsDir);
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }
  
  const supplyChainAddress = existingDeployment.contracts.SupplyChain;
  if (!supplyChainAddress) {
    throw new Error("SupplyChain address not found. Please deploy core contracts first.");
  }
  
  console.log("\n📦 Deploying modules...");
  
  // Deploy ProductIdentifier
  console.log("\n1. Deploying ProductIdentifier...");
  const ProductIdentifier = await hre.ethers.getContractFactory("ProductIdentifier");
  const productIdentifier = await ProductIdentifier.deploy(supplyChainAddress);
  await productIdentifier.waitForDeployment();
  const productIdentifierAddress = await productIdentifier.getAddress();
  console.log("   ✅ ProductIdentifier deployed to:", productIdentifierAddress);
  
  // Deploy GtinLinker
  console.log("\n2. Deploying GtinLinker...");
  const GtinLinker = await hre.ethers.getContractFactory("GtinLinker");
  const gtinLinker = await GtinLinker.deploy(supplyChainAddress, supplyChainAddress);
  await gtinLinker.waitForDeployment();
  const gtinLinkerAddress = await gtinLinker.getAddress();
  console.log("   ✅ GtinLinker deployed to:", gtinLinkerAddress);
  
  // Update SupplyChain to use modules
  console.log("\n3. Connecting modules to SupplyChain...");
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = SupplyChain.attach(supplyChainAddress);
  
  try {
    // Try to set modules (if SupplyChain has setter functions)
    const tx1 = await supplyChain.setProductIdentifier(productIdentifierAddress);
    await tx1.wait();
    console.log("   ✅ ProductIdentifier connected to SupplyChain");
    
    const tx2 = await supplyChain.setGtinLinker(gtinLinkerAddress);
    await tx2.wait();
    console.log("   ✅ GtinLinker connected to SupplyChain");
  } catch (err) {
    console.log("   ⚠️  Could not set modules via setter functions");
    console.log("   ℹ️  You may need to redeploy SupplyChain with module addresses");
    console.log("   Error:", err.message);
  }
  
  // Update deployment info
  existingDeployment.contracts.ProductIdentifier = productIdentifierAddress;
  existingDeployment.contracts.GtinLinker = gtinLinkerAddress;
  existingDeployment.modulesDeployed = new Date().toISOString();
  
  fs.writeFileSync(deploymentPath, JSON.stringify(existingDeployment, null, 2));
  console.log("\n4. Deployment info updated:", deploymentPath);
  
  // Copy ABIs to frontend
  console.log("\n5. Copying module ABIs to frontend...");
  const artifactsPath = path.join(__dirname, "../artifacts/contracts");
  
  const modules = [
    { name: "ProductIdentifier", path: "ProductIdentifier.sol" },
    { name: "GtinLinker", path: "GtinLinker.sol" }
  ];
  
  for (const module of modules) {
    try {
      const artifactPath = path.join(artifactsPath, module.path, `${module.name}.json`);
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        
        // Convert to JS format (like SupplyChain.js)
        const jsContent = `export default ${JSON.stringify({ abi: artifact.abi }, null, 2)};\n`;
        const jsPath = path.join(deploymentsDir, `${module.name}.js`);
        fs.writeFileSync(jsPath, jsContent);
        console.log(`   ✅ ${module.name} ABI copied to ${module.name}.js`);
      } else {
        console.log(`   ⚠️  ${module.name} artifact not found at ${artifactPath}`);
      }
    } catch (err) {
      console.log(`   ❌ Error copying ${module.name} ABI:`, err.message);
    }
  }
  
  // Update config.js with module addresses
  console.log("\n6. Updating config.js...");
  await updateConfigFile(network, productIdentifierAddress, gtinLinkerAddress);
  
  console.log("\n✅ Module deployment completed!");
  console.log("\n📝 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ProductIdentifier:", productIdentifierAddress);
  console.log("GtinLinker:", gtinLinkerAddress);
  console.log("SupplyChain:", supplyChainAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n🎯 Next steps:");
  console.log("1. Restart frontend to load new module addresses");
  console.log("2. Test blockchain ID registration on product creation");
  console.log("3. Test GTIN linking on existing products");
}

async function deployCoreContracts(deployer, network, deploymentsDir) {
  console.log("\n📦 Deploying core contracts first...");
  
  // Deploy ParticipantRegistry
  console.log("1. Deploying ParticipantRegistry...");
  const ParticipantRegistry = await hre.ethers.getContractFactory("ParticipantRegistry");
  const participantRegistry = await ParticipantRegistry.deploy();
  await participantRegistry.waitForDeployment();
  const participantRegistryAddress = await participantRegistry.getAddress();
  
  // Deploy ProductNFT
  console.log("2. Deploying ProductNFT...");
  const ProductNFT = await hre.ethers.getContractFactory("ProductNFT");
  const productNFT = await ProductNFT.deploy();
  await productNFT.waitForDeployment();
  const productNFTAddress = await productNFT.getAddress();
  
  // Deploy SupplyChain (without modules for now)
  console.log("3. Deploying SupplyChain...");
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy(
    participantRegistryAddress,
    productNFTAddress,
    "0x0000000000000000000000000000000000000000", // ProductIdentifier (will set later)
    "0x0000000000000000000000000000000000000000"  // GtinLinker (will set later)
  );
  await supplyChain.waitForDeployment();
  const supplyChainAddress = await supplyChain.getAddress();
  
  // Set SupplyChain in ProductNFT
  console.log("4. Setting SupplyChain in ProductNFT...");
  const tx = await productNFT.setSupplyChainContract(supplyChainAddress);
  await tx.wait();
  
  // Save deployment
  const deploymentInfo = {
    network: network,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ParticipantRegistry: participantRegistryAddress,
      ProductNFT: productNFTAddress,
      SupplyChain: supplyChainAddress
    }
  };
  
  const deploymentPath = path.join(deploymentsDir, `deployment-${network}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Core contracts deployed and saved");
}

async function updateConfigFile(network, productIdentifierAddress, gtinLinkerAddress) {
  const configPath = path.join(__dirname, "../frontend/src/contracts/config.js");
  let configContent = fs.readFileSync(configPath, "utf8");
  
  // Update addresses based on network
  if (network === "localhost") {
    configContent = configContent.replace(
      /ProductIdentifier: '0x0000000000000000000000000000000000000000'/g,
      `ProductIdentifier: '${productIdentifierAddress}'`
    );
    configContent = configContent.replace(
      /GtinLinker: '0x0000000000000000000000000000000000000000'/g,
      `GtinLinker: '${gtinLinkerAddress}'`
    );
  } else if (network === "sepolia") {
    // Update SEPOLIA_ADDRESSES
    const sepoliaRegex = /SEPOLIA_ADDRESSES = \{([^}]+)\}/s;
    const match = configContent.match(sepoliaRegex);
    if (match) {
      const replacement = `SEPOLIA_ADDRESSES = {
  ParticipantRegistry: '${await getExistingAddress(network, "ParticipantRegistry")}',
  ProductNFT: '${await getExistingAddress(network, "ProductNFT")}',
  SupplyChain: '${await getExistingAddress(network, "SupplyChain")}',
  ProductIdentifier: '${productIdentifierAddress}',
  GtinLinker: '${gtinLinkerAddress}'
}`;
      configContent = configContent.replace(sepoliaRegex, replacement);
    }
  }
  
  fs.writeFileSync(configPath, configContent);
  console.log("   ✅ config.js updated with module addresses");
}

async function getExistingAddress(network, contractName) {
  const deploymentPath = path.join(__dirname, "../frontend/src/contracts", `deployment-${network}.json`);
  if (fs.existsSync(deploymentPath)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    return deployment.contracts[contractName] || '0x0000000000000000000000000000000000000000';
  }
  return '0x0000000000000000000000000000000000000000';
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

