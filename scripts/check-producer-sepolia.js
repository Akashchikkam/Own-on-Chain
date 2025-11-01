const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Checking Producer Account Status on Sepolia\n");

  // Producer account from the error message
  const producerAddress = "0x4125ddf0B51073B994ECc790e22D01749Ce73bCa";
  
  // Contract addresses from deployment
  const participantRegistryAddress = "0xB882B408727c752bEb54D7CA91750f2BDe38AAa0";

  console.log("📋 Producer Address:", producerAddress);
  console.log("📋 ParticipantRegistry Contract:", participantRegistryAddress);
  console.log("");

  // Connect to Sepolia (use multiple RPC options)
  const rpcUrls = [
    "https://eth-sepolia.g.alchemy.com/v2/demo",
    "https://rpc.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"
  ];
  
  let provider;
  for (const rpcUrl of rpcUrls) {
    try {
      provider = new ethers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber(); // Test connection
      console.log("✅ Connected to:", rpcUrl);
      break;
    } catch (err) {
      console.log("❌ Failed to connect to:", rpcUrl);
    }
  }
  
  if (!provider) {
    throw new Error("Could not connect to any Sepolia RPC");
  }
  const ParticipantRegistryABI = [
    "function getParticipant(address _participant) external view returns (tuple(address participantAddress, uint8 role, uint8 status, string verificationDocument, uint256 registrationDate, bool isActive))",
    "function hasRole(address _participant, uint8 _role) external view returns (bool)",
    "function owner() external view returns (address)"
  ];

  const participantRegistry = new ethers.Contract(
    participantRegistryAddress,
    ParticipantRegistryABI,
    provider
  );

  try {
    // Get participant details
    const participant = await participantRegistry.getParticipant(producerAddress);
    
    console.log("✅ Participant Found!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Address:", participant.participantAddress);
    console.log("Role:", participant.role, "(1 = PRODUCER)");
    console.log("Status:", participant.status, "(0 = PENDING, 1 = VERIFIED, 2 = REJECTED)");
    console.log("Is Active:", participant.isActive);
    console.log("Registration Date:", new Date(Number(participant.registrationDate) * 1000).toLocaleString());
    console.log("");

    // Check role
    const hasProducerRole = await participantRegistry.hasRole(producerAddress, 1); // 1 = PRODUCER
    console.log("Has PRODUCER Role (verified & active):", hasProducerRole);
    console.log("");

    if (participant.status === 1 && participant.isActive && participant.role === 1) {
      console.log("✅ Producer is VERIFIED and ACTIVE - Should be able to create products!");
    } else {
      console.log("❌ Producer is NOT properly verified:");
      if (participant.status !== 1) {
        console.log("  - Status is not VERIFIED (current:", participant.status === 0 ? "PENDING" : participant.status === 2 ? "REJECTED" : "UNKNOWN", ")");
      }
      if (!participant.isActive) {
        console.log("  - Account is NOT ACTIVE");
      }
      if (participant.role !== 1) {
        console.log("  - Role is not PRODUCER (current:", participant.role, ")");
      }
    }

    // Get contract owner (admin)
    const owner = await participantRegistry.owner();
    console.log("\n👑 Contract Owner (Admin):", owner);

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.message.includes("Participant not found")) {
      console.log("\n⚠️ Producer address is not registered yet!");
      console.log("   Need to register first at: http://localhost:5173/register");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

