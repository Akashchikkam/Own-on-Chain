# 🚀 Feature Backlog - Own-on-Chain

This document outlines all the features we need to build next, organized by priority and complexity.

**Last Updated:** November 13, 2025

---

## 🔥 High Priority Features

### 1. Webhook System for ERP Integration
**Priority:** High  
**Complexity:** Medium  
**Estimated Time:** 2-3 weeks

**Description:**
Build a webhook system that allows external ERP systems to automatically create products and sync data with the blockchain.

**Requirements:**
- Webhook registration UI in ProducerDashboard
- Webhook endpoint validation and authentication (HMAC signatures)
- Product ID + serial number mapping
- Auto-mint NFTs when products are created in external systems
- Webhook retry mechanism for failed deliveries
- Webhook management dashboard (view logs, test webhooks, disable/enable)
- Webhook documentation page with examples

**Technical Details:**
- Backend webhook queue system (Bull or similar)
- Webhook secret generation per user
- Payload validation and transformation
- Rate limiting per webhook endpoint
- Webhook delivery status tracking

**Files to Create/Modify:**
- `backend/webhooks/webhook-service.js` - Webhook delivery service
- `backend/webhooks/webhook-routes.js` - Webhook registration endpoints
- `backend/webhooks/webhook-queue.js` - Queue management
- `frontend/src/pages/ProducerDashboard.jsx` - Add webhook UI
- `frontend/src/components/WebhookManager.jsx` - Webhook management component
- `docs/WEBHOOK_INTEGRATION.md` - Integration guide

**API Endpoints:**
```
POST   /api/webhooks/register          - Register new webhook
GET    /api/webhooks/list              - List user's webhooks
DELETE /api/webhooks/:id               - Delete webhook
GET    /api/webhooks/:id/logs          - View webhook delivery logs
POST   /api/webhooks/:id/test          - Test webhook delivery
POST   /api/webhooks/incoming          - Incoming webhook endpoint (for ERP systems)
```

---

### 2. Enhanced Dashboards with Scanner Integration
**Priority:** High  
**Complexity:** Medium  
**Estimated Time:** 1-2 weeks

**Description:**
Integrate the Scanner component into all dashboards (Distributor, Retailer, Buyer) for scan-to-transfer and scan-to-receive workflows.

**Requirements:**
- Add "Scan Product" button to all dashboards
- Scan-to-transfer flow (scan product → scan recipient → transfer)
- Scan-to-receive flow (scan product → confirm receipt)
- Bulk scanning for distributors/retailers
- Batch operations from scanned products
- Scan history/logs

**Current Status:**
- ✅ Scanner component exists (`frontend/src/components/Scanner.jsx`)
- ✅ ProducerDashboard has basic scanner integration
- ❌ Other dashboards need scanner integration
- ❌ Batch scanning not fully implemented

**Files to Modify:**
- `frontend/src/pages/DistributorDashboard.jsx` - Add scanner integration
- `frontend/src/pages/RetailerDashboard.jsx` - Add scanner integration
- `frontend/src/pages/BuyerDashboard.jsx` - Add scanner integration
- `frontend/src/components/Scanner.jsx` - Enhance for batch mode

**Features to Add:**
- Multi-product scanning (scan multiple QR codes in sequence)
- Scan recipient address (QR code with wallet address)
- Scan-to-transfer modal with recipient validation
- Scan-to-receive confirmation flow
- Scan history tracking

---

### 3. Product ID Management System
**Priority:** High  
**Complexity:** High  
**Estimated Time:** 3-4 weeks

**Description:**
Complete product identification system with GTIN/UPC/EAN support, private ID generation, and bulk import capabilities.

**Requirements:**
- GTIN/UPC/EAN/JAN database integration
- Product ID → Token ID mapping (already partially implemented with ProductIdentifier contract)
- Partner integration for GTIN registration (like Phantom → OnMeta)
- Private ID generation (PLK-* format)
- Bulk product ID import (CSV upload)
- Product ID lookup API (already exists, needs enhancement)
- GTIN validation and verification

**Current Status:**
- ✅ ProductIdentifier.sol contract exists
- ✅ GtinLinker.sol contract exists
- ✅ Basic product ID lookup in backend
- ❌ GTIN database integration missing
- ❌ Bulk import UI missing
- ❌ Private ID generation not implemented

**Files to Create/Modify:**
- `backend/api/product-ids.js` - Enhanced product ID management
- `backend/utils/gtin-validator.js` - GTIN validation logic
- `backend/utils/private-id-generator.js` - PLK-* ID generation
- `frontend/src/pages/ProductIdManager.jsx` - Product ID management UI
- `frontend/src/components/BulkImportModal.jsx` - CSV import component
- `frontend/src/utils/gtinLinker.js` - Already exists, needs enhancement

**API Endpoints:**
```
POST   /api/product-ids/register-gtin    - Register GTIN
POST   /api/product-ids/bulk-import      - Bulk import from CSV
GET    /api/product-ids/search            - Search products by ID
POST   /api/product-ids/generate-private - Generate PLK-* ID
GET    /api/product-ids/:id              - Get product ID details
```

---

## 🟡 Medium Priority Features

### 4. Role-Specific Dashboard Enhancements
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Time:** 2-3 weeks

**Description:**
Add specialized dashboards and features for Insurer and Resale roles, plus analytics for all dashboards.

**Requirements:**

**Insurer Dashboard:**
- Verify warranty claims
- Bulk verification interface
- API key management for automated verification
- Claim history and analytics
- Fraud detection alerts

**Resale Dashboard:**
- List products for resale
- Verified badge system
- Secondary market integration
- Resale history tracking
- Commission tracking

**Analytics for All Dashboards:**
- Product count and value metrics
- Transfer statistics
- Time-in-inventory tracking
- Revenue/expense reports (for retailers/buyers)
- Export to CSV/PDF

**Files to Create:**
- `frontend/src/pages/InsurerDashboard.jsx` - New insurer dashboard
- `frontend/src/pages/ResaleDashboard.jsx` - New resale dashboard
- `frontend/src/components/AnalyticsWidget.jsx` - Reusable analytics component
- `frontend/src/utils/analytics.js` - Analytics calculation utilities
- `backend/api/analytics.js` - Analytics API endpoints

---

### 5. Enhanced Public Verification Page
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Time:** 1-2 weeks

**Description:**
Complete the public verification page with product ID lookup, shareable links, and exportable certificates.

**Current Status:**
- ✅ Basic verification page exists (`frontend/src/pages/PublicVerify.jsx`)
- ✅ Token ID verification works
- ❌ Product ID + serial lookup partially implemented
- ❌ Shareable proof links missing
- ❌ Exportable certificates missing

**Requirements:**
- Complete product ID + serial number lookup
- Generate shareable verification links
- Export verification certificate as PDF
- QR code for verification link
- Social media sharing buttons
- Print-friendly verification page
- Verification history tracking

**Files to Modify:**
- `frontend/src/pages/PublicVerify.jsx` - Enhance existing page
- `backend/api/verify.js` - Enhance product lookup
- `frontend/src/utils/certificate-generator.js` - PDF certificate generation

---

### 6. Billing & Subscription System
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Time:** 2-3 weeks

**Description:**
Implement Stripe integration for various paid features and services.

**Pricing Tiers:**
- GTIN registration: 30% cut of registration fee
- Premium storage: ₹99/month (extra IPFS storage)
- Verify API: ₹2/call (for external API access)
- Resale badge: ₹10/listing (verified resale badge)
- Enterprise plan: Custom pricing

**Requirements:**
- Stripe payment integration
- Subscription management UI
- Usage tracking and billing
- Invoice generation and email delivery
- Payment history dashboard
- Refund handling
- Webhook handling for payment events

**Files to Create:**
- `backend/payments/stripe-service.js` - Stripe integration
- `backend/payments/billing-routes.js` - Billing API endpoints
- `frontend/src/pages/BillingDashboard.jsx` - Billing management UI
- `frontend/src/components/SubscriptionModal.jsx` - Subscription UI

**API Endpoints:**
```
POST   /api/billing/create-subscription  - Create subscription
GET    /api/billing/subscription        - Get subscription status
POST   /api/billing/cancel-subscription  - Cancel subscription
GET    /api/billing/invoices            - Get invoice history
POST   /api/billing/webhook             - Stripe webhook handler
```

---

### 7. Multi-Wallet Support (WalletKit/Web3Modal)
**Priority:** Medium  
**Complexity:** Low-Medium  
**Estimated Time:** 1-2 weeks

**Description:**
Allow users to connect with ANY wallet (not just MetaMask) - Coinbase Wallet, WalletConnect, Rainbow, etc. This is much simpler than custodial wallets - users still manage their own keys, but can choose their preferred wallet.

**Current Status:**
- ✅ Currently only supports MetaMask (`window.ethereum`)
- ❌ No support for other wallets
- ❌ No WalletConnect support

**Requirements:**
- Integrate WalletKit or Web3Modal (WalletConnect's modal)
- Support multiple wallet providers:
  - MetaMask (existing)
  - Coinbase Wallet
  - WalletConnect (mobile wallets via QR code)
  - Rainbow Wallet
  - Trust Wallet
  - Any EIP-1193 compatible wallet
- Beautiful wallet selection modal
- Mobile wallet support via WalletConnect
- Maintain existing functionality (network switching, account changes)

**What This Does:**
- Shows a modal with all available wallet options
- User clicks their preferred wallet → connects
- Works on desktop and mobile
- Users still own their keys (non-custodial)
- Much simpler than Privy/Web3Auth (no backend needed)

**What This Does NOT Do:**
- ❌ No email/phone login (users still need a wallet)
- ❌ No custodial key storage
- ❌ No gasless transactions
- ❌ Users must still have a wallet installed

**Files to Modify:**
- `frontend/src/context/Web3Context.jsx` - Replace MetaMask-only logic with WalletKit
- `frontend/src/components/WalletConnectButton.jsx` - New wallet connection button
- `frontend/src/App.jsx` - Add WalletKit provider

**Dependencies:**
- `@walletconnect/web3modal` or `@web3modal/ethers` (WalletConnect)
- OR `@mysten/wallet-kit` (if using Sui, but we're on Ethereum)
- OR `wagmi` + `@rainbow-me/rainbowkit` (popular choice for Ethereum)

**Recommended Approach:**
Use **RainbowKit** (`@rainbow-me/rainbowkit`) - it's the most popular and well-maintained:
- Beautiful UI out of the box
- Supports all major wallets
- Easy integration with ethers.js
- Great mobile support via WalletConnect

**Note:** This is a MUCH simpler approach than Privy/Web3Auth. Users still need wallets, but they can choose any wallet they prefer. For true non-crypto-user onboarding (email login), we'd need Privy/Web3Auth later, but that's deferred.

---

### 8. Verification Service Hardening
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Time:** 1-2 weeks

**Description:**
Complete the real-time verification system and add fallback mechanisms.

**Current Status:**
- ✅ IDfy integration exists (`backend/verification/idfy-service.js`)
- ✅ EU VAT verification works
- ❌ Needs API keys configuration
- ❌ Fallback review queue missing
- ❌ Verification status dashboard missing

**Requirements:**
- Complete IDfy API key setup guide
- Manual review queue for failed verifications
- Verification status dashboard for admins
- Audit log export functionality
- Retry mechanism for failed verifications
- Verification analytics

**Files to Create/Modify:**
- `backend/verification/review-queue.js` - Manual review system
- `frontend/src/pages/AdminVerificationDashboard.jsx` - Admin dashboard
- `backend/verification/audit-log.js` - Audit logging

---

## 🟢 Low Priority Features

### 9. Progressive Web App (PWA)
**Priority:** Low  
**Complexity:** Medium  
**Estimated Time:** 2-3 weeks

**Description:**
Convert the React app into a Progressive Web App for better mobile experience.

**Requirements:**
- Service worker for offline support
- App manifest for installability
- Offline data caching
- Push notifications
- Background sync
- Install prompts
- App icons and splash screens

**Files to Create/Modify:**
- `frontend/public/manifest.json` - PWA manifest
- `frontend/public/sw.js` - Service worker
- `frontend/vite.config.js` - PWA plugin configuration

**Dependencies:**
- `vite-plugin-pwa` or similar

---

### 10. Mobile App (React Native)
**Priority:** Low (PWA first)  
**Complexity:** High  
**Estimated Time:** 6-8 weeks

**Description:**
Native mobile app with enhanced features like NFC support and biometric authentication.

**Requirements:**
- React Native app
- Native camera integration
- NFC support (tap to scan)
- Offline mode with sync
- Push notifications
- Biometric authentication
- App store deployment (iOS & Android)

**Note:** Consider PWA first as it's faster to implement and covers most use cases.

---

## 📊 Feature Summary

| Feature | Priority | Complexity | Estimated Time |
|---------|----------|------------|----------------|
| Webhook System | High | Medium | 2-3 weeks |
| Scanner Integration | High | Medium | 1-2 weeks |
| Product ID Management | High | High | 3-4 weeks |
| Role-Specific Dashboards | Medium | Medium | 2-3 weeks |
| Enhanced Verification | Medium | Medium | 1-2 weeks |
| Billing System | Medium | Medium | 2-3 weeks |
| Multi-Wallet Support | Medium | Low-Medium | 1-2 weeks |
| Verification Hardening | Medium | Medium | 1-2 weeks |
| PWA | Low | Medium | 2-3 weeks |
| Mobile App | Low | High | 6-8 weeks |

**Total Estimated Time (if done sequentially):** 20-35 weeks

---

## 🎯 Recommended Implementation Order

1. **Scanner Integration** (Quick win, high value)
2. **Webhook System** (Enables enterprise integration)
3. **Product ID Management** (Core functionality)
4. **Enhanced Verification** (Complete existing feature)
5. **Role-Specific Dashboards** (Expand user base)
6. **Billing System** (Monetization)
7. **Multi-Wallet Support** (Better UX, more wallet options)
8. **Verification Hardening** (Reliability)
9. **PWA** (Mobile experience)
10. **Mobile App** (If needed after PWA)

---

## 📝 Notes

- Features are organized by priority and complexity
- Estimated times are rough estimates and may vary
- Some features can be developed in parallel
- Consider MVP versions first, then iterate
- User feedback should guide priority adjustments

---

**Next Steps:**
1. Review this backlog with the team
2. Prioritize based on business needs
3. Break down high-priority features into tasks
4. Start with the first feature in the recommended order

