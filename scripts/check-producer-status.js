const hre = require("hardhat");

async function main() {
  const producerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  
  // Load contract addresses from deployment file
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "../frontend/src/contracts/deployment-localhost.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const participantRegistryAddress = deployment.contracts.ParticipantRegistry;
  const supplyChainAddress = deployment.contracts.SupplyChain;
  
  console.log("🔍 Checking Producer Account Status:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Producer Address:", producerAddress);
  console.log("ParticipantRegistry:", participantRegistryAddress);
  console.log("SupplyChain:", supplyChainAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const participantRegistry = await hre.ethers.getContractAt(
    "ParticipantRegistry",
    participantRegistryAddress
  );

  try {
    // Check participant details
    const participant = await participantRegistry.getParticipant(producerAddress);
    
    const statusNames = ['PENDING', 'VERIFIED', 'REJECTED'];
    const roleNames = ['NONE', 'PRODUCER', 'DISTRIBUTOR', 'RETAILER', 'BUYER'];
    
    console.log("📋 Participant Details:");
    console.log("  Address:", participant.participantAddress);
    console.log("  Role:", roleNames[Number(participant.role)]);
    console.log("  Status:", statusNames[Number(participant.status)]);
    console.log("  isActive:", participant.isActive);
    console.log("  Registration Date:", new Date(Number(participant.registrationDate) * 1000).toLocaleString());
    
    // Check hasRole
    const hasProducerRole = await participantRegistry.hasRole(producerAddress, 1); // 1 = PRODUCER
    console.log("\n🔐 Role Verification:");
    console.log("  hasRole(PRODUCER):", hasProducerRole ? "✅ YES" : "❌ NO");
    
    // Check isVerifiedParticipant
    const isVerified = await participantRegistry.isVerifiedParticipant(producerAddress);
    console.log("  isVerifiedParticipant:", isVerified ? "✅ YES" : "❌ NO");
    
    // Detailed check
    console.log("\n🔍 Detailed Analysis:");
    if (participant.participantAddress === "0x0000000000000000000000000000000000000000") {
      console.log("  ❌ Participant address is zero - NOT REGISTERED");
    } else {
      console.log("  ✅ Participant address exists - REGISTERED");
    }
    
    if (Number(participant.role) !== 1) {
      console.log("  ❌ Role is NOT PRODUCER (Role:", roleNames[Number(participant.role)] + ")");
    } else {
      console.log("  ✅ Role is PRODUCER");
    }
    
    if (Number(participant.status) !== 1) {
      console.log("  ❌ Status is NOT VERIFIED (Status:", statusNames[Number(participant.status)] + ")");
      console.log("  ⚠️  NEEDS ADMIN VERIFICATION!");
    } else {
      console.log("  ✅ Status is VERIFIED");
    }
    
    if (!participant.isActive) {
      console.log("  ❌ Account is NOT ACTIVE");
    } else {
      console.log("  ✅ Account is ACTIVE");
    }
    
    console.log("\n📝 Summary:");
    if (hasProducerRole) {
      console.log("  ✅ Account can create products!");
    } else {
      console.log("  ❌ Account CANNOT create products");
      console.log("\n💡 Solution:");
      if (Number(participant.status) === 0) {
        console.log("  → Registration is PENDING - Admin needs to verify it");
      } else if (Number(participant.status) === 2) {
        console.log("  → Registration was REJECTED - Register again");
      } else if (!participant.isActive) {
        console.log("  → Account is INACTIVE - Admin needs to reactivate it");
      }
    }
    
  } catch (error) {
    console.error("❌ Error checking participant:", error.message);
    if (error.message.includes("Participant not found")) {
      console.log("\n💡 Solution: Participant is NOT REGISTERED");
      console.log("  → Go to Register page and register as Producer");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

