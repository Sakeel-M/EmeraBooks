"""Reconciliation sessions & items CRUD routes."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import require_client_access, user_has_client_access
from models.base import db
from models.tier3 import ReconciliationSession, ReconciliationItem

reconciliation_crud_bp = Blueprint("reconciliation_crud", __name__, url_prefix="/api")


# ── Sessions ──────────────────────────────────────────────────────────────

@reconciliation_crud_bp.route("/clients/<client_id>/reconciliation/sessions", methods=["GET"])
@require_auth
@require_client_access
def get_sessions(client_id):
    sessions = (
        ReconciliationSession.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(ReconciliationSession.created_at.desc())
        .all()
    )
    return jsonify([s.to_dict() for s in sessions])


@reconciliation_crud_bp.route("/clients/<client_id>/reconciliation/sessions", methods=["POST"])
@require_auth
@require_client_access
def create_session(client_id):
    data = request.get_json()
    session = ReconciliationSession(
        client_id=uuid.UUID(client_id),
        bank_account_id=uuid.UUID(data["bank_account_id"]) if data.get("bank_account_id") else None,
        recon_type=data.get("recon_type", "bank"),
        source_a=data.get("source_a"),
        source_b=data.get("source_b"),
        period_start=data.get("period_start"),
        period_end=data.get("period_end"),
        statement_ending_balance=data.get("statement_ending_balance"),
    )
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 201


@reconciliation_crud_bp.route("/reconciliation/sessions/<session_id>", methods=["PATCH"])
@require_auth
def update_session(session_id):
    session = ReconciliationSession.query.get_or_404(uuid.UUID(session_id))
    if not user_has_client_access(session.client_id):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    for key in ("status", "match_count", "flag_count", "match_rate",
                "unreconciled_difference", "statement_ending_balance", "ledger_ending_balance"):
        if key in data:
            setattr(session, key, data[key])

    if data.get("status") == "finalized":
        session.finalized_by = uuid.UUID(g.user_id)
        session.finalized_at = datetime.now(timezone.utc)

    session.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(session.to_dict())


@reconciliation_crud_bp.route("/reconciliation/sessions/<session_id>", methods=["DELETE"])
@require_auth
def delete_session(session_id):
    session = ReconciliationSession.query.get_or_404(uuid.UUID(session_id))
    if not user_has_client_access(session.client_id):
        return jsonify({"error": "Access denied"}), 403

    ReconciliationItem.query.filter_by(session_id=uuid.UUID(session_id)).delete()
    db.session.delete(session)
    db.session.commit()
    return jsonify({"ok": True})


# ── Items ─────────────────────────────────────────────────────────────────

@reconciliation_crud_bp.route("/reconciliation/sessions/<session_id>/items", methods=["GET"])
@require_auth
def get_items(session_id):
    session = ReconciliationSession.query.get_or_404(uuid.UUID(session_id))
    if not user_has_client_access(session.client_id):
        return jsonify({"error": "Access denied"}), 403

    items = (
        ReconciliationItem.query
        .filter_by(session_id=uuid.UUID(session_id))
        .order_by(ReconciliationItem.created_at)
        .all()
    )
    return jsonify([i.to_dict() for i in items])


@reconciliation_crud_bp.route("/reconciliation/sessions/<session_id>/items", methods=["POST"])
@require_auth
def save_items(session_id):
    session = ReconciliationSession.query.get_or_404(uuid.UUID(session_id))
    if not user_has_client_access(session.client_id):
        return jsonify({"error": "Access denied"}), 403

    # Delete existing items
    ReconciliationItem.query.filter_by(session_id=uuid.UUID(session_id)).delete()

    data = request.get_json()
    items = data.get("items", [])
    rows = []
    for item in items:
        rows.append(ReconciliationItem(
            session_id=uuid.UUID(session_id),
            client_id=session.client_id,
            source_a_id=uuid.UUID(item["source_a_id"]) if item.get("source_a_id") else None,
            source_a_date=item.get("source_a_date"),
            source_a_desc=item.get("source_a_desc"),
            source_a_amount=item.get("source_a_amount"),
            source_b_id=uuid.UUID(item["source_b_id"]) if item.get("source_b_id") else None,
            source_b_date=item.get("source_b_date"),
            source_b_desc=item.get("source_b_desc"),
            source_b_amount=item.get("source_b_amount"),
            status=item.get("status", "flagged"),
            match_quality=item.get("match_quality"),
            flag_type=item.get("flag_type"),
            difference=item.get("difference", 0),
            days_diff=item.get("days_diff", 0),
            reason=item.get("reason"),
            txn_type=item.get("txn_type"),
            txn_type_label=item.get("txn_type_label"),
        ))

    db.session.bulk_save_objects(rows)
    db.session.commit()
    return jsonify({"ok": True, "count": len(rows)}), 201


@reconciliation_crud_bp.route("/clients/<client_id>/reconciliation/flagged", methods=["GET"])
@require_auth
@require_client_access
def get_flagged_items(client_id):
    items = (
        ReconciliationItem.query
        .filter_by(client_id=uuid.UUID(client_id), status="flagged")
        .order_by(ReconciliationItem.created_at.desc())
        .all()
    )
    return jsonify([i.to_dict() for i in items])


@reconciliation_crud_bp.route("/reconciliation/items/<item_id>", methods=["PATCH"])
@require_auth
def update_item(item_id):
    item = ReconciliationItem.query.get_or_404(uuid.UUID(item_id))
    if not user_has_client_access(item.client_id):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    for key in ("status", "resolution", "match_quality", "flag_type",
                "source_b_desc", "source_b_date", "source_b_amount"):
        if key in data:
            setattr(item, key, data[key])

    # Handle source_b_id separately (needs UUID conversion)
    if "source_b_id" in data:
        item.source_b_id = uuid.UUID(data["source_b_id"]) if data["source_b_id"] else None

    if data.get("status") in ("matched", "manual_match", "excluded"):
        item.resolved_by = uuid.UUID(g.user_id)
        item.resolved_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(item.to_dict())
