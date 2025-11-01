# Registration Stuck on "Submitting..." - Troubleshooting

## Common Issue: Hidden MetaMask Popup

When you click "Submit Registration", MetaMask should popup asking you to confirm the transaction. If it doesn't appear or is hidden:

### Fix 1: Find the Hidden Popup
1. Click the **MetaMask extension icon** (fox icon in browser toolbar)
2. Look for a pending transaction
3. Click **"Confirm"** if you see one
4. Check if there's a number badge on the MetaMask icon

### Fix 2: Check Browser Console
1. Press **F12** (or **Cmd + Option + J** on Mac)
2. Click **"Console"** tab
3. Look for red error messages
4. Common errors and fixes:
   - "User rejected" - You clicked Cancel, try again
   - "Insufficient funds" - Wrong account selected
   - "Network error" - Hardhat node might be down

### Fix 3: Force Refresh and Retry
1. **Refresh page**: `Cmd/Ctrl + Shift + R`
2. **Reconnect wallet**: Click "Disconnect" then "Connect Wallet"
3. Make sure you're on **"Hardhat Local"** network
4. Try registering again

### Fix 4: Reset MetaMask Nonce (If transactions are stuck)
1. MetaMask → Settings → Advanced
2. Scroll to "Clear activity tab data"
3. Click "Clear"
4. Try again

## Still Stuck?

### Check These:

**Is Hardhat Running?**
```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://127.0.0.1:8545
```
Should return: `{"jsonrpc":"2.0","id":1,"result":"1337"}`

**Is Frontend Running?**
Visit: http://localhost:5173
Should load the app

**Check MetaMask Network:**
- Network name: "Hardhat Local"
- Chain ID: 1337
- RPC URL: http://127.0.0.1:8545

## Alternative: Use Browser Console to Debug

Open console (F12) and paste this to see what's happening:
```javascript
window.ethereum.request({ method: 'eth_accounts' })
  .then(accounts => console.log('Connected account:', accounts[0]))
  .catch(err => console.error('Error:', err));
```

This will show if your wallet is properly connected.

