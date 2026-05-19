# 🔧 Fix Odoo Connection Refused

## Common Issues & Fixes

### Issue 1: Docker Desktop Not Running

**Symptom:** `ERR_CONNECTION_REFUSED`

**Fix:**
1. Open **Docker Desktop** application
2. Wait for it to fully start (whale icon in menu bar)
3. Try accessing Odoo again

**Check:**
```bash
docker info
```
If this fails, Docker Desktop is not running.

---

### Issue 2: Container Not Running

**Check:**
```bash
docker ps | grep odoo
```

**If not running, start it:**
```bash
docker start odoo-test
```

**Or create new:**
```bash
docker run -d --name odoo-test -p 8069:8069 odoo:latest
```

---

### Issue 3: Port Already in Use

**Check:**
```bash
lsof -i :8069
```

**If port is used, use different port:**
```bash
docker run -d --name odoo-test -p 8070:8069 odoo:latest
```
Then access: http://localhost:8070

---

### Issue 4: Container Crashed

**Check logs:**
```bash
docker logs odoo-test
```

**Restart:**
```bash
docker restart odoo-test
```

**Or recreate:**
```bash
docker stop odoo-test
docker rm odoo-test
docker run -d --name odoo-test -p 8069:8069 odoo:latest
```

---

## Quick Fix Script

**Run diagnostic:**
```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/odoo
./DIAGNOSE.sh
```

This will check everything and tell you what's wrong.

---

## Alternative: Use Test ERP (No Docker)

If Docker keeps having issues, use the test ERP:

```bash
cd /Users/c.v.akash/Own-on-Chain/erp-integration/examples
WEBHOOK_SECRET="c2a1ca77137f237adf7658a99e3c58208983908d82dd27f6572969376f25e9f6" node erp-integration-complete.js
```

Works the same, no Docker needed!

---

## Step-by-Step Fix

1. **Check Docker Desktop is running**
2. **Run diagnostic:** `./DIAGNOSE.sh`
3. **Follow the output** - it will tell you what to fix
4. **Wait 1-2 minutes** after starting container
5. **Try accessing:** http://localhost:8069

