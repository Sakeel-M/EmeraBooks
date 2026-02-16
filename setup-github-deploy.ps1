# GitHub Actions Auto-Deployment Setup Script
# Run this on your local Windows machine (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EmeraBooks Auto-Deployment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if SSH directory exists
$sshDir = "$env:USERPROFILE\.ssh"
if (!(Test-Path $sshDir)) {
    Write-Host "Creating .ssh directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

$keyPath = "$sshDir\emerabooks_deploy"

# Step 1: Generate SSH Key
Write-Host "Step 1: Generating SSH Key Pair" -ForegroundColor Green
Write-Host "--------------------------------" -ForegroundColor Green

if (Test-Path $keyPath) {
    Write-Host "Key already exists at: $keyPath" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "Using existing key..." -ForegroundColor Yellow
    } else {
        Remove-Item $keyPath -Force
        Remove-Item "$keyPath.pub" -Force
    }
}

if (!(Test-Path $keyPath)) {
    Write-Host "Generating new SSH key..." -ForegroundColor Yellow
    ssh-keygen -t ed25519 -C "github-actions-emerabooks" -f $keyPath -N '""'
    Write-Host "✓ SSH key pair generated!" -ForegroundColor Green
}

Write-Host ""

# Step 2: Display Public Key
Write-Host "Step 2: Public Key (for VPS)" -ForegroundColor Green
Write-Host "--------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Copy this ENTIRE public key:" -ForegroundColor Yellow
Write-Host ""
Get-Content "$keyPath.pub" | Write-Host -ForegroundColor Cyan
Write-Host ""
Write-Host "Commands to add this key to your VPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  ssh root@72.60.222.167" -ForegroundColor White
Write-Host "  mkdir -p ~/.ssh" -ForegroundColor White
Write-Host "  nano ~/.ssh/authorized_keys" -ForegroundColor White
Write-Host "  # Paste the public key above, then save (Ctrl+X, Y, Enter)" -ForegroundColor Gray
Write-Host "  chmod 600 ~/.ssh/authorized_keys" -ForegroundColor White
Write-Host "  exit" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter when you've added the public key to your VPS"

# Step 3: Test SSH Connection
Write-Host ""
Write-Host "Step 3: Testing SSH Connection" -ForegroundColor Green
Write-Host "--------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Testing connection to VPS..." -ForegroundColor Yellow
Write-Host ""

$testCmd = "echo 'SSH connection successful!'"
$result = ssh -i $keyPath -o StrictHostKeyChecking=no root@72.60.222.167 $testCmd 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ SSH connection successful!" -ForegroundColor Green
} else {
    Write-Host "✗ SSH connection failed. Please check:" -ForegroundColor Red
    Write-Host "  - Public key was added correctly to VPS" -ForegroundColor Yellow
    Write-Host "  - VPS is accessible at 72.60.222.167" -ForegroundColor Yellow
    Write-Host "  - Port 22 is open" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 4: Display Private Key for GitHub Secrets
Write-Host "Step 4: Private Key (for GitHub Secrets)" -ForegroundColor Green
Write-Host "--------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Copy this ENTIRE private key to GitHub Secrets:" -ForegroundColor Yellow
Write-Host ""
Write-Host "PRIVATE KEY (copy everything below):" -ForegroundColor Red
Write-Host "------------------------------------" -ForegroundColor Red
Get-Content $keyPath | Write-Host -ForegroundColor Cyan
Write-Host "------------------------------------" -ForegroundColor Red
Write-Host ""

# Step 5: GitHub Secrets Configuration
Write-Host ""
Write-Host "Step 5: Configure GitHub Secrets" -ForegroundColor Green
Write-Host "--------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "Go to: https://github.com/Sakeel-M/EmeraBooks/settings/secrets/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "Create these 3 secrets:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. VPS_SSH_KEY" -ForegroundColor White
Write-Host "   Value: [Paste the private key from above]" -ForegroundColor Gray
Write-Host ""
Write-Host "2. VPS_HOST" -ForegroundColor White
Write-Host "   Value: 72.60.222.167" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. VPS_USER" -ForegroundColor White
Write-Host "   Value: root" -ForegroundColor Cyan
Write-Host ""

$secretsReady = Read-Host "Have you added all 3 secrets to GitHub? (y/n)"

if ($secretsReady -eq "y") {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Setup Complete! ✓" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Make a small change to any file" -ForegroundColor White
    Write-Host "2. Commit and push: git push origin main" -ForegroundColor White
    Write-Host "3. Watch deployment: https://github.com/Sakeel-M/EmeraBooks/actions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "From now on, every push to main will auto-deploy! 🚀" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Please configure GitHub Secrets and run this script again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Key files location:" -ForegroundColor Gray
Write-Host "  Private key: $keyPath" -ForegroundColor Gray
Write-Host "  Public key: $keyPath.pub" -ForegroundColor Gray
Write-Host ""
