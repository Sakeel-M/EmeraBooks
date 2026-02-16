#!/bin/bash

# EmeraBooks - Hostinger VPS Deployment Script
# Automates deployment of both frontend and backend

set -e  # Exit on any error

echo "=========================================="
echo "   EmeraBooks - Deployment Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/emerabooks"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/Frontend"
LOG_DIR="/var/log/emerabooks"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}➜ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    print_error "Application directory not found: $APP_DIR"
    print_info "Please clone the repository first:"
    echo "  cd /var/www"
    echo "  sudo git clone https://github.com/Sakeel-M/EmeraBooks.git emerabooks"
    exit 1
fi

print_info "Starting deployment process..."
echo ""

# Navigate to app directory
cd $APP_DIR || exit 1

# Pull latest changes from GitHub
print_info "Pulling latest changes from GitHub..."
git fetch origin
BEFORE_PULL=$(git rev-parse HEAD)
git pull origin main
AFTER_PULL=$(git rev-parse HEAD)

if [ "$BEFORE_PULL" == "$AFTER_PULL" ]; then
    print_warning "No new changes detected, but continuing with deployment..."
else
    print_success "Code updated from GitHub ($(git log -1 --format=%h))"
fi

echo ""

# ============================================
# BACKEND DEPLOYMENT
# ============================================

print_info "Deploying Backend..."
echo ""

cd $BACKEND_DIR

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found in backend directory!"
    print_info "Creating .env template. Please configure it before continuing."
    cat > .env << 'EOF'
# OpenAI API Configuration
OPENAI_API_KEY=your_new_openai_api_key_here

# Flask Configuration
FLASK_ENV=production
FLASK_DEBUG=False
PORT=5000

# Security - Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=generate_a_strong_random_secret_key_here
EOF
    print_warning "Please edit $BACKEND_DIR/.env with your configuration"
    print_info "Then run this script again"
    exit 1
fi

# Create/activate virtual environment
if [ -d "venv" ]; then
    print_info "Using existing virtual environment"
    source venv/bin/activate
else
    print_info "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    print_success "Virtual environment created"
fi

# Upgrade pip
print_info "Upgrading pip..."
pip install --upgrade pip --quiet

# Install/update Python dependencies
print_info "Installing Python dependencies..."
pip install -r requirements.txt --upgrade --quiet
print_success "Python dependencies updated"

deactivate
print_success "Backend preparation complete"

echo ""

# ============================================
# FRONTEND DEPLOYMENT
# ============================================

print_info "Deploying Frontend..."
echo ""

cd $FRONTEND_DIR

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found in Frontend directory!"
    print_info "Creating .env template. Please configure it before continuing."
    cat > .env << 'EOF'
VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_SUPABASE_URL=https://your-project-id.supabase.co
EOF
    print_warning "Please edit $FRONTEND_DIR/.env with your Supabase configuration"
    print_info "Then run this script again"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_info "Installing Node dependencies (first time)..."
    npm install
else
    print_info "Updating Node dependencies..."
    npm install --quiet
fi
print_success "Node dependencies installed"

# Build frontend
print_info "Building frontend for production..."
npm run build

# Verify build output
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    print_success "Frontend built successfully"
    BUILD_SIZE=$(du -sh dist/ | cut -f1)
    print_info "Build size: $BUILD_SIZE"
else
    print_error "Frontend build failed - dist directory not found or incomplete"
    exit 1
fi

echo ""

# ============================================
# RESTART SERVICES
# ============================================

print_info "Restarting services..."
echo ""

# Create log directory if it doesn't exist
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p $LOG_DIR
    chown www-data:www-data $LOG_DIR
fi

# Restart Backend Service
print_info "Restarting backend service..."
systemctl restart emerabooks-backend
sleep 3

# Check if backend service is running
if systemctl is-active --quiet emerabooks-backend; then
    print_success "Backend service is running"
else
    print_error "Backend service failed to start!"
    print_info "Checking logs..."
    journalctl -u emerabooks-backend -n 20 --no-pager
    print_info "Full logs: sudo journalctl -u emerabooks-backend -n 100"
    exit 1
fi

# Test backend health
print_info "Testing backend health..."
sleep 2
if curl -s http://localhost:5000 > /dev/null 2>&1; then
    print_success "Backend is responding on port 5000"
else
    print_warning "Backend may not be responding correctly on port 5000"
fi

# Reload Nginx
print_info "Reloading Nginx..."
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    systemctl reload nginx
    print_success "Nginx reloaded successfully"
else
    print_error "Nginx configuration test failed"
    nginx -t
    exit 1
fi

# Set proper permissions
print_info "Setting proper permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR
print_success "Permissions set"

echo ""

# ============================================
# DEPLOYMENT SUMMARY
# ============================================

echo "=========================================="
echo "      Deployment Summary"
echo "=========================================="
echo ""

# Get commit info
COMMIT_HASH=$(git log -1 --format=%h)
COMMIT_MSG=$(git log -1 --format=%s)
COMMIT_DATE=$(git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M')

print_info "Deployed Commit: $COMMIT_HASH"
echo "  Message: $COMMIT_MSG"
echo "  Date: $COMMIT_DATE"
echo ""

# Service Status
print_info "Service Status:"
if systemctl is-active --quiet emerabooks-backend; then
    echo -e "  Backend: ${GREEN}●${NC} Running"
else
    echo -e "  Backend: ${RED}●${NC} Stopped"
fi

if systemctl is-active --quiet nginx; then
    echo -e "  Nginx:   ${GREEN}●${NC} Running"
else
    echo -e "  Nginx:   ${RED}●${NC} Stopped"
fi

echo ""

# Display URLs
print_info "Application URLs:"
# Try to get public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-vps-ip")
echo "  Frontend: http://$PUBLIC_IP"
echo "  Backend:  http://$PUBLIC_IP/api/"

echo ""

# Useful commands
print_info "Useful Commands:"
echo "  View backend logs:  sudo journalctl -u emerabooks-backend -f"
echo "  View backend file:  sudo tail -f /var/log/emerabooks/backend.log"
echo "  View nginx logs:    sudo tail -f /var/log/nginx/emerabooks_error.log"
echo "  Restart backend:    sudo systemctl restart emerabooks-backend"
echo "  Restart nginx:      sudo systemctl restart nginx"
echo "  Check status:       sudo systemctl status emerabooks-backend"

echo ""
print_success "Deployment completed successfully!"
echo ""
echo "=========================================="
