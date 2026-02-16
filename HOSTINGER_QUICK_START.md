# EmeraBooks - Hostinger Quick Start Guide

## 🚀 5-Minute Deployment

### Prerequisites
- [ ] Hostinger VPS with Ubuntu 20.04+
- [ ] SSH access credentials
- [ ] Domain name (optional)
- [ ] OpenAI API key (new one, not the exposed key!)
- [ ] Supabase project credentials

---

## Step 1: SSH into Your VPS

```bash
ssh root@your-vps-ip
```

Or if you have a non-root user:
```bash
ssh username@your-vps-ip
```

---

## Step 2: Run Automated Setup

Copy and paste this command:

```bash
curl -fsSL https://raw.githubusercontent.com/Sakeel-M/EmeraBooks/main/setup-vps.sh | sudo bash
```

Or download and run manually:

```bash
wget https://raw.githubusercontent.com/Sakeel-M/EmeraBooks/main/setup-vps.sh
chmod +x setup-vps.sh
sudo ./setup-vps.sh
```

The script will prompt you for:
1. **OpenAI API Key**: Get from https://platform.openai.com/api-keys
2. **VPS IP or Domain**: Your server's IP or domain name
3. **Supabase Project ID**: From your Supabase dashboard
4. **Supabase Publishable Key**: From your Supabase dashboard
5. **Supabase URL**: Your Supabase project URL

---

## Step 3: Verify Deployment

After the script completes, test your application:

```bash
# Check if services are running
sudo systemctl status emerabooks-backend
sudo systemctl status nginx

# Test backend API
curl http://localhost:5000

# Check logs
sudo journalctl -u emerabooks-backend -n 20
```

Open your browser: `http://your-vps-ip`

---

## Step 4: Setup SSL (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts and select redirect HTTP to HTTPS
```

---

## 📝 Environment Variables

Your `.env` files are located at:

**Backend**: `/var/www/emerabooks/backend/.env`
```env
OPENAI_API_KEY=sk-...
FLASK_ENV=production
PORT=5000
SECRET_KEY=generated_secret_key
```

**Frontend**: `/var/www/emerabooks/Frontend/.env`
```env
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_URL=https://your-project.supabase.co
```

To edit:
```bash
sudo nano /var/www/emerabooks/backend/.env
sudo nano /var/www/emerabooks/Frontend/.env
```

After editing, restart services:
```bash
sudo systemctl restart emerabooks-backend
sudo systemctl reload nginx
```

---

## 🔄 Deploy Updates

When you push changes to GitHub:

```bash
cd /var/www/emerabooks
sudo ./deploy-hostinger.sh
```

This will:
- Pull latest code
- Install dependencies
- Rebuild frontend
- Restart services
- Verify deployment

---

## 🛠️ Common Commands

### Service Management
```bash
# Restart backend
sudo systemctl restart emerabooks-backend

# Restart Nginx
sudo systemctl restart nginx

# Check service status
sudo systemctl status emerabooks-backend
sudo systemctl status nginx
```

### View Logs
```bash
# Backend logs (live)
sudo journalctl -u emerabooks-backend -f

# Backend logs (last 50 lines)
sudo journalctl -u emerabooks-backend -n 50

# Nginx error log
sudo tail -f /var/log/nginx/emerabooks_error.log

# Nginx access log
sudo tail -f /var/log/nginx/emerabooks_access.log
```

### Troubleshooting
```bash
# Test Nginx configuration
sudo nginx -t

# Test backend manually
cd /var/www/emerabooks/backend
source venv/bin/activate
python app.py

# Check if ports are listening
sudo netstat -tlnp | grep :5000  # Backend
sudo netstat -tlnp | grep :80    # Nginx

# Check disk space
df -h

# Check memory usage
free -h
```

---

## 🔒 Security Checklist

- [ ] Rotate the exposed OpenAI API key
- [ ] Enable firewall (UFW)
- [ ] Setup SSL certificate
- [ ] Configure Supabase RLS policies
- [ ] Change default SSH port (optional)
- [ ] Setup fail2ban (optional)
- [ ] Enable automatic security updates
- [ ] Regular backups of Supabase database

### Setup Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

### Enable Automatic Updates
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📊 Monitoring

### Check Resource Usage
```bash
# CPU and Memory
htop

# Disk usage
du -sh /var/www/emerabooks/*

# Network connections
sudo ss -tuln
```

### Setup Log Rotation
```bash
sudo nano /etc/logrotate.d/emerabooks
```

Add:
```
/var/log/emerabooks/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

---

## 🆘 Quick Fixes

### Backend not starting
```bash
# Check Python dependencies
cd /var/www/emerabooks/backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Restart service
sudo systemctl restart emerabooks-backend

# View detailed error
sudo journalctl -u emerabooks-backend -n 100 --no-pager
```

### Frontend showing blank page
```bash
# Rebuild frontend
cd /var/www/emerabooks/Frontend
npm install
npm run build

# Verify build exists
ls -la dist/

# Restart Nginx
sudo systemctl restart nginx
```

### Permission errors
```bash
sudo chown -R www-data:www-data /var/www/emerabooks
sudo chmod -R 755 /var/www/emerabooks
```

---

## 📚 Additional Resources

- **Full Deployment Guide**: See `HOSTINGER_DEPLOYMENT.md`
- **Environment Template**: See `.env.template`
- **GitHub Repository**: https://github.com/Sakeel-M/EmeraBooks
- **Supabase Docs**: https://supabase.com/docs
- **OpenAI API Docs**: https://platform.openai.com/docs

---

## 🎯 Next Steps

1. ✅ Application deployed successfully
2. Configure custom domain (if applicable)
3. Setup SSL certificate
4. Configure Supabase Row Level Security
5. Test all features thoroughly
6. Setup backup strategy
7. Configure monitoring/alerts
8. Document any custom configurations

---

## 💬 Support

If you encounter issues:
1. Check the logs first
2. Review the troubleshooting section
3. See full deployment guide: `HOSTINGER_DEPLOYMENT.md`
4. Open an issue: https://github.com/Sakeel-M/EmeraBooks/issues

---

**Happy Deploying! 🚀**
