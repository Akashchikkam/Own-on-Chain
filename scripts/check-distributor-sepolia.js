const { ethers } = require("ethers");

async function main() {
  console.log("🔍 Checking Distributor Account Status on Sepolia\n");

  const distributorAddress = "0x2a69f68e866de2847c8ca06af306de0d0015da15";
  const participantRegistryAddress = "0xB882B408727c752bEb54D7CA91750f2BDe38AAa0";

  console.log("📋 Distributor Address:", distributorAddress);
  console.log("📋 ParticipantRegistry Contract:", participantRegistryAddress);
  console.log("");

  // Connect to Sepolia
  const rpcUrls = [
    "https://eth-sepolia.g.alchemy.com/v2/demo",
    "https://rpc.sepolia.org",
    "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161"
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
    const participant = await participantRegistry.getParticipant(distributorAddress);
    
    console.log("✅ Participant Found!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Address:", participant.participantAddress);
    console.log("Role:", Number(participant.role), "(2 = DISTRIBUTOR)");
    console.log("Status:", Number(participant.status), "(0 = PENDING, 1 = VERIFIED, 2 = REJECTED)");
    console.log("Status Name:", Number(participant.status) === 0 ? "PENDING" : Number(participant.status) === 1 ? "VERIFIED" : "REJECTED");
    console.log("Is Active:", participant.isActive);
    console.log("Registration Date:", new Date(Number(participant.registrationDate) * 1000).toLocaleString());
    console.log("");

    // Check role
    const hasDistributorRole = await participantRegistry.hasRole(distributorAddress, 2); // 2 = DISTRIBUTOR
    console.log("Has DISTRIBUTOR Role (verified & active):", hasDistributorRole);
    console.log("");

    if (participant.status === 1n && participant.isActive && participant.role === 2n) {
      console.log("✅ Distributor is VERIFIED and ACTIVE!");
    } else {
      console.log("❌ Distributor is NOT properly verified:");
      if (Number(participant.status) !== 1) {
        console.log("  - Status:", Number(participant.status) === 0 ? "PENDING" : "REJECTED", "(needs to be VERIFIED = 1)");
      }
      if (!participant.isActive) {
        console.log("  - Account is NOT ACTIVE");
      }
      if (Number(participant.role) !== 2) {
        console.log("  - Role is not DISTRIBUTOR (current:", Number(participant.role), ")");
      }
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.message.includes("Participant not found")) {
      console.log("\n⚠️ Distributor address is not registered yet!");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

