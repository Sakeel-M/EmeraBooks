# EmeraBooks — Deployment Guide

## Infrastructure Overview

| Component | Details |
|-----------|---------|
| **VPS Provider** | Hostinger |
| **Server IP** | 187.124.98.173 |
| **App Domain** | https://app.emarabooks.com |
| **Admin Domain** | https://admin.emarabooks.com |
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
ALLOWED_ORIGINS=https://app.emarabooks.com,https://admin.emarabooks.com
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
- `http://` → redirects to `https://`
- `https://app.emarabooks.com/` → serves `/var/www/finance-app/frontend/dist` (user app)
- `https://admin.emarabooks.com/` → serves same `dist/` (frontend detects hostname, shows admin UI only)
- `https://*/api/` → proxies to `127.0.0.1:5000` (Flask backend)
- Static assets cached for 1 year; `index.html` never cached

Both `app.emarabooks.com` and `admin.emarabooks.com` serve the same build — the React app detects `window.location.hostname` and shows different routes based on whether it starts with `admin.`.

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
# Obtain certs for app domain (first time)
certbot --nginx -d app.emarabooks.com -d emarabooks.com -d www.emarabooks.com

# Obtain cert for admin domain (after DNS A record is set)
certbot --nginx -d admin.emarabooks.com

# View cert status
certbot certificates

# Renew (auto-renew is set up via cron, but manual if needed)
certbot renew

# Cert paths used in nginx config
/etc/letsencrypt/live/app.emarabooks.com/fullchain.pem
/etc/letsencrypt/live/app.emarabooks.com/privkey.pem
/etc/letsencrypt/live/admin.emarabooks.com/fullchain.pem   # (after certbot)
/etc/letsencrypt/live/admin.emarabooks.com/privkey.pem
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

## Admin Panel Setup

### DNS Configuration

Add this A record in your domain registrar (Hostinger / GoDaddy / Cloudflare / Namecheap):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | `admin` | `187.124.98.173` | 3600 |

Wait 5-30 minutes for DNS propagation. Verify with:
```bash
dig admin.emarabooks.com +short
# Should return: 187.124.98.173
```

### SSL for Admin Domain

After DNS propagates:
```bash
ssh root@187.124.98.173
certbot --nginx -d admin.emarabooks.com
```

### Nginx Configuration

The nginx config at `/etc/nginx/sites-enabled/finance-app` already includes both domains:

```nginx
server {
    server_name app.emarabooks.com admin.emarabooks.com emarabooks.com www.emarabooks.com;
    root /var/www/finance-app/frontend/dist;

    location / { try_files $uri $uri/ /index.html; }
    location /api/ { proxy_pass http://127.0.0.1:5000; ... }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/app.emarabooks.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.emarabooks.com/privkey.pem;
}
```

Both domains serve the same `dist/` folder. The React app detects `admin.` hostname and shows admin-only UI.

### CORS Configuration

The `.env` file must include both domains in `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=https://app.emarabooks.com,https://admin.emarabooks.com,http://localhost:5173
```

After updating, restart Flask:
```bash
docker compose up -d flask
```

### How Admin Domain Routing Works

| URL | What Shows |
|-----|-----------|
| `admin.emarabooks.com/` | Admin Dashboard (platform stats, users, orgs) |
| `admin.emarabooks.com/admin/users` | User management (list, search, impersonate) |
| `admin.emarabooks.com/admin/users/:id` | User detail (profile, stats, impersonate) |
| `admin.emarabooks.com/admin/orgs` | Organization management (feature locking) |
| `admin.emarabooks.com/auth` | Login page (redirects back to admin after login) |
| `admin.emarabooks.com/*` (any other) | Redirects to admin dashboard |

| URL | What Shows |
|-----|-----------|
| `app.emarabooks.com/` | User Control Center (dashboard) |
| `app.emarabooks.com/admin` | Admin dashboard (only visible to admins) |
| `app.emarabooks.com/*` | All user pages + admin pages |

### Admin Features

1. **User Management** — View all users, search by email, see their org/client/file counts
2. **Impersonation** — Click "Login As" to view the app as that user. Amber banner shows at top. Click "Exit" to return.
3. **Role Management** — Grant/revoke admin role for any user
4. **Feature Locking** — Lock/unlock features per organization (Reconciliation, Risk Monitor, Integrations, etc.)
5. **Platform Stats** — Total users, orgs, clients, transactions, files, bills, invoices

### Seeding an Admin User

```bash
ssh root@187.124.98.173
cd /var/www/finance-app

# Find the user's UUID
docker compose exec flask python3 -c "
from app import app
with app.app_context():
    from models.tier0 import OrgMember
    members = OrgMember.query.all()
    for m in members:
        print(f'uid={m.user_id} email={m.user_email or m.invited_email}')
"

# Grant admin role (replace UUID)
docker compose exec flask python3 -c "
from app import app
with app.app_context():
    from models.tier0 import UserRole
    from models.base import db
    import uuid
    role = UserRole(user_id=uuid.UUID('PASTE-USER-UUID-HERE'), role='admin')
    db.session.add(role)
    db.session.commit()
    print('Admin granted')
"
```

### Admin Tech Details

| Component | File |
|-----------|------|
| Admin guard (frontend) | `frontend/src/components/admin/AdminGuard.tsx` |
| Admin layout (sidebar) | `frontend/src/components/admin/AdminLayout.tsx` |
| Impersonation banner | `frontend/src/components/admin/ImpersonationBanner.tsx` |
| Admin pages | `frontend/src/pages/admin/Admin*.tsx` |
| Impersonation hook | `frontend/src/hooks/useImpersonation.ts` |
| Feature access hook | `frontend/src/hooks/useFeatureAccess.ts` |
| Admin API routes | `backend/routes/admin.py` |
| `@require_admin` decorator | `backend/auth.py` |
| Impersonation header | `X-Impersonate-User` (in `flaskApi.ts` + `auth.py`) |
| Locked features column | `organizations.locked_features` (JSONB) |
| Admin role table | `user_roles` (user_id + role="admin") |

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
| SSL for admin domain | `certbot --nginx -d admin.emarabooks.com` |
| Grant admin role | See "Seeding an Admin User" section above |
| Check admin roles | `docker compose exec flask python3 -c "..."` (see Admin section) |

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
