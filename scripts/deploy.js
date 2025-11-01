const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting deployment...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  // Determine currency symbol based on network
  const currencySymbol = hre.network.name === "sepolia" || hre.network.name === "localhost" ? "ETH" : 
                        (hre.network.name === "amoy" ? "POL" : "MATIC");
  console.log("Account balance:", hre.ethers.formatEther(balance), currencySymbol);

  // Deploy ParticipantRegistry
  console.log("\n1. Deploying ParticipantRegistry...");
  const ParticipantRegistry = await hre.ethers.getContractFactory("ParticipantRegistry");
  const participantRegistry = await ParticipantRegistry.deploy();
  await participantRegistry.waitForDeployment();
  const participantRegistryAddress = await participantRegistry.getAddress();
  console.log("ParticipantRegistry deployed to:", participantRegistryAddress);

  // Deploy ProductNFT
  console.log("\n2. Deploying ProductNFT...");
  const ProductNFT = await hre.ethers.getContractFactory("ProductNFT");
  const productNFT = await ProductNFT.deploy();
  await productNFT.waitForDeployment();
  const productNFTAddress = await productNFT.getAddress();
  console.log("ProductNFT deployed to:", productNFTAddress);

  // Deploy SupplyChain
  console.log("\n3. Deploying SupplyChain...");
  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy(
    participantRegistryAddress,
    productNFTAddress
  );
  await supplyChain.waitForDeployment();
  const supplyChainAddress = await supplyChain.getAddress();
  console.log("SupplyChain deployed to:", supplyChainAddress);

  // Set SupplyChain contract address in ProductNFT
  console.log("\n4. Setting SupplyChain contract in ProductNFT...");
  const tx = await productNFT.setSupplyChainContract(supplyChainAddress);
  await tx.wait();
  console.log("SupplyChain contract set in ProductNFT");

  // Prepare deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ParticipantRegistry: participantRegistryAddress,
      ProductNFT: productNFTAddress,
      SupplyChain: supplyChainAddress
    }
  };

  // Save deployment addresses
  const deploymentsDir = path.join(__dirname, "../frontend/src/contracts");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, `deployment-${hre.network.name}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n5. Deployment info saved to:", deploymentPath);

  // Copy ABIs to frontend
  console.log("\n6. Copying ABIs to frontend...");
  const artifactsPath = path.join(__dirname, "../artifacts/contracts");
  
  const contracts = [
    { name: "ParticipantRegistry", path: "ParticipantRegistry.sol" },
    { name: "ProductNFT", path: "ProductNFT.sol" },
    { name: "SupplyChain", path: "SupplyChain.sol" }
  ];

  for (const contract of contracts) {
    const artifactPath = path.join(artifactsPath, contract.path, `${contract.name}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiPath = path.join(deploymentsDir, `${contract.name}.json`);
    fs.writeFileSync(abiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
    console.log(`  - ${contract.name} ABI copied`);
  }

  console.log("\n✅ Deployment completed successfully!");
  console.log("\n📝 Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ParticipantRegistry:", participantRegistryAddress);
  console.log("ProductNFT:         ", productNFTAddress);
  console.log("SupplyChain:        ", supplyChainAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (hre.network.name === "mumbai" || hre.network.name === "polygon") {
    console.log("\n📌 Next steps:");
    console.log("1. Verify contracts on Polygonscan:");
    console.log(`   npx hardhat verify --network ${hre.network.name} ${participantRegistryAddress}`);
    console.log(`   npx hardhat verify --network ${hre.network.name} ${productNFTAddress}`);
    console.log(`   npx hardhat verify --network ${hre.network.name} ${supplyChainAddress} ${participantRegistryAddress} ${productNFTAddress}`);
    console.log("\n2. Update frontend with new contract addresses");
    console.log("3. Test the deployment with test transactions");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

