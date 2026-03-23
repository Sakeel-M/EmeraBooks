"""Auth middleware — verifies Supabase access tokens via Supabase Auth API."""
import os
import uuid as _uuid
from functools import wraps
import requests
from flask import request, g, jsonify

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hnvwrxkjnnepnchjunel.supabase.co")
_DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudndyeGtqbm5lcG5jaGp1bmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTAwNTksImV4cCI6MjA3ODUyNjA1OX0.O1nrpKaT0zd2KW5CixqyM8GqMQ1FruGn9bTz66Bhxcs"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or _DEFAULT_ANON_KEY


def require_auth(f):
    """Decorator: verifies Supabase token via Auth API and sets g.user_id.
    Also supports admin impersonation via X-Impersonate-User header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing authorization token"}), 401

        token = auth_header[7:]  # strip "Bearer "

        try:
            # Verify token by calling Supabase Auth API
            resp = requests.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY,
                },
                timeout=10,
            )

            if resp.status_code != 200:
                return jsonify({"error": "Invalid or expired token"}), 401

            user_data = resp.json()
            user_id = user_data.get("id")
            if not user_id:
                return jsonify({"error": "Could not extract user ID from token"}), 401

            g.user_id = user_id
            g.user_email = user_data.get("email", "")
            g.user_role = user_data.get("role", "")
            g.is_admin = False
            g.is_impersonating = False
            g.real_admin_id = None

            # Auto-backfill user_email on OrgMember if missing
            if g.user_email:
                try:
                    from models.tier0 import OrgMember
                    from models.base import db as _db
                    member = OrgMember.query.filter_by(user_id=_uuid.UUID(user_id)).first()
                    if member and not member.user_email:
                        member.user_email = g.user_email
                        _db.session.commit()
                except Exception:
                    pass  # Non-critical — don't block the request

            # Admin impersonation: if X-Impersonate-User header is present,
            # verify caller is admin then override g.user_id
            impersonate_id = request.headers.get("X-Impersonate-User")
            if impersonate_id:
                from models.tier0 import UserRole
                admin_role = UserRole.query.filter_by(
                    user_id=_uuid.UUID(g.user_id), role="admin"
                ).first()
                if not admin_role:
                    return jsonify({"error": "Only admins can impersonate users"}), 403
                g.real_admin_id = g.user_id
                g.user_id = impersonate_id
                g.is_impersonating = True
                g.is_admin = True

        except requests.exceptions.Timeout:
            return jsonify({"error": "Auth verification timed out"}), 503
        except requests.exceptions.RequestException as e:
            return jsonify({"error": f"Auth verification failed: {e}"}), 503

        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator: must be used AFTER @require_auth. Checks if user is a platform admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        from models.tier0 import UserRole
        # Use real_admin_id if impersonating (admin is still admin even when impersonating)
        check_id = g.get("real_admin_id") or g.user_id
        role = UserRole.query.filter_by(
            user_id=_uuid.UUID(check_id), role="admin"
        ).first()
        if not role:
            return jsonify({"error": "Admin access required"}), 403
        g.is_admin = True
        return f(*args, **kwargs)
    return decorated
