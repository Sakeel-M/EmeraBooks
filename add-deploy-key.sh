#!/bin/bash

# Script to add GitHub Actions deploy key to VPS
# Run this on your Hostinger VPS

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Add GitHub Actions Deploy Key${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if running on VPS
if [ ! -d "/var/www/emerabooks" ]; then
    echo -e "${YELLOW}Warning: /var/www/emerabooks not found${NC}"
    echo "This script should be run on your Hostinger VPS"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}Step 1: Paste your public key${NC}"
echo -e "${GREEN}--------------------------------${NC}"
echo ""
echo "Paste the public key (from setup-github-deploy.ps1 output):"
echo "It should start with: ssh-ed25519 AAAA..."
echo ""
read -p "Public key: " PUBLIC_KEY

if [ -z "$PUBLIC_KEY" ]; then
    echo -e "${RED}Error: No public key provided${NC}"
    exit 1
fi

# Validate key format
if [[ ! $PUBLIC_KEY =~ ^ssh- ]]; then
    echo -e "${RED}Error: Invalid key format${NC}"
    echo "Key should start with 'ssh-ed25519' or 'ssh-rsa'"
    exit 1
fi

echo ""
echo -e "${GREEN}Step 2: Adding key to authorized_keys${NC}"
echo -e "${GREEN}--------------------------------${NC}"

# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Check if key already exists
if [ -f ~/.ssh/authorized_keys ] && grep -qF "$PUBLIC_KEY" ~/.ssh/authorized_keys; then
    echo -e "${YELLOW}Key already exists in authorized_keys${NC}"
else
    # Add key to authorized_keys
    echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo -e "${GREEN}✓ Key added successfully!${NC}"
fi

echo ""
echo -e "${GREEN}Step 3: Verifying configuration${NC}"
echo -e "${GREEN}--------------------------------${NC}"

# Verify file permissions
ls -la ~/.ssh/authorized_keys

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "You can now test the connection from your local machine:"
echo -e "${CYAN}  ssh -i ~/.ssh/emerabooks_deploy root@72.60.222.167${NC}"
echo ""
echo "Or on Windows PowerShell:"
echo -e "${CYAN}  ssh -i \$env:USERPROFILE\\.ssh\\emerabooks_deploy root@72.60.222.167${NC}"
echo ""
