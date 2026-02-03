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
APP_DIR="/var/www/finance-app"
REPO_URL="https://github.com/Sakeel-M/EmeraBooks.git"

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "  Finance Analytics - VPS Setup"
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
print_info "This script will setup your Finance Analytics application on this VPS"
echo ""
read -p "Enter your OpenAI API Key: " OPENAI_KEY
read -p "Enter your VPS IP address or domain: " VPS_HOST
echo ""

if [ -z "$OPENAI_KEY" ] || [ -z "$VPS_HOST" ]; then
    print_error "API Key and VPS host are required!"
    exit 1
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
    git clone $REPO_URL finance-app
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
cd $APP_DIR/frontend

npm install
print_success "Frontend dependencies installed"

# Create frontend .env
cat > .env << EOF
VITE_API_URL=http://$VPS_HOST
EOF
print_success "Frontend .env file created"

# Build frontend
npm run build
print_success "Frontend built successfully"

# Step 9: Setup Systemd Service
print_info "Step 9: Configuring systemd service..."
cp $APP_DIR/finance-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable finance-backend
systemctl start finance-backend
sleep 3

if systemctl is-active --quiet finance-backend; then
    print_success "Backend service started"
else
    print_error "Backend service failed to start"
    print_info "Check logs: journalctl -u finance-backend -n 50"
fi

# Step 10: Configure Nginx
print_info "Step 10: Configuring Nginx..."

# Update nginx config with actual domain/IP
sed -i "s/your-domain.com/$VPS_HOST/g" $APP_DIR/nginx.conf
sed -i "s/www.your-domain.com/www.$VPS_HOST/g" $APP_DIR/nginx.conf

cp $APP_DIR/nginx.conf /etc/nginx/sites-available/finance-app

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable our site
ln -sf /etc/nginx/sites-available/finance-app /etc/nginx/sites-enabled/

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
chmod +x $APP_DIR/deploy.sh
chmod +x $APP_DIR/setup-vps.sh
print_success "Permissions set"

# Step 13: Create log files
print_info "Step 13: Creating log files..."
touch /var/log/finance-backend-access.log
touch /var/log/finance-backend-error.log
chown www-data:www-data /var/log/finance-backend-*.log
print_success "Log files created"

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
echo "  - View backend logs: sudo journalctl -u finance-backend -f"
echo "  - View Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo "  - Restart backend: sudo systemctl restart finance-backend"
echo "  - Restart Nginx: sudo systemctl restart nginx"
echo "  - Deploy updates: cd $APP_DIR && sudo ./deploy.sh"
echo ""
echo "Service Status:"
systemctl status finance-backend --no-pager -l | head -n 3
systemctl status nginx --no-pager -l | head -n 3
echo ""
print_info "Next Steps:"
echo "  1. Test your application at http://$VPS_HOST"
echo "  2. Setup SSL certificate: sudo apt install certbot python3-certbot-nginx -y"
echo "  3. Run: sudo certbot --nginx -d $VPS_HOST"
echo "  4. Setup automated backups"
echo ""
echo "=========================================="
