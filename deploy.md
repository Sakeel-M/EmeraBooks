# EmeraBooks — Deployment Guide

## Infrastructure Overview

| Component | Details |
|-----------|---------|
| **VPS Provider** | Hostinger |
| **Server IP** | 72.60.222.167 |
| **Domain** | https://app.emarabooks.com |
| **OS** | Ubuntu (Linux) |
| **Web Server** | Nginx |
| **Backend Runtime** | Python 3.12.3 + Gunicorn |
| **Frontend Runtime** | Node 20.20.0 / npm 10.8.2 |
| **SSL** | Let's Encrypt (Certbot) |

---

## Directory Structure on VPS

```
/var/www/
├── finance-app/              ← Active production repo (git pull here)
│   ├── frontend/
│   │   ├── dist/             ← Built frontend (served by nginx)
│   │   ├── src/
│   │   ├── .env              ← Frontend env vars (Supabase keys)
│   │   └── package.json
│   └── backend/
│       ├── app.py
│       ├── excel_processor.py
│       ├── pdf_processor.py
│       ├── requirements.txt
│       ├── .env              ← Backend env vars (OpenAI key etc.)
│       └── venv/             ← Python virtualenv
│
└── emerabooks/               ← Legacy/backup dir (DO NOT touch)
    └── backend/              ← Backend service RUNS from here (systemd)
        └── venv/             ← Gunicorn uses this venv
```

> **Important:** The `emerabooks-backend` systemd service runs Gunicorn from
> `/var/www/emerabooks/backend` but the actual code is deployed to
> `/var/www/finance-app`. The two share the same port 5000 via a single service.

---

## Standard Deployment (After Every Code Push)

### Step 1 — SSH into the Server

```bash
ssh root@72.60.222.167
# Password: (ask project owner)
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

## Environment Variables

### Backend — `/var/www/finance-app/backend/.env`

```env
OPENAI_API_KEY=sk-...          # OpenAI API key (required for AI analysis)
FLASK_ENV=production
PORT=5000
SECRET_KEY=<random-hex>        # Flask session secret
API_SECRET_KEY=<your-key>      # X-API-Key header auth (frontend must match)
ALLOWED_ORIGINS=https://app.emarabooks.com
FLASK_DEBUG=false
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
WorkingDirectory=/var/www/emerabooks/backend
EnvironmentFile=/var/www/emerabooks/backend/.env
ExecStart=/var/www/emerabooks/backend/venv/bin/gunicorn \
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

**File:** `/etc/nginx/sites-enabled/finance-app`

Key routing rules:
- `http://` → redirects to `https://app.emarabooks.com`
- `https://app.emarabooks.com/` → serves `/var/www/finance-app/frontend/dist`
- `https://app.emarabooks.com/api/` → proxies to `127.0.0.1:5000`
- `https://app.emarabooks.com/webhook` → proxies to `127.0.0.1:9000` (GitHub webhook)
- Static assets cached for 1 year; `index.html` never cached

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
# View cert status
certbot certificates

# Renew (auto-renew is set up via cron, but manual if needed)
certbot renew

# Cert paths used in nginx config
/etc/letsencrypt/live/app.emarabooks.com/fullchain.pem
/etc/letsencrypt/live/app.emarabooks.com/privkey.pem
/etc/letsencrypt/live/emarabooks.com/fullchain.pem
/etc/letsencrypt/live/emarabooks.com/privkey.pem
```

---

## Installing Python Dependencies (if requirements changed)

```bash
cd /var/www/emerabooks/backend
source venv/bin/activate
pip install -r /var/www/finance-app/backend/requirements.txt
deactivate
systemctl restart emerabooks-backend
```

> Note: The venv lives in `emerabooks/backend/venv` but requirements.txt is in
> `finance-app/backend/requirements.txt`. Always install from the finance-app copy.

---

## Full Fresh Deployment (New Server Setup)

### 1. Install system dependencies

```bash
apt update && apt upgrade -y
apt install -y nginx python3 python3-pip python3-venv nodejs npm git certbot python3-certbot-nginx
```

### 2. Clone the repository

```bash
cd /var/www
git clone https://github.com/Sakeel-M/EmeraBooks.git finance-app
```

### 3. Set up Python backend

```bash
cd /var/www/finance-app/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Create .env
cp .env.example .env
nano .env   # fill in OPENAI_API_KEY, API_SECRET_KEY etc.
```

### 4. Build frontend

```bash
cd /var/www/finance-app/frontend
npm install
cp .env.example .env   # or create manually
nano .env              # fill in Supabase keys + API keys
npm run build
```

### 5. Configure nginx

```bash
cp /var/www/finance-app/nginx.conf /etc/nginx/sites-enabled/finance-app
nginx -t
systemctl reload nginx
```

### 6. Obtain SSL certificate

```bash
certbot --nginx -d app.emarabooks.com -d emarabooks.com -d www.emarabooks.com
```

### 7. Create and enable systemd service

```bash
cp /var/www/finance-app/emerabooks-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable emerabooks-backend
systemctl start emerabooks-backend
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy frontend update | `cd /var/www/finance-app && git pull && cd frontend && npm install && npm run build` |
| Restart backend | `pkill -f gunicorn && systemctl restart emerabooks-backend` |
| Check backend logs | `journalctl -u emerabooks-backend -n 100` |
| Check nginx errors | `tail -50 /var/log/nginx/finance-app-error.log` |
| Test API health | `curl https://app.emarabooks.com/api/health` |
| Reload nginx | `nginx -t && systemctl reload nginx` |
| Check SSL expiry | `certbot certificates` |

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
# Also update in emerabooks .env (service reads from here)
nano /var/www/emerabooks/backend/.env

pkill -f gunicorn && systemctl restart emerabooks-backend
```

### Port 5000 already in use
```bash
pkill -f gunicorn
sleep 2
systemctl start emerabooks-backend
```
