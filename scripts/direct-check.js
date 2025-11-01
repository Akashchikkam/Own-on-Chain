const { ethers } = require("hardhat");

async function main() {
  const producerAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account #1 - Producer
const retailerAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // Account #3 - Retailer (the one causing error)
  const registryAddress = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";
  
  console.log("🔍 Direct Contract Check:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const provider = ethers.provider;
  
  // Check if contract exists
  const code = await provider.getCode(registryAddress);
  console.log("Contract code exists:", code !== "0x" ? "✅ YES" : "❌ NO");
  
  if (code === "0x") {
    console.log("\n❌ Contract does not exist at this address!");
    console.log("💡 Solution: Redeploy contracts:");
    console.log("   npm run deploy:local");
    return;
  }
  
  // Try to read participant mapping directly
  const ParticipantRegistryABI = [
    "function participants(address) view returns (address participantAddress, uint8 role, uint8 status, string memory verificationDocument, uint256 registrationDate, bool isActive)"
  ];
  
  try {
    const contract = new ethers.Contract(registryAddress, ParticipantRegistryABI, provider);
    const result = await contract.participants(producerAddress);
    
    console.log("\n📋 Participant Data (from mapping):");
    console.log("  participantAddress:", result.participantAddress);
    console.log("  role:", Number(result.role), "(1=PRODUCER, 2=DISTRIBUTOR, etc.)");
    console.log("  status:", Number(result.status), "(0=PENDING, 1=VERIFIED, 2=REJECTED)");
    console.log("  isActive:", result.isActive);
    
    if (result.participantAddress === "0x0000000000000000000000000000000000000000") {
      console.log("\n❌ NOT REGISTERED - Address is zero");
      console.log("💡 Register first at: http://localhost:5173/register");
    } else {
      const roleNames = ['', 'PRODUCER', 'DISTRIBUTOR', 'RETAILER', 'BUYER'];
      const statusNames = ['PENDING', 'VERIFIED', 'REJECTED'];
      
      console.log("\n📊 Summary:");
      console.log("  Registered:", "✅ YES");
      console.log("  Role:", roleNames[Number(result.role)] || "UNKNOWN");
      console.log("  Status:", statusNames[Number(result.status)] || "UNKNOWN");
      console.log("  Active:", result.isActive ? "✅ YES" : "❌ NO");
      
      // Check hasRole
      const hasRoleABI = ["function hasRole(address, uint8) view returns (bool)"];
      const roleContract = new ethers.Contract(registryAddress, hasRoleABI, provider);
      const hasProducerRole = await roleContract.hasRole(producerAddress, 1);
      
      console.log("\n🔐 Can Create Products?");
      console.log("  hasRole(PRODUCER):", hasProducerRole ? "✅ YES" : "❌ NO");
      
      if (!hasProducerRole) {
        console.log("\n💡 Why can't create products?");
        if (Number(result.role) !== 1) {
          console.log("  ❌ Wrong role! Expected PRODUCER (1), got:", Number(result.role));
        }
        if (Number(result.status) !== 1) {
          console.log("  ❌ Not verified! Status:", statusNames[Number(result.status)]);
          console.log("  → Admin needs to verify you first");
        }
        if (!result.isActive) {
          console.log("  ❌ Account is inactive");
        }
      } else {
        console.log("  ✅ Everything is correct! Product creation should work.");
      }
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

