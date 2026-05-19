# 🔧 Fix Odoo Connection Issue

## Problem: ERR_CONNECTION_REFUSED

This means Odoo container isn't running or Docker isn't available.

---

## Solution 1: Check Docker

**Is Docker installed?**
```bash
docker --version
```

**If not installed:**
- Install Docker Desktop: https://www.docker.com/products/docker-desktop
- Start Docker Desktop application
- Wait for it to fully start

---

## Solution 2: Start Odoo Manually

**Check if container exists:**
```bash
docker ps -a | grep odoo
```

**Start Odoo:**
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/odoo
docker run -d --name odoo-test -p 8069:8069 -v "$(pwd)/custom-addons:/mnt/extra-addons" odoo:latest
```

**Wait 1-2 minutes, then check:**
```bash
curl http://localhost:8069
```

---

## Solution 3: Use Test ERP Instead (Faster)

If Docker isn't working, use our test ERP server instead:

```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6" node erp-integration-complete.js
```

This starts a test ERP on port 3002 that works exactly like Odoo for testing.

---

## Quick Check Commands

```bash
# Check Docker
docker ps

# Check Odoo container
docker ps | grep odoo

# Check Odoo logs
docker logs odoo-test

# Restart Odoo
docker restart odoo-test
```

---

## Alternative: Use Test ERP (Recommended if Docker Issues)

The test ERP server works the same way and is easier to set up:

1. **Start test ERP:**
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6" node erp-integration-complete.js
```

2. **Register webhook:** `http://localhost:3002/webhooks/own-on-chain`

3. **Test:** Same as Odoo, but simpler setup

---

**Try Solution 3 (Test ERP) - it's faster and works the same!**

