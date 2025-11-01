# MetaMask Transaction Address Explanation

## Why MetaMask Shows a Different Address

When you transfer a product using the SupplyChain contract, MetaMask shows the **SupplyChain contract address** (`0x64c647e4c3cA34C421b446F01EC5B7Cdd7ceDecF`) instead of the recipient address.

### This is CORRECT Behavior! ✅

**How Smart Contract Transfers Work:**

1. **Transaction sent TO:** SupplyChain Contract (`0x64c64...`)
2. **Contract function called:** `transferToDistributor(tokenId, recipientAddress)`
3. **Contract THEN transfers TO:** Recipient address (`0x2a69...`)
4. **Both tracked on blockchain:** Contract call + internal transfer

### Example:
- You paste Distributor address: `0x2a69f68e866de2847c8ca06af306de0d0015da15`
- MetaMask shows: `0x64c647e4c3cA34C421b446F01EC5B7Cdd7ceDecF` (SupplyChain contract)
- **What happens:** Transaction → SupplyChain Contract → Contract transfers to `0x2a69...`

## MetaMask Warning: "Can't verify this address"

This warning appears because:
- The SupplyChain contract hasn't been verified on Etherscan
- This is normal for testnet deployments
- The contract address is correct and safe

### To Verify (Optional - for production):
1. Go to https://sepolia.etherscan.io/address/0x64c647e4c3cA34C421b446F01EC5B7Cdd7ceDecF
2. Click "Verify and Publish"
3. Submit contract source code

This removes the warning but is not required for functionality.

## How to Verify Transfer Worked

After confirming the transaction:
1. Check transaction on Etherscan
2. View "Internal Transactions" - you'll see transfer to Distributor address
3. Or check Distributor dashboard - product should appear

## Summary

✅ **This is normal smart contract behavior**
✅ **Transaction is safe - contract transfers to correct recipient**
✅ **Warning is just about contract verification, not a security issue**
✅ **Your product will transfer to the Distributor address you pasted**

