#!/bin/bash

# Finance Analytics - Automated Deployment Script
# This script automates the deployment process on your VPS

set -e  # Exit on any error

echo "=========================================="
echo "Finance Analytics - Deployment Script"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/finance-app"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root or with sudo"
    exit 1
fi

# Navigate to app directory
print_info "Navigating to application directory..."
cd $APP_DIR || exit 1
print_success "Changed to $APP_DIR"

# Pull latest changes from GitHub
print_info "Pulling latest changes from GitHub..."
git fetch origin
git pull origin main
print_success "Code updated from GitHub"

# Update Backend
print_info "Updating backend..."
cd $BACKEND_DIR

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    print_success "Virtual environment activated"
else
    print_error "Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    print_success "Virtual environment created and activated"
fi

# Install/update Python dependencies
print_info "Installing Python dependencies..."
pip install -r requirements.txt --upgrade
print_success "Python dependencies updated"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found in backend directory!"
    print_info "Please create .env file with required variables:"
    echo "  OPENAI_API_KEY=your_api_key"
    echo "  FLASK_ENV=production"
    echo "  PORT=5000"
    exit 1
fi

deactivate
print_success "Backend updated successfully"

# Update Frontend
print_info "Updating frontend..."
cd $FRONTEND_DIR

# Install/update Node dependencies
print_info "Installing Node dependencies..."
npm install
print_success "Node dependencies installed"

# Build frontend
print_info "Building frontend..."
npm run build
print_success "Frontend built successfully"

# Restart Backend Service
print_info "Restarting backend service..."
systemctl restart finance-backend
sleep 3

# Check if backend service is running
if systemctl is-active --quiet finance-backend; then
    print_success "Backend service is running"
else
    print_error "Backend service failed to start!"
    print_info "Check logs with: sudo journalctl -u finance-backend -n 50"
    exit 1
fi

# Reload Nginx
print_info "Reloading Nginx..."
nginx -t && systemctl reload nginx
print_success "Nginx reloaded successfully"

# Set proper permissions
print_info "Setting proper permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR
print_success "Permissions set"

# Display service status
echo ""
echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo ""

print_info "Backend Service Status:"
systemctl status finance-backend --no-pager -l | head -n 5

echo ""
print_info "Nginx Status:"
systemctl status nginx --no-pager -l | head -n 5

echo ""
print_success "Deployment completed successfully!"
echo ""
print_info "To view backend logs: sudo journalctl -u finance-backend -f"
print_info "To view nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo "=========================================="
