"""Permission helpers — replaces Supabase RLS policies."""
import os
import uuid
from functools import wraps
from flask import request, g, jsonify
from models.base import db
from models.tier0 import OrgMember, Client, UserRole


def user_has_client_access(client_id):
    """Check that the current user (g.user_id) belongs to the org that owns this client."""
    result = (
        db.session.query(Client)
        .join(OrgMember, OrgMember.org_id == Client.org_id)
        .filter(
            Client.id == uuid.UUID(str(client_id)),
            OrgMember.user_id == uuid.UUID(str(g.user_id)),
        )
        .first()
    )
    return result is not None


def user_has_org_access(org_id):
    """Check that the current user belongs to this organization."""
    result = (
        db.session.query(OrgMember)
        .filter(
            OrgMember.org_id == uuid.UUID(str(org_id)),
            OrgMember.user_id == uuid.UUID(str(g.user_id)),
        )
        .first()
    )
    return result is not None


def get_effective_client_ids(client_id):
    """For parent accounts, returns [parent_id, child1_id, child2_id, ...].
    For child/standalone accounts, returns [client_id].
    Used by GET endpoints to aggregate data across sub-accounts."""
    cid = uuid.UUID(str(client_id))
    children = Client.query.filter_by(parent_id=cid).all()
    ids = [cid]
    for c in children:
        ids.append(c.id)
    return ids


def user_has_active_subscription(user_id):
    """Check if the user's organization has an active (or trialing) subscription."""
    from models.billing import OrgSubscription
    member = OrgMember.query.filter_by(user_id=uuid.UUID(str(user_id))).first()
    if not member:
        return False
    sub = OrgSubscription.query.filter_by(org_id=member.org_id).first()
    if not sub:
        return False
    return sub.status in ("active", "trialing")


def require_subscription(f):
    """Decorator: must run AFTER @require_auth. Blocks the request if the user
    does not have an active subscription. Platform admins bypass the check.
    Set BILLING_ENFORCED=false to disable enforcement (e.g. before Stripe is set up)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if os.getenv("BILLING_ENFORCED", "true").lower() in ("0", "false", "no"):
            return f(*args, **kwargs)

        user_id = g.get("user_id")
        if not user_id:
            return jsonify({"error": "Auth required"}), 401

        # Admins always allowed (covers support / impersonation flows)
        check_id = g.get("real_admin_id") or user_id
        try:
            admin_role = UserRole.query.filter_by(user_id=uuid.UUID(check_id), role="admin").first()
            if admin_role:
                return f(*args, **kwargs)
        except Exception:
            pass

        if not user_has_active_subscription(user_id):
            return jsonify({"error": "subscription_required"}), 403

        return f(*args, **kwargs)
    return decorated


def require_client_access(f):
    """Decorator: reads client_id from URL param, query string, or JSON body and checks access."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Try URL param first (e.g., /api/clients/<client_id>/...)
        client_id = kwargs.get("client_id")
        # Then query string
        if not client_id:
            client_id = request.args.get("client_id")
        # Then JSON body
        if not client_id:
            data = request.get_json(silent=True) or {}
            client_id = data.get("client_id")

        if not client_id:
            return jsonify({"error": "client_id required"}), 400

        if not user_has_client_access(client_id):
            return jsonify({"error": "Access denied"}), 403

        g.client_id = client_id
        return f(*args, **kwargs)
    return decorated
