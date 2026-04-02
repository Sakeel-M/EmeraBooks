"""Permission helpers — replaces Supabase RLS policies."""
import uuid
from functools import wraps
from flask import request, g, jsonify
from models.base import db
from models.tier0 import OrgMember, Client


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
