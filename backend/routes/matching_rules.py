"""Matching rules CRUD routes."""
import uuid
from flask import Blueprint, request, jsonify
from auth import require_auth
from permissions import require_client_access, user_has_client_access
from models.base import db
from models.tier3 import MatchingRule

matching_rules_bp = Blueprint("matching_rules", __name__, url_prefix="/api")


@matching_rules_bp.route("/clients/<client_id>/matching-rules", methods=["GET"])
@require_auth
@require_client_access
def get_matching_rules(client_id):
    rules = (
        MatchingRule.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(MatchingRule.priority)
        .all()
    )
    return jsonify([r.to_dict() for r in rules])


@matching_rules_bp.route("/clients/<client_id>/matching-rules", methods=["PUT"])
@require_auth
@require_client_access
def upsert_matching_rule(client_id):
    data = request.get_json()
    rule_id = data.get("id")

    if rule_id:
        rule = MatchingRule.query.get(uuid.UUID(rule_id))
        if not rule or str(rule.client_id) != client_id:
            return jsonify({"error": "Rule not found"}), 404
    else:
        rule = MatchingRule(client_id=uuid.UUID(client_id))
        db.session.add(rule)

    for key in ("name", "description", "recon_type", "priority", "is_active",
                "match_by_amount", "match_by_date", "match_by_description",
                "match_sign", "amount_tolerance_type", "amount_tolerance_value",
                "date_tolerance_days", "auto_match"):
        if key in data:
            setattr(rule, key, data[key])

    db.session.commit()
    return jsonify(rule.to_dict())


@matching_rules_bp.route("/matching-rules/<rule_id>", methods=["DELETE"])
@require_auth
def delete_matching_rule(rule_id):
    rule = MatchingRule.query.get_or_404(uuid.UUID(rule_id))
    if not user_has_client_access(rule.client_id):
        return jsonify({"error": "Access denied"}), 403

    db.session.delete(rule)
    db.session.commit()
    return jsonify({"ok": True})
