# ✅ EmeraBooks Deployment Checklist

**Print this or keep it open while deploying!**

---

## 🎯 Goal
Get your code live on emerabooks.com with automatic deployment

**Time Required:** 20 minutes
**Difficulty:** Easy ⚡

---

## 📋 PART 1: Deploy Current Code (5 min)

### Commands:
```powershell
ssh root@72.60.222.167
cd /var/www/emerabooks
git pull origin main
sudo ./deploy-hostinger.sh
exit
```

### Checkpoints:
- [ ] SSH connected successfully
- [ ] Saw "Deployment completed successfully!" message
- [ ] Visited emerabooks.com (Ctrl+Shift+R to refresh)
- [ ] Site shows latest changes

**✅ IF ALL CHECKED: Proceed to Part 2**
**❌ IF ANY FAILED: Check troubleshooting in START_HERE.md**

---

## 🤖 PART 2A: Generate SSH Keys (3 min)

### Command:
```powershell
cd "C:\Users\AI Eagles\OneDrive\Desktop\BookKeeping-master"
.\setup-github-deploy.ps1
```

### What to expect:
1. Script generates SSH keys
2. Shows PUBLIC KEY (copy it!)
3. Waits for you to add key to VPS

### Checkpoint:
- [ ] Script ran without errors
- [ ] PUBLIC KEY copied to clipboard

---

## 🔑 PART 2B: Add Key to VPS (2 min)

### Commands (in NEW PowerShell window):
```powershell
ssh root@72.60.222.167
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Paste key, Ctrl+X, Y, Enter
chmod 600 ~/.ssh/authorized_keys
exit
```

### Checkpoints:
- [ ] Connected to VPS
- [ ] Opened authorized_keys in nano
- [ ] Pasted public key (right-click)
- [ ] Saved file (Ctrl+X, Y, Enter)
- [ ] Set permissions (chmod 600)
- [ ] Exited VPS

**Back to original PowerShell window:**
- [ ] Pressed Enter to continue script
- [ ] Saw "✓ SSH connection successful!"

---

## 🔐 PART 2C: Configure GitHub (5 min)

### URL:
https://github.com/Sakeel-M/EmeraBooks/settings/secrets/actions

### Create 3 Secrets:

#### Secret 1:
- [ ] Clicked "New repository secret"
- [ ] Name: `VPS_SSH_KEY`
- [ ] Value: **PRIVATE KEY from PowerShell** (entire key including BEGIN/END)
- [ ] Clicked "Add secret"

#### Secret 2:
- [ ] Clicked "New repository secret"
- [ ] Name: `VPS_HOST`
- [ ] Value: `72.60.222.167`
- [ ] Clicked "Add secret"

#### Secret 3:
- [ ] Clicked "New repository secret"
- [ ] Name: `VPS_USER`
- [ ] Value: `root`
- [ ] Clicked "Add secret"

### Final Check:
- [ ] See 3 secrets listed on GitHub page
- [ ] Returned to PowerShell
- [ ] Typed 'y' when script asks if secrets configured
- [ ] Saw "Setup Complete! ✓"

---

## 🧪 PART 3: Test Auto-Deployment (5 min)

### Make Test Change:
```powershell
cd "C:\Users\AI Eagles\OneDrive\Desktop\BookKeeping-master"
Add-Content -Path README.md -Value "`n---`nTest deploy: $(Get-Date)"
```

- [ ] Test line added to README.md

### Commit and Push:
```powershell
git add README.md
git commit -m "Test auto-deployment"
git push origin main
```

- [ ] Committed successfully
- [ ] Pushed to GitHub

### Watch Deployment:
**Open:** https://github.com/Sakeel-M/EmeraBooks/actions

- [ ] See workflow running (yellow dot 🟡)
- [ ] Clicked on workflow to see details
- [ ] Waited 2-3 minutes
- [ ] Saw green checkmark ✅
- [ ] All steps completed successfully

### Verify Live Site:
**Open:** https://emerabooks.com

- [ ] Pressed Ctrl + Shift + R (hard refresh)
- [ ] Site loaded successfully
- [ ] Changes are visible

---

## 🎉 SUCCESS CRITERIA

### All of these should be TRUE:

✅ **Deployment Status:**
- [ ] Can access emerabooks.com
- [ ] Site shows latest code
- [ ] No error messages

✅ **GitHub Actions:**
- [ ] Workflow completed successfully
- [ ] Green checkmark visible
- [ ] No failed steps

✅ **Auto-Deploy:**
- [ ] Test push triggered automatic deployment
- [ ] Changes appeared on live site
- [ ] Process took ~2-3 minutes

✅ **Configuration:**
- [ ] 3 GitHub Secrets configured
- [ ] SSH key pair generated
- [ ] VPS has public key
- [ ] GitHub has private key

---

## 📊 Quick Health Check

Run these to verify everything:

```powershell
# Test SSH connection
ssh -i $env:USERPROFILE\.ssh\emerabooks_deploy root@72.60.222.167 "echo 'Connection OK'"

# Check if secrets are set (view in browser)
# https://github.com/Sakeel-M/EmeraBooks/settings/secrets/actions
```

**Expected results:**
- SSH command returns "Connection OK"
- GitHub shows 3 secrets (VPS_SSH_KEY, VPS_HOST, VPS_USER)

---

## 🚨 If Something Failed

### Check these in order:

1. **Manual deployment failed?**
   - Check if /var/www/emerabooks exists on VPS
   - Verify git repository is accessible
   - Check VPS has internet connection

2. **SSH key test failed?**
   - Verify public key was pasted correctly
   - Check authorized_keys permissions (should be 600)
   - Ensure no extra spaces/lines in key

3. **GitHub Actions failed?**
   - Check all 3 secrets are set correctly
   - Verify VPS_SSH_KEY has complete private key
   - Review workflow logs for specific error

4. **Site not updating?**
   - Clear browser cache (Ctrl+Shift+Delete)
   - Check GitHub Actions completed successfully
   - SSH into VPS and check logs:
     ```bash
     sudo journalctl -u emerabooks-backend -n 50
     ```

---

## 🎯 Next Steps After Success

### Your new workflow:
```
1. Make changes locally
2. git push origin main
3. Auto-deploys in 2-3 min ✨
```

### Monitor deployments:
- **GitHub Actions**: https://github.com/Sakeel-M/EmeraBooks/actions
- **Live Site**: https://emerabooks.com

### Optional enhancements:
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Configure email notifications for failed deployments
- [ ] Add staging environment
- [ ] Set up automated backups

---

## 📝 Notes Section

Use this space to record:
- Issues encountered:
- Solutions that worked:
- Custom configurations:
- Important reminders:

---

**Date Completed:** _______________

**Deployed By:** _______________

**Status:** ⬜ In Progress  |  ⬜ Completed  |  ⬜ Needs Review

---

*Keep this checklist for reference and future deployments!*
