# EmeraBooks — Deployment Guide

## Infrastructure Overview

| Component | Details |
|-----------|---------|
| **VPS Provider** | Hostinger |
| **Server IP** | 187.124.98.173 |
| **Domain** | https://app.emarabooks.com |
| **OS** | Ubuntu 24.04 LTS |
| **Web Server** | Nginx |
| **Backend Runtime** | Python 3.12 + Gunicorn |
| **Frontend Runtime** | Node 20.20.0 / npm 10.8.2 |
| **SSL** | Let's Encrypt (Certbot) |
| **Firewall** | UFW (SSH + Nginx only) |

---

## Directory Structure on VPS

```
/var/www/
└── finance-app/              ← Production repo (git pull here)
    ├── frontend/
    │   ├── dist/             ← Built frontend (served by nginx)
    │   ├── src/
    │   ├── .env              ← Frontend env vars (Supabase keys)
    │   └── package.json
    └── backend/
        ├── app.py
        ├── excel_processor.py
        ├── pdf_processor.py
        ├── requirements.txt
        ├── .env              ← Backend env vars (OpenAI key etc.)
        └── venv/             ← Python virtualenv + Gunicorn
```

> Clean setup — no legacy directories. The systemd service, venv, and code all
> live under `/var/www/finance-app`. Single `.env` per component.

---

## Standard Deployment (After Every Code Push)

### Step 1 — SSH into the Server

```bash
ssh root@187.124.98.173
```

### Step 2 — Pull Latest Code

```bash
cd /var/www/finance-app
git pull origin main
```

### Step 3 — Rebuild Frontend

```bash
cd /var/www/finance-app/frontend
npm install
npm run build
```

The built files land in `/var/www/finance-app/frontend/dist/` which nginx serves directly.

### Step 4 — Restart Backend (if backend files changed)

```bash
# Kill any stale gunicorn workers first
pkill -f gunicorn

# Restart the systemd service
systemctl restart emerabooks-backend

# Verify it started
systemctl status emerabooks-backend
```

> Only needed when `backend/app.py`, `excel_processor.py`, `pdf_processor.py`,
> or `requirements.txt` changed. Frontend-only changes skip this step.

### Step 5 — Reload Nginx (if nginx config changed)

```bash
nginx -t              # test config syntax first
systemctl reload nginx
```

---

## Docker Deployment (Recommended — PostgreSQL + Flask)

### Step 1 — Create `.env` in project root

```bash
cd /var/www/finance-app
nano .env
```

```env
DB_PASSWORD=your-strong-db-password
OPENAI_API_KEY=sk-proj-...
API_SECRET_KEY=your-api-secret-key
SECRET_KEY=your-flask-session-secret
ALLOWED_ORIGINS=https://app.emarabooks.com
SUPABASE_URL=https://hnvwrxkjnnepnchjunel.supabase.co
FLASK_DEBUG=0
```

### Step 2 — Start Docker containers

```bash
cd /var/www/finance-app
docker compose up -d --build
```

This starts:
- **PostgreSQL 16** on port 5433 (internal 5432)
- **Flask + Gunicorn** on port 5000 (4 workers, 120s timeout)

### Step 3 — Run database migrations

```bash
docker compose exec flask flask db upgrade
```

### Step 4 — Rebuild frontend

```bash
cd /var/www/finance-app/frontend
npm install && npm run build
```

### Step 5 — Reload nginx

```bash
nginx -t && systemctl reload nginx
```

### Docker Update Deployment (after code push)

```bash
cd /var/www/finance-app
git pull origin main
docker compose up -d --build              # Rebuild Flask container
docker compose exec flask flask db upgrade  # Run new migrations if any
cd frontend && npm install && npm run build  # Rebuild frontend
```

### Docker Useful Commands

```bash
docker compose ps                          # Check container status
docker compose logs flask -f --tail 50     # Follow Flask logs
docker compose logs db -f --tail 50        # Follow PostgreSQL logs
docker compose restart flask               # Restart Flask only
docker compose down                        # Stop all containers
docker compose down -v                     # Stop + delete database volume (DESTRUCTIVE)
```

---

## Environment Variables

### Backend — `/var/www/finance-app/backend/.env` (standalone mode)

```env
OPENAI_API_KEY=sk-...          # OpenAI API key (required for AI analysis)
FLASK_ENV=production
FLASK_DEBUG=False
PORT=5000
SECRET_KEY=<random-hex>        # Flask session secret
API_SECRET_KEY=<your-key>      # X-API-Key header auth (frontend must match)
ALLOWED_ORIGINS=https://app.emarabooks.com
DATABASE_URL=postgresql://emerabooks:changeme@localhost:5433/emerabooks
```

### Frontend — `/var/www/finance-app/frontend/.env`

```env
VITE_SUPABASE_URL=https://hnvwrxkjnnepnchjunel.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...   # Supabase anon key
VITE_SUPABASE_PROJECT_ID=hnvwrxkjnnepnchjunel
VITE_API_BASE_URL=http://127.0.0.1:5000/api  # Flask backend (server-local)
VITE_API_SECRET_KEY=<same-as-backend-API_SECRET_KEY>
```

> After editing `.env` files, rebuild frontend (`npm run build`) and/or restart
> backend (`systemctl restart emerabooks-backend`).

---

## Systemd Service

**File:** `/etc/systemd/system/emerabooks-backend.service`

```ini
[Unit]
Description=EmeraBooks Flask Backend
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/finance-app/backend
EnvironmentFile=/var/www/finance-app/backend/.env
ExecStart=/var/www/finance-app/backend/venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:5000 \
    --timeout 120 \
    app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Useful commands:**

```bash
systemctl status emerabooks-backend      # check status
systemctl restart emerabooks-backend     # restart
systemctl stop emerabooks-backend        # stop
journalctl -u emerabooks-backend -n 50   # view last 50 log lines
journalctl -u emerabooks-backend -f      # follow logs live
```

---

## Nginx Configuration

**File:** `/etc/nginx/sites-available/finance-app` (symlinked to `sites-enabled/`)

Key routing rules:
- `http://` → redirects to `https://app.emarabooks.com`
- `https://app.emarabooks.com/` → serves `/var/www/finance-app/frontend/dist`
- `https://app.emarabooks.com/api/` → proxies to `127.0.0.1:5000`
- Static assets cached for 1 year; `index.html` never cached
- Security headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection

**Useful commands:**

```bash
nginx -t                          # test config
systemctl reload nginx            # reload without downtime
systemctl restart nginx           # full restart
tail -f /var/log/nginx/finance-app-error.log    # error log
tail -f /var/log/nginx/finance-app-access.log   # access log
```

---

## SSL Certificates

Managed by **Let's Encrypt + Certbot**.

```bash
# Obtain certs (first time — after DNS points to this server)
certbot --nginx -d app.emarabooks.com -d emarabooks.com -d www.emarabooks.com

# View cert status
certbot certificates

# Renew (auto-renew is set up via cron, but manual if needed)
certbot renew

# Cert paths used in nginx config
/etc/letsencrypt/live/app.emarabooks.com/fullchain.pem
/etc/letsencrypt/live/app.emarabooks.com/privkey.pem
```

---

## Installing Python Dependencies (if requirements changed)

```bash
cd /var/www/finance-app/backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
systemctl restart emerabooks-backend
```

---

## Full Fresh Deployment (New Server Setup)

### 1. Install system dependencies

```bash
apt update && apt upgrade -y
apt install -y nginx python3 python3-pip python3-venv git certbot python3-certbot-nginx curl
```

### 2. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### 3. Clone the repository

```bash
cd /var/www
git clone https://github.com/Sakeel-M/EmeraBooks.git finance-app
```

### 4. Set up Python backend

```bash
cd /var/www/finance-app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
deactivate

# Create .env
cp .env.example .env
nano .env   # fill in OPENAI_API_KEY, API_SECRET_KEY etc.
```

### 5. Build frontend

```bash
cd /var/www/finance-app/frontend
npm install
cp .env.example .env   # or create manually
nano .env              # fill in Supabase keys + API keys
npm run build
```

### 6. Configure nginx

```bash
# Create config file at /etc/nginx/sites-available/finance-app
# (see Nginx Configuration section above for contents)
ln -sf /etc/nginx/sites-available/finance-app /etc/nginx/sites-enabled/finance-app
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 7. Obtain SSL certificate

```bash
# DNS must point to this server first
certbot --nginx -d app.emarabooks.com -d emarabooks.com -d www.emarabooks.com
```

### 8. Create and enable systemd service

```bash
# Create /etc/systemd/system/emerabooks-backend.service
# (see Systemd Service section above for contents)
systemctl daemon-reload
systemctl enable emerabooks-backend
systemctl start emerabooks-backend
```

### 9. Enable firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy frontend update | `cd /var/www/finance-app && git pull && cd frontend && npm install && npm run build` |
| Restart backend | `pkill -f gunicorn && systemctl restart emerabooks-backend` |
| Check backend logs | `journalctl -u emerabooks-backend -n 100` |
| Check nginx errors | `tail -50 /var/log/nginx/finance-app-error.log` |
| Test API health | `curl -H 'X-API-Key: <key>' http://127.0.0.1:5000/api/health` |
| Reload nginx | `nginx -t && systemctl reload nginx` |
| Check SSL expiry | `certbot certificates` |
| Firewall status | `ufw status` |

---

## Troubleshooting

### Backend returns 502 Bad Gateway
```bash
# Check if gunicorn is running
ps aux | grep gunicorn

# If not running, restart service
pkill -f gunicorn
systemctl restart emerabooks-backend
systemctl status emerabooks-backend
```

### Old code still showing after deploy
```bash
# Hard-clear nginx cache
systemctl reload nginx

# Verify the build actually updated
ls -la /var/www/finance-app/frontend/dist/assets/
```

### OpenAI API errors (401/500)
```bash
# Update the key in backend .env
nano /var/www/finance-app/backend/.env
pkill -f gunicorn && systemctl restart emerabooks-backend
```

### Port 5000 already in use
```bash
pkill -f gunicorn
sleep 2
systemctl start emerabooks-backend
```

### Gunicorn not found after fresh setup
```bash
# gunicorn is NOT in requirements.txt — install it manually in the venv
source /var/www/finance-app/backend/venv/bin/activate
pip install gunicorn
deactivate
systemctl restart emerabooks-backend
```
