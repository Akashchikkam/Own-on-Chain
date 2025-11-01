const hre = require("hardhat");

async function main() {
  // Load contract addresses from deployment file
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "../frontend/src/contracts/deployment-localhost.json");
  let participantRegistryAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // fallback
  
  try {
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    participantRegistryAddress = deployment.contracts.ParticipantRegistry;
    console.log("📍 Using ParticipantRegistry from deployment:", participantRegistryAddress);
  } catch (err) {
    console.log("⚠️  Using fallback address:", participantRegistryAddress);
  }
  
  const participantRegistry = await hre.ethers.getContractAt(
    "ParticipantRegistry",
    participantRegistryAddress
  );
  
  const addresses = [
    { name: 'Admin', addr: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
    { name: 'Producer', addr: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
    { name: 'Distributor', addr: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
    { name: 'Retailer', addr: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
    { name: 'Buyer', addr: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' }
  ];
  
  console.log('\n📋 Registration Status:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const {name, addr} of addresses) {
    try {
      const participant = await participantRegistry.getParticipant(addr);
      const statusNames = ['PENDING', 'VERIFIED', 'REJECTED'];
      const roleNames = ['NONE', 'PRODUCER', 'DISTRIBUTOR', 'RETAILER', 'BUYER'];
      const status = statusNames[Number(participant.status)];
      const role = roleNames[Number(participant.role)];
      const active = participant.isActive ? '✅' : '❌';
      
      console.log(`${name.padEnd(12)} | Role: ${role.padEnd(12)} | Status: ${status.padEnd(8)} | Active: ${active}`);
    } catch(e) {
      console.log(`${name.padEnd(12)} | NOT REGISTERED YET`);
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Check pending participants
  const pending = await participantRegistry.getPendingParticipants();
  console.log(`\n⏳ Pending Verifications: ${pending.length}`);
  if (pending.length > 0) {
    console.log('\nAddresses waiting for admin approval:');
    pending.forEach((addr, i) => console.log(`  ${i+1}. ${addr}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

