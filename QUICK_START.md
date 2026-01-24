# Quick Start - VPS Deployment

Follow these steps to quickly deploy your Finance Analytics application on Hostinger VPS.

## Prerequisites
- Hostinger VPS with Ubuntu (20.04 or later)
- Root or sudo access
- Your VPS IP address
- OpenAI API key

## Step-by-Step Instructions

### 1. Connect to Your VPS
```bash
ssh root@YOUR_VPS_IP
```
Replace `YOUR_VPS_IP` with your actual VPS IP address from Hostinger.

### 2. Run Initial Setup (One-Time)
Copy and paste this entire block into your terminal:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required software
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y python3 python3-pip python3-venv nodejs nginx git

# Clone your repository
cd /var/www
sudo git clone https://github.com/Sakeel-M/Financial_bakcend.git finance-app
cd finance-app
sudo chown -R $USER:$USER /var/www/finance-app

# Setup backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-actual-key-here
FLASK_ENV=production
PORT=5000
EOF

echo "⚠️  IMPORTANT: Edit the .env file and add your real OpenAI API key"
echo "Run: nano .env"
read -p "Press Enter after updating the API key..."

deactivate

# Setup frontend
cd ../frontend
npm install

# Create frontend .env
cat > .env << EOF
VITE_API_URL=http://YOUR_VPS_IP
EOF

echo "⚠️  IMPORTANT: Edit the frontend .env file with your VPS IP"
echo "Run: nano .env"
read -p "Press Enter after updating the VPS IP..."

npm run build

# Setup systemd service
sudo cp ../finance-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable finance-backend
sudo systemctl start finance-backend

# Setup Nginx
sudo cp ../nginx.conf /etc/nginx/sites-available/finance-app

echo "⚠️  IMPORTANT: Edit Nginx config and replace 'your-domain.com' with your VPS IP or domain"
echo "Run: sudo nano /etc/nginx/sites-available/finance-app"
read -p "Press Enter after updating the domain/IP..."

sudo ln -s /etc/nginx/sites-available/finance-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

# Make deploy script executable
chmod +x deploy.sh

echo "✅ Setup complete!"
echo ""
echo "Access your application at: http://YOUR_VPS_IP"
echo ""
echo "To deploy updates in the future, run: sudo ./deploy.sh"
```

### 3. Verify Deployment

Check if services are running:
```bash
# Check backend service
sudo systemctl status finance-backend

# Check Nginx
sudo systemctl status nginx

# View backend logs
sudo journalctl -u finance-backend -n 50
```

### 4. Access Your Application

Open your browser and go to:
```
http://YOUR_VPS_IP
```

## Important Configuration Changes

Before your app works properly, you MUST update these files:

### 1. Backend .env file
```bash
nano /var/www/finance-app/backend/.env
```
Replace `sk-your-actual-key-here` with your real OpenAI API key.

### 2. Frontend .env file
```bash
nano /var/www/finance-app/frontend/.env
```
Replace `YOUR_VPS_IP` with your actual VPS IP address.

### 3. Nginx configuration
```bash
sudo nano /etc/nginx/sites-available/finance-app
```
Replace `your-domain.com` with your actual domain or VPS IP address.

After making these changes:
```bash
# Rebuild frontend
cd /var/www/finance-app/frontend
npm run build

# Restart services
sudo systemctl restart finance-backend
sudo systemctl restart nginx
```

## Future Updates

When you push code changes to GitHub:
```bash
cd /var/www/finance-app
sudo ./deploy.sh
```

This script will automatically:
- Pull latest code from GitHub
- Update dependencies
- Rebuild frontend
- Restart services

## Troubleshooting

### Application not loading?
```bash
# Check backend status
sudo systemctl status finance-backend
sudo journalctl -u finance-backend -n 50

# Check Nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Backend errors?
```bash
# View detailed logs
sudo journalctl -u finance-backend -f

# Restart backend
sudo systemctl restart finance-backend
```

### File upload issues?
Make sure nginx.conf has:
```nginx
client_max_body_size 50M;
```

### Port conflicts?
```bash
# Check what's using port 5000
sudo netstat -tlnp | grep 5000
```

## Optional: Setup SSL (Recommended for Production)

After your domain is pointing to your VPS:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot will automatically configure SSL and update your Nginx config.

## Getting Help

- View logs: `sudo journalctl -u finance-backend -f`
- Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Service status: `sudo systemctl status finance-backend nginx`
- GitHub Issues: https://github.com/Sakeel-M/Financial_bakcend/issues

## Security Checklist

- [ ] Changed default SSH port (optional but recommended)
- [ ] Setup SSH key authentication
- [ ] Disabled root password login
- [ ] Configured firewall (UFW)
- [ ] Setup SSL certificate
- [ ] Regular system updates
- [ ] Secure .env files (never commit to Git)
- [ ] Setup automated backups

---

**Next Steps:**
1. Test file upload functionality
2. Setup SSL certificate
3. Configure automated backups
4. Setup monitoring (optional)
5. Add your custom domain
