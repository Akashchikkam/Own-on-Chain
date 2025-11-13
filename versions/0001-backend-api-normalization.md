# Version 0001 Snapshot — Backend API Normalization

## Summary
- Introduced `getBackendApiUrl` helper to normalize backend endpoint construction.
- Replaced manual `VITE_BACKEND_URL` usages across dashboards, modals, and public verify flow.
- Ensured registration page derives API base from the helper.

## Diff Excerpts

```diff
--- a/frontend/src/components/SecureReceiveModal.jsx
+++ b/frontend/src/components/SecureReceiveModal.jsx
@@
-import { verifyReceipt, formatAddress } from '../utils/securityHelpers';
+import { verifyReceipt, formatAddress } from '../utils/securityHelpers';
+import { getBackendApiUrl } from '../utils/api';
@@
-      const response = await fetch(`${backendUrl}/api/confirmations`, {
+      const response = await fetch(getBackendApiUrl('/confirmations'), {
```

```diff
--- /dev/null
+++ b/frontend/src/utils/api.js
@@
+const DEFAULT_BACKEND_URL = 'http://localhost:3001';
+
+function normalizeBaseUrl(rawUrl) {
+  const url = (rawUrl || '').trim();
+  if (!url) {
+    return DEFAULT_BACKEND_URL;
+  }
+  return url.replace(/\/+$/, '');
+}
+
+export function getBackendBaseUrl() {
+  const rawUrl = import.meta.env?.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
+  const normalized = normalizeBaseUrl(rawUrl);
+  if (normalized.toLowerCase().endsWith('/api')) {
+    return normalized.slice(0, -4);
+  }
+  return normalized;
+}
+
+export function getBackendApiUrl(path = '') {
+  const baseUrl = getBackendBaseUrl();
+  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
+  const sanitizedPath = normalizedPath.replace(/^\/api\b/i, '');
+  return `${baseUrl}/api${sanitizedPath}`;
+}
```

```diff
--- a/frontend/src/pages/ProducerDashboard.jsx
+++ b/frontend/src/pages/ProducerDashboard.jsx
@@
-      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
-      // Ensure backendUrl doesn't end with /api (we'll add it)
-      const baseBackendUrl = backendUrl.replace(/\/api$/, '');
-
-      try {
-        const response = await fetch(`${baseBackendUrl}/api/qr-sheet/generate`, {
+      try {
+        const response = await fetch(getBackendApiUrl('/qr-sheet/generate'), {
@@
-          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
-          const baseBackendUrl = backendUrl.replace(/\/api$/, '');
-          const lookupResponse = await fetch(`${baseBackendUrl}/api/product/lookup/${encodeURIComponent(result.productId)}/${encodeURIComponent(result.serialNumber || '')}`);
+          const lookupResponse = await fetch(
+            getBackendApiUrl(`/product/lookup/${encodeURIComponent(result.productId)}/${encodeURIComponent(result.serialNumber || '')}`)
+          );
```

```diff
--- a/frontend/src/pages/Register.jsx
+++ b/frontend/src/pages/Register.jsx
@@
-// Backend API URL
-const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';
+// Backend API URL
+const BACKEND_API_URL = getBackendApiUrl();
```

## Files Covered
- `frontend/src/utils/api.js`
- `frontend/src/components/SecureReceiveModal.jsx`
- `frontend/src/pages/ProducerDashboard.jsx`
- `frontend/src/pages/DistributorDashboard.jsx`
- `frontend/src/pages/RetailerDashboard.jsx`
- `frontend/src/pages/BuyerDashboard.jsx`
- `frontend/src/pages/PublicVerify.jsx`
- `frontend/src/pages/Register.jsx`

