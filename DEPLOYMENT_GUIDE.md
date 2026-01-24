# Hostinger VPS Deployment Guide

This guide will help you deploy your Financial Analytics application to a Hostinger VPS.

## Prerequisites

- Hostinger VPS with Ubuntu 20.04 or later
- SSH access to your VPS
- Domain name (optional, but recommended)
- OpenAI API key

## Quick Start

### 1. Initial VPS Setup

SSH into your VPS:
```bash
ssh root@your-vps-ip
```

### 2. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Install Required Software
```bash
# Install Python 3 and pip
sudo apt install python3 python3-pip python3-venv -y

# Install Node.js and npm (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install Nginx
sudo apt install nginx -y

# Install Git
sudo apt install git -y

# Install PM2 for process management (optional)
sudo npm install -g pm2
```

### 4. Clone Your Repository
```bash
cd /var/www
sudo git clone https://github.com/Sakeel-M/Financial_bakcend.git finance-app
cd finance-app
sudo chown -R $USER:$USER /var/www/finance-app
```

### 5. Setup Backend

```bash
cd /var/www/finance-app/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
FLASK_ENV=production
PORT=5000
EOF

# Make sure to replace 'your_openai_api_key_here' with your actual API key
nano .env
```

### 6. Setup Frontend

```bash
cd /var/www/finance-app/frontend

# Install dependencies
npm install

# Create .env file for production
cat > .env << EOF
VITE_API_URL=http://your-vps-ip:5000
EOF

# Build the frontend
npm run build
```

### 7. Configure Nginx

Create Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/finance-app
```

Paste the following configuration (replace `your-domain.com` with your domain or VPS IP):
```nginx
# Backend API server
upstream backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or IP

    # Frontend - Serve React build
    location / {
        root /var/www/finance-app/frontend/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
    }

    # Increase upload size for file processing
    client_max_body_size 50M;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/finance-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Setup Systemd Service for Flask Backend

Create a systemd service file:
```bash
sudo nano /etc/systemd/system/finance-backend.service
```

Paste the following:
```ini
[Unit]
Description=Finance Analytics Flask Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/finance-app/backend
Environment="PATH=/var/www/finance-app/backend/venv/bin"
ExecStart=/var/www/finance-app/backend/venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable finance-backend
sudo systemctl start finance-backend
sudo systemctl status finance-backend
```

### 9. Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## Updating Your Application

When you push changes to GitHub, update your VPS:

```bash
cd /var/www/finance-app
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart finance-backend

# Update frontend
cd ../frontend
npm install
npm run build

# Restart Nginx
sudo systemctl restart nginx
```

## Automated Deployment Script

Create a deployment script for easy updates:
```bash
nano /var/www/finance-app/deploy.sh
```

See `deploy.sh` file in the repository.

Make it executable:
```bash
chmod +x /var/www/finance-app/deploy.sh
```

## SSL Certificate (Recommended)

Install Certbot for free SSL:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Monitoring & Logs

View backend logs:
```bash
sudo journalctl -u finance-backend -f
```

View Nginx logs:
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Check service status:
```bash
sudo systemctl status finance-backend
sudo systemctl status nginx
```

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo journalctl -u finance-backend -n 50

# Check if port 5000 is in use
sudo netstat -tlnp | grep 5000

# Test backend manually
cd /var/www/finance-app/backend
source venv/bin/activate
python app.py
```

### Frontend not loading
```bash
# Check if build files exist
ls -la /var/www/finance-app/frontend/dist

# Rebuild frontend
cd /var/www/finance-app/frontend
npm run build

# Check Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Permission issues
```bash
sudo chown -R www-data:www-data /var/www/finance-app
sudo chmod -R 755 /var/www/finance-app
```

## Performance Optimization

### 1. Enable Gzip Compression in Nginx
Add to `/etc/nginx/nginx.conf`:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
```

### 2. Setup Gunicorn for Production (Recommended)
```bash
cd /var/www/finance-app/backend
source venv/bin/activate
pip install gunicorn

# Update systemd service to use gunicorn
sudo nano /etc/systemd/system/finance-backend.service
```

Change ExecStart line to:
```ini
ExecStart=/var/www/finance-app/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

Restart the service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart finance-backend
```

## Security Best Practices

1. Never commit `.env` files to Git
2. Use strong passwords for VPS
3. Keep system updated: `sudo apt update && sudo apt upgrade`
4. Setup automatic backups
5. Use SSL/HTTPS for production
6. Implement rate limiting in Nginx
7. Setup fail2ban for SSH protection

## Support

For issues or questions:
- GitHub: https://github.com/Sakeel-M/Financial_bakcend/issues
- Check application logs for errors
