# EmeraBooks - Hostinger VPS Deployment Guide

Complete guide for deploying EmeraBooks (Financial Management Application) to Hostinger VPS.

## 🚨 SECURITY FIRST

**CRITICAL**: Your OpenAI API key is exposed in the repository!
1. Go to https://platform.openai.com/api-keys
2. Revoke the exposed key: `sk-proj-J7nKW9xvUc...`
3. Generate a new API key
4. Never commit `.env` files to Git

## Prerequisites

- Hostinger VPS (Ubuntu 20.04/22.04 recommended)
- SSH access to your VPS
- Domain name (optional but recommended)
- OpenAI API key (get new one from OpenAI dashboard)
- Supabase project (you already have this set up)

## Architecture Overview

**Frontend**: React + TypeScript + Vite + Supabase
**Backend**: Flask API with OpenAI integration
**Database**: Supabase (cloud-hosted PostgreSQL)
**Web Server**: Nginx
**Process Manager**: Systemd for Flask backend

## Quick Start - Automated Deployment

### Step 1: SSH into Your Hostinger VPS

```bash
ssh root@your-vps-ip
# Or if you have a non-root user:
ssh your-username@your-vps-ip
```

### Step 2: Run the Setup Script

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/Sakeel-M/EmeraBooks/main/setup-vps.sh -o setup-vps.sh
chmod +x setup-vps.sh
sudo ./setup-vps.sh
```

This will:
- Install all required software (Python, Node.js, Nginx, etc.)
- Clone your repository
- Set up directory structure
- Configure firewall

### Step 3: Configure Environment Variables

#### Backend Environment (.env)

```bash
cd /var/www/emerabooks/backend
sudo nano .env
```

Add your configuration:
```env
# OpenAI API Configuration
OPENAI_API_KEY=your_new_openai_api_key_here

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
PORT=5000

# Security - Generate a random secret key
SECRET_KEY=generate_a_strong_random_secret_key_here
```

To generate a strong secret key:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

#### Frontend Environment (.env)

```bash
cd /var/www/emerabooks/Frontend
sudo nano .env
```

Add your Supabase configuration:
```env
VITE_SUPABASE_PROJECT_ID=hnvwrxkjnnepnchjunel
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudndyeGtqbm5lcG5jaGp1bmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTAwNTksImV4cCI6MjA3ODUyNjA1OX0.O1nrpKaT0zd2KW5CixqyM8GqMQ1FruGn9bTz66Bhxcs
VITE_SUPABASE_URL=https://hnvwrxkjnnepnchjunel.supabase.co
```

### Step 4: Deploy the Application

```bash
cd /var/www/emerabooks
sudo ./deploy-hostinger.sh
```

### Step 5: Configure Domain (Optional)

If you have a domain:

```bash
# Update Nginx configuration
sudo nano /etc/nginx/sites-available/emerabooks

# Change server_name from your-vps-ip to:
server_name yourdomain.com www.yourdomain.com;

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Setup SSL Certificate (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts and select redirect HTTP to HTTPS
```

---

## Manual Deployment (Step-by-Step)

If you prefer manual deployment or troubleshooting:

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Required Software

```bash
# Install Python 3 and pip
sudo apt install python3 python3-pip python3-venv -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install Nginx
sudo apt install nginx -y

# Install Git
sudo apt install git -y

# Verify installations
python3 --version
node --version
npm --version
nginx -v
```

### 3. Clone Repository

```bash
# Create directory
sudo mkdir -p /var/www
cd /var/www

# Clone repository
sudo git clone https://github.com/Sakeel-M/EmeraBooks.git emerabooks
cd emerabooks

# Set permissions
sudo chown -R $USER:$USER /var/www/emerabooks
```

### 4. Setup Backend

```bash
cd /var/www/emerabooks/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file (see Step 3 above for content)
nano .env

# Test the backend
python app.py
# Press Ctrl+C to stop after confirming it works
deactivate
```

### 5. Setup Frontend

```bash
cd /var/www/emerabooks/Frontend

# Install dependencies
npm install

# Create .env file (see Step 3 above for content)
nano .env

# Build for production
npm run build

# Verify build output
ls -la dist/
```

### 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/emerabooks
```

Paste this configuration:
```nginx
# Backend API server
upstream flask_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-vps-ip;  # Replace with your domain or VPS IP

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Frontend - Serve React build
    location / {
        root /var/www/emerabooks/Frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://flask_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;

        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Increase upload size for file processing
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Logging
    access_log /var/log/nginx/emerabooks_access.log;
    error_log /var/log/nginx/emerabooks_error.log;
}
```

Enable the site:
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/emerabooks /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 7. Setup Systemd Service for Backend

```bash
sudo nano /etc/systemd/system/emerabooks-backend.service
```

Paste this configuration:
```ini
[Unit]
Description=EmeraBooks Flask Backend API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/emerabooks/backend
Environment="PATH=/var/www/emerabooks/backend/venv/bin"
Environment="FLASK_ENV=production"
ExecStart=/var/www/emerabooks/backend/venv/bin/python app.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/emerabooks/backend.log
StandardError=append:/var/log/emerabooks/backend.error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Create log directory and start service:
```bash
# Create log directory
sudo mkdir -p /var/log/emerabooks
sudo chown www-data:www-data /var/log/emerabooks

# Set permissions
sudo chown -R www-data:www-data /var/www/emerabooks

# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl enable emerabooks-backend
sudo systemctl start emerabooks-backend

# Check status
sudo systemctl status emerabooks-backend
```

### 8. Configure Firewall

```bash
# Allow Nginx
sudo ufw allow 'Nginx Full'

# Allow SSH
sudo ufw allow OpenSSH

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Verification & Testing

### Check if services are running:

```bash
# Check backend service
sudo systemctl status emerabooks-backend

# Check Nginx
sudo systemctl status nginx

# Check if port 5000 is listening
sudo netstat -tlnp | grep 5000

# Check if port 80 is listening
sudo netstat -tlnp | grep 80
```

### Test the application:

1. Open browser: `http://your-vps-ip`
2. You should see the EmeraBooks dashboard
3. Test API: `http://your-vps-ip/api/health` (if you have a health endpoint)

### View logs:

```bash
# Backend logs
sudo journalctl -u emerabooks-backend -f

# Or view log files
sudo tail -f /var/log/emerabooks/backend.log
sudo tail -f /var/log/emerabooks/backend.error.log

# Nginx logs
sudo tail -f /var/log/nginx/emerabooks_access.log
sudo tail -f /var/log/nginx/emerabooks_error.log
```

---

## Updating Your Application

When you push changes to GitHub:

```bash
cd /var/www/emerabooks
sudo ./deploy-hostinger.sh
```

Or manually:
```bash
cd /var/www/emerabooks
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt --upgrade
deactivate
sudo systemctl restart emerabooks-backend

# Update frontend
cd ../Frontend
npm install
npm run build

# Reload Nginx
sudo systemctl reload nginx
```

---

## Troubleshooting

### Backend not starting

```bash
# Check logs
sudo journalctl -u emerabooks-backend -n 100 --no-pager

# Test manually
cd /var/www/emerabooks/backend
source venv/bin/activate
python app.py
```

### Frontend showing blank page

```bash
# Check if build exists
ls -la /var/www/emerabooks/Frontend/dist/

# Rebuild
cd /var/www/emerabooks/Frontend
npm run build

# Check Nginx configuration
sudo nginx -t
```

### API calls not working

```bash
# Check if backend is running
curl http://localhost:5000

# Check Nginx proxy configuration
sudo nginx -t

# View Nginx error log
sudo tail -f /var/log/nginx/emerabooks_error.log
```

### Permission errors

```bash
sudo chown -R www-data:www-data /var/www/emerabooks
sudo chmod -R 755 /var/www/emerabooks
```

### Supabase connection issues

Check Frontend .env file has correct Supabase credentials and rebuild:
```bash
cd /var/www/emerabooks/Frontend
nano .env  # Verify credentials
npm run build
```

---

## Performance Optimization

### 1. Enable Gzip Compression

```bash
sudo nano /etc/nginx/nginx.conf
```

Add inside `http` block:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript
           application/javascript application/json application/xml+rss
           application/vnd.ms-fontobject application/x-font-ttf
           font/opentype image/svg+xml image/x-icon;
```

### 2. Use Gunicorn for Production (Recommended)

```bash
cd /var/www/emerabooks/backend
source venv/bin/activate
pip install gunicorn

# Test gunicorn
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

Update systemd service:
```bash
sudo nano /etc/systemd/system/emerabooks-backend.service
```

Change ExecStart to:
```ini
ExecStart=/var/www/emerabooks/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 --timeout 120 app:app
```

Restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart emerabooks-backend
```

---

## Monitoring

### Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/emerabooks
```

```
/var/log/emerabooks/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

### Monitor Resources

```bash
# CPU and Memory usage
htop

# Disk usage
df -h

# Service status
systemctl status emerabooks-backend nginx
```

---

## Security Best Practices

1. ✅ Never commit `.env` files
2. ✅ Rotate the exposed OpenAI API key immediately
3. ✅ Use strong SECRET_KEY for Flask
4. ✅ Enable UFW firewall
5. ✅ Setup SSL certificate with Let's Encrypt
6. ✅ Keep system updated: `sudo apt update && sudo apt upgrade`
7. ✅ Setup fail2ban for SSH protection
8. ✅ Regular backups of Supabase database
9. ✅ Monitor logs for suspicious activity
10. ✅ Use environment variables for all secrets

---

## Support & Resources

- **GitHub Issues**: https://github.com/Sakeel-M/EmeraBooks/issues
- **Supabase Dashboard**: https://app.supabase.com
- **OpenAI API Dashboard**: https://platform.openai.com
- **Hostinger Support**: https://www.hostinger.com/cpanel-login

## Next Steps

1. ✅ Deploy application following this guide
2. ✅ Setup SSL certificate
3. ✅ Configure domain name
4. ✅ Test all features
5. ✅ Setup monitoring and alerts
6. ✅ Create backup strategy
7. ✅ Document any custom configurations

---

**Deployed successfully?** Don't forget to:
- Update your Supabase allowed origins
- Test file uploads
- Verify OpenAI API integration
- Check mobile responsiveness
