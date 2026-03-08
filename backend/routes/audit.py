"""Audit log routes."""
import uuid
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import user_has_org_access
from models.base import db
from models.tier4 import AuditLog

audit_bp = Blueprint("audit", __name__, url_prefix="/api")


@audit_bp.route("/audit-logs", methods=["POST"])
@require_auth
def create_audit_log():
    data = request.get_json()
    org_id = data.get("org_id")
    if not org_id or not user_has_org_access(org_id):
        return jsonify({"error": "Access denied"}), 403

    log = AuditLog(
        org_id=uuid.UUID(org_id),
        client_id=uuid.UUID(data["client_id"]) if data.get("client_id") else None,
        user_id=uuid.UUID(g.user_id),
        action=data.get("action"),
        entity_type=data.get("entity_type"),
        entity_id=uuid.UUID(data["entity_id"]) if data.get("entity_id") else None,
        old_values=data.get("old_values"),
        new_values=data.get("new_values"),
        ip_address=request.remote_addr,
    )
    db.session.add(log)
    db.session.commit()
    return jsonify(log.to_dict()), 201
