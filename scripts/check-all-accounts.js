const { ethers } = require("hardhat");

async function main() {
  // Load contract addresses
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "../frontend/src/contracts/deployment-localhost.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const registryAddress = deployment.contracts.ParticipantRegistry;
  const provider = ethers.provider;
  
  const accounts = [
    { name: "Admin", addr: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
    { name: "Producer", addr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
    { name: "Distributor", addr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
    { name: "Retailer", addr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
    { name: "Buyer", addr: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" }
  ];
  
  const ParticipantRegistryABI = [
    "function participants(address) view returns (address participantAddress, uint8 role, uint8 status, string memory verificationDocument, uint256 registrationDate, bool isActive)",
    "function hasRole(address, uint8) view returns (bool)"
  ];
  
  const contract = new ethers.Contract(registryAddress, ParticipantRegistryABI, provider);
  
  console.log("🔍 Checking All Accounts:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("ParticipantRegistry:", registryAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  const roleNames = ['', 'PRODUCER', 'DISTRIBUTOR', 'RETAILER', 'BUYER'];
  const statusNames = ['PENDING', 'VERIFIED', 'REJECTED'];
  
  for (const {name, addr} of accounts) {
    try {
      const result = await contract.participants(addr);
      
      if (result.participantAddress === "0x0000000000000000000000000000000000000000") {
        console.log(`${name.padEnd(12)} | ❌ NOT REGISTERED`);
      } else {
        const role = roleNames[Number(result.role)] || "UNKNOWN";
        const status = statusNames[Number(result.status)] || "UNKNOWN";
        const active = result.isActive ? "✅" : "❌";
        const hasRoleCheck = await contract.hasRole(addr, Number(result.role));
        
        console.log(`${name.padEnd(12)} | Role: ${role.padEnd(10)} | Status: ${status.padEnd(8)} | Active: ${active} | hasRole: ${hasRoleCheck ? '✅' : '❌'}`);
        
        // Special check for Producer
        if (name === "Producer") {
          const canCreate = await contract.hasRole(addr, 1); // 1 = PRODUCER
          if (canCreate) {
            console.log(`             └─ ✅ CAN CREATE PRODUCTS`);
          } else {
            console.log(`             └─ ❌ CANNOT CREATE PRODUCTS`);
            console.log(`                → Role: ${role}, Status: ${status}, Active: ${result.isActive}`);
          }
        }
      }
    } catch (error) {
      console.log(`${name.padEnd(12)} | ❌ ERROR: ${error.message.substring(0, 40)}`);
    }
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n💡 Key Points:");
  console.log("  → Only PRODUCER role can create products");
  console.log("  → Status must be VERIFIED (not PENDING)");
  console.log("  → Account must be Active");
  console.log("  → Use Account #1 (0x7099...79C8) for Producer");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

