# 🚀 Quick Deployment Guide

## Option 1: Automatic Deployment (Recommended)

**Setup once, deploy forever!**

### One-Time Setup (10 minutes):

1. **Run PowerShell script** (on your Windows machine):
   ```powershell
   cd "C:\Users\AI Eagles\OneDrive\Desktop\BookKeeping-master"
   .\setup-github-deploy.ps1
   ```

   Follow the on-screen instructions to:
   - Generate SSH keys
   - Add public key to VPS
   - Configure GitHub Secrets

2. **Done!** Now every `git push origin main` automatically deploys! 🎉

### Daily Usage:
```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main

# That's it! Check deployment at:
# https://github.com/Sakeel-M/EmeraBooks/actions
```

**Deployment time:** 2-3 minutes after push

---

## Option 2: Manual Deployment

### When to use:
- First-time setup
- Emergency deployments
- Troubleshooting

### Steps:

```bash
# 1. SSH into VPS
ssh root@72.60.222.167

# 2. Navigate to app
cd /var/www/emerabooks

# 3. Pull latest code
git pull origin main

# 4. Deploy
sudo ./deploy-hostinger.sh

# 5. Exit
exit
```

### Then visit:
- **Website:** https://emerabooks.com
- Press **Ctrl + Shift + R** to hard refresh

**Deployment time:** 5 minutes

---

## 🔍 Check Deployment Status

### GitHub Actions:
https://github.com/Sakeel-M/EmeraBooks/actions

### VPS Logs:
```bash
ssh root@72.60.222.167
sudo journalctl -u emerabooks-backend -n 50
```

### Service Status:
```bash
ssh root@72.60.222.167
sudo systemctl status emerabooks-backend nginx
```

---

## 🆘 Common Issues

### Issue: "Site still shows old code"

**Solution:**
1. Hard refresh browser: **Ctrl + Shift + R**
2. Clear cache: **Ctrl + Shift + Delete**
3. Try incognito mode

### Issue: "GitHub Actions deployment failed"

**Solutions:**
1. Check workflow logs in GitHub Actions
2. Verify GitHub Secrets are configured:
   - `VPS_SSH_KEY`
   - `VPS_HOST` = `72.60.222.167`
   - `VPS_USER` = `root`
3. Test SSH connection:
   ```powershell
   ssh -i $env:USERPROFILE\.ssh\emerabooks_deploy root@72.60.222.167
   ```

### Issue: "deploy-hostinger.sh not found"

**Solution:**
```bash
ssh root@72.60.222.167
cd /var/www/emerabooks
git pull origin main
chmod +x deploy-hostinger.sh
sudo ./deploy-hostinger.sh
```

### Issue: "Permission denied"

**Solution:**
```bash
ssh root@72.60.222.167
sudo chown -R www-data:www-data /var/www/emerabooks
sudo chmod -R 755 /var/www/emerabooks
```

---

## 📚 Detailed Guides

- **Full Setup Guide:** `SETUP_AUTO_DEPLOY.md`
- **Deployment Documentation:** `HOSTINGER_DEPLOYMENT.md`
- **Quick Start:** `HOSTINGER_QUICK_START.md`

---

## ✅ Deployment Checklist

### First-Time Setup:
- [ ] Run `setup-github-deploy.ps1`
- [ ] Add public key to VPS
- [ ] Configure GitHub Secrets (3 secrets)
- [ ] Test deployment with small change
- [ ] Verify auto-deployment works

### Regular Development:
- [ ] Make changes locally
- [ ] Test locally if possible
- [ ] Commit changes
- [ ] Push to main branch
- [ ] Wait 2-3 minutes
- [ ] Verify changes live on emerabooks.com

---

## 🎯 Workflow Summary

```
1. Code locally
2. git push origin main
3. GitHub Actions triggers
4. Deploys to VPS
5. Live in 2-3 minutes! ✨
```

**That's it! No SSH needed!** 🚀
