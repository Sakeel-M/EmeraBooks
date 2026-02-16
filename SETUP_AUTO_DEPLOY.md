# Setup Automatic Deployment to Hostinger

Complete guide to deploy current code and enable automatic deployments from GitHub.

---

## 🚀 Part 1: Deploy Current Code to Hostinger (Do This First!)

### Step 1: SSH into your Hostinger VPS

Open PowerShell or Command Prompt and run:

```bash
ssh root@72.60.222.167
```

Enter your root password when prompted.

### Step 2: Navigate to your application directory

```bash
cd /var/www/emerabooks
```

**If the directory doesn't exist**, you need to run initial setup first:
```bash
cd /var/www
git clone https://github.com/Sakeel-M/EmeraBooks.git emerabooks
cd emerabooks
```

### Step 3: Pull latest code

```bash
git pull origin main
```

### Step 4: Run deployment script

```bash
sudo ./deploy-hostinger.sh
```

This will:
- Update backend dependencies
- Rebuild frontend
- Restart services
- Verify deployment

### Step 5: Verify deployment

1. Visit **https://emerabooks.com** (or http://72.60.222.167)
2. Press **Ctrl + Shift + R** to hard refresh
3. You should see your updated code!

If you see errors, check logs:
```bash
sudo journalctl -u emerabooks-backend -n 50
```

---

## 🤖 Part 2: Enable Automatic Deployment from GitHub

Once Part 1 is working, set up automatic deployments:

### Step 1: Generate SSH Key for GitHub Actions

On your **local machine** (Windows), open PowerShell and run:

```powershell
# Navigate to your SSH directory
cd ~\.ssh

# Generate new SSH key
ssh-keygen -t ed25519 -C "github-actions-emerabooks" -f emerabooks_deploy
```

When prompted:
- Enter passphrase: **Just press Enter** (no passphrase for automation)
- Confirm passphrase: **Press Enter again**

This creates two files:
- `emerabooks_deploy` - Private key (for GitHub)
- `emerabooks_deploy.pub` - Public key (for VPS)

### Step 2: Add Public Key to Your VPS

Still in PowerShell:

```powershell
# Display the public key
Get-Content ~\.ssh\emerabooks_deploy.pub
```

Copy the entire output (starts with `ssh-ed25519`).

Now SSH into your VPS:

```bash
ssh root@72.60.222.167
```

Add the public key to authorized_keys:

```bash
# Create SSH directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key (paste the key you copied)
nano ~/.ssh/authorized_keys
```

In nano:
1. Scroll to the bottom
2. Paste your public key (right-click to paste)
3. Press **Ctrl + X**, then **Y**, then **Enter** to save

Set permissions:

```bash
chmod 600 ~/.ssh/authorized_keys
```

### Step 3: Test SSH Connection

On your **local machine**, test the new key:

```powershell
ssh -i ~\.ssh\emerabooks_deploy root@72.60.222.167
```

If it connects without asking for a password, **SUCCESS!** ✅

Type `exit` to disconnect.

### Step 4: Add Private Key to GitHub Secrets

#### Get your private key content:

On your **local machine** (PowerShell):

```powershell
Get-Content ~\.ssh\emerabooks_deploy
```

Copy the **entire output** including:
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- All the lines in between
- `-----END OPENSSH PRIVATE KEY-----`

#### Add to GitHub:

1. Go to: https://github.com/Sakeel-M/EmeraBooks/settings/secrets/actions

2. Click **"New repository secret"**

3. Create **VPS_SSH_KEY**:
   - Name: `VPS_SSH_KEY`
   - Secret: Paste the private key you copied
   - Click **"Add secret"**

4. Create **VPS_HOST**:
   - Click **"New repository secret"**
   - Name: `VPS_HOST`
   - Secret: `72.60.222.167`
   - Click **"Add secret"**

5. Create **VPS_USER**:
   - Click **"New repository secret"**
   - Name: `VPS_USER`
   - Secret: `root`
   - Click **"Add secret"**

You should now have **3 secrets** configured! ✅

### Step 5: Commit and Push the Workflow File

The workflow file has been created at `.github/workflows/deploy.yml`.

Commit and push it:

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions auto-deployment workflow"
git push origin main
```

### Step 6: Watch Your First Automatic Deployment! 🎉

1. Go to: https://github.com/Sakeel-M/EmeraBooks/actions

2. You should see a workflow run starting (triggered by your push)

3. Click on the workflow to watch it in real-time

4. Wait for the green checkmark ✅

5. Visit https://emerabooks.com to verify!

---

## 🧪 Part 3: Test Automatic Deployment

Let's test that future pushes automatically deploy:

### Step 1: Make a small change

Edit `README.md`:

```bash
# In your local repository
echo "" >> README.md
echo "Last deployed: $(date)" >> README.md
```

### Step 2: Commit and push

```bash
git add README.md
git commit -m "Test automatic deployment"
git push origin main
```

### Step 3: Watch the magic happen! ✨

1. Go to GitHub Actions: https://github.com/Sakeel-M/EmeraBooks/actions
2. See the deployment workflow start automatically
3. Watch it deploy
4. Visit https://emerabooks.com to see changes!

---

## ✅ Success Checklist

- [ ] Part 1: Manual deployment works (emerabooks.com shows latest code)
- [ ] Part 2: GitHub Actions workflow file committed
- [ ] Part 2: SSH keys generated and configured
- [ ] Part 2: GitHub Secrets configured (VPS_SSH_KEY, VPS_HOST, VPS_USER)
- [ ] Part 3: Test deployment successful
- [ ] Part 3: Site updates automatically on push to main

---

## 🆘 Troubleshooting

### Manual deployment failed

**Error: "Permission denied"**
```bash
sudo chown -R www-data:www-data /var/www/emerabooks
sudo chmod -R 755 /var/www/emerabooks
```

**Error: "deploy-hostinger.sh not found"**
```bash
cd /var/www/emerabooks
git pull origin main
chmod +x deploy-hostinger.sh
```

**Error: "emerabooks-backend service not found"**
You might be using the old service name:
```bash
sudo systemctl restart finance-backend
```

### GitHub Actions deployment failed

**Error: "Host key verification failed"**

SSH into your VPS once manually to accept the host key:
```bash
ssh -i ~\.ssh\emerabooks_deploy root@72.60.222.167
# Type 'yes' when prompted
exit
```

**Error: "Permission denied (publickey)"**

The public key wasn't added correctly. Re-do Step 2 of Part 2.

Verify the key exists on VPS:
```bash
ssh root@72.60.222.167
cat ~/.ssh/authorized_keys | grep "github-actions-emerabooks"
```

**Error: "script execution failed"**

Check VPS logs after the failed deployment:
```bash
ssh root@72.60.222.167
sudo journalctl -u emerabooks-backend -n 100 --no-pager
```

### Site still shows old code

1. **Clear browser cache**: Ctrl + Shift + Delete
2. **Hard refresh**: Ctrl + Shift + R
3. **Try incognito/private mode**
4. **Check build was successful**:
   ```bash
   ssh root@72.60.222.167
   ls -la /var/www/emerabooks/Frontend/dist/
   # Should show recent timestamps
   ```

---

## 🎯 What Happens Now

### Every time you push to main branch:

1. ✅ GitHub detects the push
2. ✅ Workflow starts automatically
3. ✅ Connects to your VPS via SSH
4. ✅ Pulls latest code
5. ✅ Runs deployment script
6. ✅ Restarts services
7. ✅ Your site is updated!

**Time:** ~2-3 minutes from push to live

### You can still deploy manually:

If you ever need to:
```bash
ssh root@72.60.222.167
cd /var/www/emerabooks
sudo ./deploy-hostinger.sh
```

---

## 📊 Monitoring Your Deployments

### View deployment history:
https://github.com/Sakeel-M/EmeraBooks/actions

### View VPS logs:
```bash
ssh root@72.60.222.167
sudo journalctl -u emerabooks-backend -f
```

### Check service status:
```bash
ssh root@72.60.222.167
sudo systemctl status emerabooks-backend nginx
```

---

## 🔒 Security Notes

✅ **SSH key is secure:**
- Private key never leaves GitHub's encrypted secrets
- Separate key from your personal SSH key
- Can be revoked anytime

✅ **Deployment is logged:**
- Every deployment recorded in GitHub Actions
- Shows who pushed, when, and what changed
- Can review history anytime

✅ **Can disable anytime:**
- Go to: https://github.com/Sakeel-M/EmeraBooks/settings/actions
- Disable Actions for this repository
- Or delete `.github/workflows/deploy.yml`

---

## 🎉 Congratulations!

You now have:
- ✅ Latest code deployed to emerabooks.com
- ✅ Automatic deployments on every push to main
- ✅ Full deployment history in GitHub
- ✅ Professional CI/CD pipeline

**No more manual SSH deployments needed!**

Just push your code and it goes live automatically! 🚀
