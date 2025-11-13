<!-- 110f7a8b-d8fe-4fad-8df6-1ca86b345572 2a42ffd4-8452-45b2-8a8b-204e8f156b27 -->
# Scan and Verify + Secure Scan and Send/Receive Flow

## Feature 1: Enhanced Scan and Verify

### Current State

- PublicVerify page exists at `/verify/:tokenId` and works via URL
- No integrated scanner - users must scan QR externally
- Read-only verification with blockchain/IPFS data display

### Implementation Plan

**1. Add Scanner to PublicVerify Page**

- File: `frontend/src/pages/PublicVerify.jsx`
- Add "Scan QR Code" button at top of page
- Integrate Scanner component (already exists)
- After scan: Extract tokenId from QR URL → Auto-load product
- Show loading state during verification

**2. Enhance Verification Display**

- Add scan status indicator (scanned/not scanned)
- Show QR code source info if scanned
- Better error messages for invalid QR codes

## Feature 2: Secure Scan and Send Flow (Owner → Recipient)

### Current Issues

- Uses insecure `prompt()` for recipient address
- No ownership verification before transfer
- No transaction preview or confirmation
- No signature verification step

### Implementation Plan

**1. Create Secure Send Modal Component**

- File: `frontend/src/components/SecureSendModal.jsx`
- Features:
  - Product details display (from scan)
  - Current owner verification (check if user's wallet owns NFT)
  - Recipient address input with real-time validation
  - Transaction preview (tokenId, from, to, gas estimate)
  - Two-step confirmation: Preview → Sign → Send

**2. Add Ownership Verification Service**

- File: `frontend/src/utils/securityHelpers.js` (new)
- Function: `verifyOwnership(provider, tokenId, address)`
- Returns: `{ isOwner: boolean, owner: string }`
- Used before allowing transfer

**3. Update Send Flow in Dashboards**

- Files: `ProducerDashboard.jsx`, `DistributorDashboard.jsx`, `RetailerDashboard.jsx`, `BuyerDashboard.jsx`
- Replace `prompt()` with SecureSendModal
- Flow: Scan → Verify Ownership → Open Modal → Enter Recipient → Preview → Sign → Send Transfer

**4. Add Transaction Security**

- Nonce management (prevent duplicate transfers)
- Transfer confirmation with transaction hash
- Error handling for rejected transactions
- Success/error feedback

## Feature 3: Secure Scan and Receive Flow (Recipient → Confirm Receipt)

### New Feature

- Recipient scans QR code after receiving product
- Verifies that product was transferred to their address
- Confirms receipt (optional signature for audit trail)
- Updates UI to show received products

### Implementation Plan

**1. Create Secure Receive Modal Component**

- File: `frontend/src/components/SecureReceiveModal.jsx`
- Features:
  - Product details from scan
  - Transfer verification (check if product owner is user's wallet)
  - Show sender information from transfer history
  - Transfer timestamp and details
  - "Confirm Receipt" button with optional signature
  - Success confirmation with transaction link

**2. Add Receive Verification Logic**

- File: `frontend/src/utils/securityHelpers.js`
- Function: `verifyReceipt(provider, tokenId, recipientAddress)`
- Checks: Is recipient the current owner?
- Checks: Was there a recent transfer to this address?
- Returns: `{ isRecipient: boolean, sender: string, transferTimestamp: number }`

**3. Update Dashboards with Receive Flow**

- All dashboards: Add "Scan to Receive" button alongside "Scan to Transfer"
- After scan: Check if product belongs to user
  - If YES: Show "Confirm Receipt" option in SecureReceiveModal
  - If NO: Show "You are not the recipient" message
- After confirmation: Show success, update product list, mark as received

**4. Add Received Products Tracking (Optional)**

- Show pending receipts (products transferred but not confirmed)
- Show confirmed receipts with confirmation timestamp
- Filter products by "Received" status in dashboard

### Security Measures (Both Send and Receive)

- Ownership check before showing send option
- Recipient verification before showing receive option
- Address format validation (0x...)
- Transaction preview before signing
- MetaMask signature required (cannot bypass)
- Transaction replay protection (nonce)

### Files to Modify/Create

1. `frontend/src/pages/PublicVerify.jsx` - Add scanner integration
2. `frontend/src/components/SecureSendModal.jsx` - New secure send modal
3. `frontend/src/components/SecureReceiveModal.jsx` - New secure receive modal
4. `frontend/src/utils/securityHelpers.js` - New security utilities
5. `frontend/src/pages/ProducerDashboard.jsx` - Use both send and receive modals
6. `frontend/src/pages/DistributorDashboard.jsx` - Use both send and receive modals
7. `frontend/src/pages/RetailerDashboard.jsx` - Use both send and receive modals
8. `frontend/src/pages/BuyerDashboard.jsx` - Use both send and receive modals
9. `frontend/src/components/SecureSendModal.css` - Send modal styling
10. `frontend/src/components/SecureReceiveModal.css` - Receive modal styling

### Flow Diagrams

**Scan and Verify Flow:**

```
User opens PublicVerify page
  → Clicks "Scan QR Code" button
  → Scanner opens (camera access)
  → Scans QR code (contains /verify/:tokenId)
  → Extracts tokenId from URL
  → Calls backend API /api/product/:tokenId
  → Displays product verification results
```

**Secure Send Flow (Owner → Recipient):**

```
User scans product QR code
  → Product details loaded
  → System verifies: Is current user the owner?
    → If NO: Hide send button, show "Not Owner" message
    → If YES: Show "Send/Transfer" button
  → User clicks "Send/Transfer"
  → SecureSendModal opens
  → User enters recipient address (validated)
  → System shows transaction preview
  → User reviews: Token ID, From, To, Gas estimate
  → User clicks "Confirm & Sign"
  → MetaMask opens → User signs transaction
  → Transaction submitted to blockchain
  → Success: Show transaction hash + link
  → Product ownership transferred to recipient
```

**Secure Receive Flow (Recipient → Confirm):**

```
User scans product QR code (after receiving physical product)
  → Product details loaded
  → System verifies: Is current user the recipient/owner?
    → If NO: Show "You are not the recipient" message
    → If YES: Show "Confirm Receipt" button
  → User clicks "Confirm Receipt"
  → SecureReceiveModal opens
  → Shows: Product details, Sender info, Transfer timestamp
  → User clicks "Confirm Receipt" with signature
  → Optional: Sign message with wallet (for audit trail)
  → Success: Show confirmation, update dashboard
  → Product marked as "Received" in user's inventory
```

### Testing Checklist

- [ ] Scanner works on PublicVerify page
- [ ] QR code extraction works correctly
- [ ] Ownership verification works (send flow)
- [ ] Recipient verification works (receive flow)
- [ ] Send modal shows only for owners
- [ ] Receive modal shows only for recipients
- [ ] Recipient address validation works
- [ ] Transaction preview shows correct data
- [ ] MetaMask signature flow works (both send and receive)
- [ ] Error handling for failed transactions
- [ ] Success confirmation displays correctly
- [ ] Non-owners cannot initiate sends
- [ ] Non-recipients cannot confirm receipts

### To-dos

- [ ] Build role-based registration flow with verification
- [ ] Create QR code generator for products
- [ ] Build universal QR/barcode scanner component
- [ ] Create public verification page (no login required)
- [ ] Implement scan-to-transfer flow with email/wallet support
- [ ] Add Scanner component to PublicVerify page with Scan button and auto-load after scan
- [ ] Enhance PublicVerify display with scan status and better error messages
- [ ] Create SecureSendModal component with product details, ownership check, recipient input, and transaction preview
- [ ] Create securityHelpers.js with verifyOwnership function
- [ ] Update ProducerDashboard to use SecureSendModal instead of prompt()
- [ ] Update DistributorDashboard, RetailerDashboard, and BuyerDashboard to use SecureSendModal
- [ ] Create SecureReceiveModal component with product details, recipient verification, sender info, and receipt confirmation
- [ ] Add verifyReceipt function to securityHelpers.js
- [ ] Add Scan to Receive button to all dashboards with receive flow logic
- [ ] Add SecureSendModal.css and SecureReceiveModal.css styling
- [ ] Test ownership verification, recipient verification, address validation, transaction flows, and error handling