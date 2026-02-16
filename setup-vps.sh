#!/bin/bash

# Finance Analytics - Automated VPS Setup Script
# Run this script on your fresh Ubuntu VPS to setup everything automatically

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="/var/www/emerabooks"
REPO_URL="https://github.com/Sakeel-M/EmeraBooks.git"

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "  EmeraBooks - VPS Setup"
    echo "=========================================="
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root or with sudo"
        exit 1
    fi
}

print_header
check_root

# Get user inputs
print_info "This script will setup your EmeraBooks application on this VPS"
echo ""
read -p "Enter your OpenAI API Key: " OPENAI_KEY
read -p "Enter your VPS IP address or domain: " VPS_HOST
read -p "Enter your Supabase Project ID: " SUPABASE_PROJECT_ID
read -p "Enter your Supabase Publishable Key: " SUPABASE_KEY
read -p "Enter your Supabase URL: " SUPABASE_URL
echo ""

if [ -z "$OPENAI_KEY" ] || [ -z "$VPS_HOST" ]; then
    print_error "OpenAI API Key and VPS host are required!"
    exit 1
fi

if [ -z "$SUPABASE_PROJECT_ID" ] || [ -z "$SUPABASE_KEY" ] || [ -z "$SUPABASE_URL" ]; then
    print_warning "Supabase credentials not provided. You'll need to configure Frontend/.env manually later."
fi

# Step 1: Update system
print_info "Step 1: Updating system packages..."
apt update && apt upgrade -y
print_success "System updated"

# Step 2: Install Python
print_info "Step 2: Installing Python and pip..."
apt install -y python3 python3-pip python3-venv
print_success "Python installed: $(python3 --version)"

# Step 3: Install Node.js
print_info "Step 3: Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js installed: $(node --version)"
print_success "NPM installed: $(npm --version)"

# Step 4: Install Nginx
print_info "Step 4: Installing Nginx..."
apt install -y nginx
print_success "Nginx installed"

# Step 5: Install Git
print_info "Step 5: Installing Git..."
apt install -y git
print_success "Git installed"

# Step 6: Clone repository
print_info "Step 6: Cloning repository..."
if [ -d "$APP_DIR" ]; then
    print_info "Directory exists, pulling latest changes..."
    cd $APP_DIR
    git pull origin main
else
    mkdir -p /var/www
    cd /var/www
    git clone $REPO_URL emerabooks
fi
cd $APP_DIR
print_success "Repository cloned"

# Step 7: Setup Backend
print_info "Step 7: Setting up backend..."
cd $APP_DIR/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
print_success "Virtual environment created"

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
print_success "Backend dependencies installed"

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=$OPENAI_KEY
FLASK_ENV=production
PORT=5000
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
EOF
print_success "Backend .env file created"

deactivate

# Step 8: Setup Frontend
print_info "Step 8: Setting up frontend..."
cd $APP_DIR/Frontend

npm install
print_success "Frontend dependencies installed"

# Create frontend .env
if [ ! -z "$SUPABASE_PROJECT_ID" ]; then
    cat > .env << EOF
VITE_SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_KEY
VITE_SUPABASE_URL=$SUPABASE_URL
EOF
    print_success "Frontend .env file created with Supabase configuration"
else
    print_warning "Skipping .env creation - configure manually later"
fi

# Build frontend
npm run build
print_success "Frontend built successfully"

# Step 9: Setup Systemd Service
print_info "Step 9: Configuring systemd service..."

# Create systemd service file
cat > /etc/systemd/system/emerabooks-backend.service << 'EOF'
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
ExecStart=/var/www/emerabooks/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 --timeout 120 app:app
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable emerabooks-backend
systemctl start emerabooks-backend
sleep 3

if systemctl is-active --quiet emerabooks-backend; then
    print_success "Backend service started"
else
    print_error "Backend service failed to start"
    print_info "Check logs: journalctl -u emerabooks-backend -n 50"
fi

# Step 10: Configure Nginx
print_info "Step 10: Configuring Nginx..."

# Create Nginx configuration
cat > /etc/nginx/sites-available/emerabooks << EOF
# Backend API server
upstream flask_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    server_name $VPS_HOST;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        root /var/www/emerabooks/Frontend/dist;
        try_files \$uri \$uri/ /index.html;

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
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # CORS
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
    }

    # Upload size
    client_max_body_size 50M;

    # Logging
    access_log /var/log/nginx/emerabooks_access.log;
    error_log /var/log/nginx/emerabooks_error.log;
}
EOF

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable our site
ln -sf /etc/nginx/sites-available/emerabooks /etc/nginx/sites-enabled/

# Test and reload nginx
nginx -t
systemctl restart nginx
print_success "Nginx configured and started"

# Step 11: Configure Firewall
print_info "Step 11: Configuring firewall..."
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable
print_success "Firewall configured"

# Step 12: Set permissions
print_info "Step 12: Setting proper permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR
chmod +x $APP_DIR/deploy-hostinger.sh 2>/dev/null || true
chmod +x $APP_DIR/setup-vps.sh
print_success "Permissions set"

# Step 13: Create log directory
print_info "Step 13: Creating log directory..."
mkdir -p /var/log/emerabooks
chown www-data:www-data /var/log/emerabooks
print_success "Log directory created"

# Final Summary
echo ""
echo -e "${GREEN}"
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo -e "${NC}"
echo ""
print_success "Application deployed successfully!"
echo ""
echo "Access your application at:"
echo -e "${BLUE}  http://$VPS_HOST${NC}"
echo ""
echo "Useful commands:"
echo "  - View backend logs: sudo journalctl -u emerabooks-backend -f"
echo "  - View Nginx logs: sudo tail -f /var/log/nginx/emerabooks_error.log"
echo "  - Restart backend: sudo systemctl restart emerabooks-backend"
echo "  - Restart Nginx: sudo systemctl restart nginx"
echo "  - Deploy updates: cd $APP_DIR && sudo ./deploy-hostinger.sh"
echo ""
echo "Service Status:"
systemctl status emerabooks-backend --no-pager -l | head -n 3
systemctl status nginx --no-pager -l | head -n 3
echo ""
print_info "Next Steps:"
echo "  1. Test your application at http://$VPS_HOST"
echo "  2. Setup SSL certificate: sudo apt install certbot python3-certbot-nginx -y"
echo "  3. Run: sudo certbot --nginx -d $VPS_HOST"
echo "  4. Setup automated backups"
echo ""
echo "=========================================="
