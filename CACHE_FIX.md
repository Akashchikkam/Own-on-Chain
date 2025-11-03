# Cache Fix Instructions

The browser is loading a cached version of the old code.

## Quick Fix:

1. **Hard Refresh your browser:**
   - **Chrome/Edge (Windows/Linux):** `Ctrl + Shift + R`
   - **Chrome/Edge (Mac):** `Cmd + Shift + R`
   - **Firefox:** `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
   - **Safari:** `Cmd + Option + R`

2. **Or clear browser cache:**
   - Open DevTools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

3. **If still not working:**
   - Close all browser tabs
   - Clear browser cache completely
   - Reopen the app

The frontend code now uses the backend API (`/api/product/:tokenId`) instead of direct RPC calls.

