"""Auth middleware — verifies Supabase access tokens via Supabase Auth API."""
import os
from functools import wraps
import requests
from flask import request, g, jsonify

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://hnvwrxkjnnepnchjunel.supabase.co")
_DEFAULT_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudndyeGtqbm5lcG5jaGp1bmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NTAwNTksImV4cCI6MjA3ODUyNjA1OX0.O1nrpKaT0zd2KW5CixqyM8GqMQ1FruGn9bTz66Bhxcs"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or _DEFAULT_ANON_KEY


def require_auth(f):
    """Decorator: verifies Supabase token via Auth API and sets g.user_id."""
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

        except requests.exceptions.Timeout:
            return jsonify({"error": "Auth verification timed out"}), 503
        except requests.exceptions.RequestException as e:
            return jsonify({"error": f"Auth verification failed: {e}"}), 503

        return f(*args, **kwargs)
    return decorated
