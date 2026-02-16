# Deploy Latest Changes to emerabooks.com

## Quick Deploy Commands

SSH into your server and run:

```bash
# SSH into your VPS
ssh root@emerabooks.com
# Or: ssh your-username@your-vps-ip

# Navigate to application directory
cd /var/www/emerabooks
# Or it might be: cd /var/www/finance-app (check which exists)

# Pull latest code from GitHub
git pull origin main

# Update and rebuild FRONTEND
cd Frontend  # Note: Capital F
npm install
npm run build

# If Frontend directory doesn't exist, try:
# cd frontend
# npm install
# npm run build

# Update BACKEND
cd ../backend
source venv/bin/activate
pip install -r requirements.txt --upgrade
deactivate

# Restart services
sudo systemctl restart emerabooks-backend
# Or if service has different name: sudo systemctl restart finance-backend

sudo systemctl reload nginx

# Verify services are running
sudo systemctl status emerabooks-backend
sudo systemctl status nginx
```

## If You Don't Know Your Directory Structure

Find where your app is installed:

```bash
# Find the application directory
sudo find /var/www -name "package.json" -type f 2>/dev/null

# Check what's in /var/www
ls -la /var/www/

# Check running services
sudo systemctl list-units | grep -E "backend|finance|emera"
```

## After Deployment

1. **Clear your browser cache**:
   - Chrome/Edge: Ctrl + Shift + Delete
   - Or try: Ctrl + F5 (hard refresh)
   - Or open in incognito/private mode

2. **Verify the update**:
   - Check browser console for errors (F12)
   - Check if new files are loading

## Troubleshooting

### If frontend build fails:
```bash
cd /var/www/emerabooks/Frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### If backend fails:
```bash
cd /var/www/emerabooks/backend
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
sudo systemctl restart emerabooks-backend
sudo journalctl -u emerabooks-backend -n 50
```

### Check Nginx is serving the right directory:
```bash
sudo nano /etc/nginx/sites-available/emerabooks
# Or: sudo nano /etc/nginx/sites-available/finance-app

# Look for the "root" directive - it should point to:
# root /var/www/emerabooks/Frontend/dist;
# Or: root /var/www/finance-app/frontend/dist;
```

### If Nginx config needs update:
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload if test passes
```

## Still Showing Old Code?

Try these:

1. **Hard refresh browser**: Ctrl + Shift + R
2. **Clear DNS cache**:
   ```bash
   # On your local machine (Windows)
   ipconfig /flushdns
   ```
3. **Check build output**:
   ```bash
   ls -la /var/www/emerabooks/Frontend/dist/
   # Verify index.html exists and check timestamp
   ```
4. **Check Nginx logs**:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   sudo tail -f /var/log/nginx/access.log
   ```
