const hre = require("ethers");

async function main() {
  // Hardhat default addresses (first 3 accounts)
  const defaultAddresses = [
    "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
  ];
  
  // New deployed addresses
  const newAddresses = [
    "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82"
  ];
  
  console.log("🔍 Checking Contract Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Try both sets of addresses
  const addressesToTry = [defaultAddresses, newAddresses];
  const names = ["Default (Old)", "New Deployment"];
  
  for (let i = 0; i < addressesToTry.length; i++) {
    console.log(`\n📋 Trying ${names[i]} addresses:`);
    const [regAddr, nftAddr, chainAddr] = addressesToTry[i];
    
    try {
      const provider = hre.ethers.getDefaultProvider("http://127.0.0.1:8545");
      
      // Try to read contract
      const code = await provider.getCode(regAddr);
      if (code === "0x") {
        console.log(`  ❌ No contract at ${regAddr}`);
      } else {
        console.log(`  ✅ Contract exists at ${regAddr}`);
        
        // Try to call a simple function
        try {
          const ParticipantRegistryABI = [
            "function owner() view returns (address)",
            "function getTotalParticipants() view returns (uint256)"
          ];
          const contract = new hre.ethers.Contract(regAddr, ParticipantRegistryABI, provider);
          const owner = await contract.owner();
          const total = await contract.getTotalParticipants();
          console.log(`  ✅ Contract is responsive - Owner: ${owner}, Total: ${total}`);
        } catch (err) {
          console.log(`  ⚠️  Contract exists but not responding: ${err.message.substring(0, 50)}`);
        }
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message.substring(0, 50)}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

