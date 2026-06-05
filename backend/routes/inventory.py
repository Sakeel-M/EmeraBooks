"""Inventory items CRUD routes."""
import uuid
from flask import Blueprint, request, jsonify

from auth import require_auth
from permissions import require_client_access, user_has_client_access, get_effective_client_ids
from models.base import db
from models.tier2 import InventoryItem

inventory_bp = Blueprint("inventory", __name__, url_prefix="/api")


def _coerce_num(raw, default=0):
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except (ValueError, TypeError):
        return default


@inventory_bp.route("/clients/<client_id>/inventory", methods=["GET"])
@require_auth
@require_client_access
def get_inventory(client_id):
    cids = get_effective_client_ids(client_id)
    q = (
        InventoryItem.query
        .filter(InventoryItem.client_id.in_(cids))
        .order_by(InventoryItem.name)
    )
    if request.args.get("active_only") == "true":
        q = q.filter_by(is_active=True)
    return jsonify([i.to_dict() for i in q.all()])


@inventory_bp.route("/clients/<client_id>/inventory", methods=["POST"])
@require_auth
@require_client_access
def create_inventory(client_id):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    cid = uuid.UUID(client_id)
    sku = (data.get("sku") or "").strip() or None
    # Optional duplicate guard: same SKU within client.
    if sku:
        dup = InventoryItem.query.filter_by(client_id=cid, sku=sku).first()
        if dup:
            return jsonify({
                "error": f"An item with SKU '{sku}' already exists.",
                "code": "duplicate",
                "existing_id": str(dup.id),
            }), 409

    item = InventoryItem(
        client_id=cid,
        sku=sku,
        name=name,
        description=data.get("description"),
        category=data.get("category"),
        unit=(data.get("unit") or "each"),
        unit_price=_coerce_num(data.get("unit_price"), 0),
        cost_price=_coerce_num(data.get("cost_price"), 0),
        tax_rate=_coerce_num(data.get("tax_rate"), 5),
        quantity_on_hand=_coerce_num(data.get("quantity_on_hand"), 0),
        reorder_level=_coerce_num(data.get("reorder_level"), 0),
        currency=data.get("currency", "AED"),
        is_active=bool(data.get("is_active", True)),
        metadata_=data.get("metadata") or {},
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@inventory_bp.route("/inventory/<item_id>", methods=["PATCH"])
@require_auth
def update_inventory(item_id):
    item = InventoryItem.query.get(uuid.UUID(item_id))
    if not item:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(item.client_id):
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json() or {}
    for key in (
        "sku", "name", "description", "category", "unit",
        "currency", "is_active",
    ):
        if key in data:
            setattr(item, key, data[key])
    for num_key in ("unit_price", "cost_price", "tax_rate",
                    "quantity_on_hand", "reorder_level"):
        if num_key in data:
            setattr(item, num_key, _coerce_num(data[num_key], getattr(item, num_key) or 0))
    if "metadata" in data and isinstance(data["metadata"], dict):
        merged = dict(item.metadata_ or {})
        merged.update(data["metadata"])
        item.metadata_ = merged
    db.session.commit()
    return jsonify(item.to_dict())


@inventory_bp.route("/inventory/<item_id>", methods=["DELETE"])
@require_auth
def delete_inventory(item_id):
    item = InventoryItem.query.get(uuid.UUID(item_id))
    if not item:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(item.client_id):
        return jsonify({"error": "Access denied"}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({"ok": True})


@inventory_bp.route("/inventory/<item_id>/adjust", methods=["POST"])
@require_auth
def adjust_inventory(item_id):
    """Adjust quantity_on_hand by a delta. Positive = stock in, negative = stock out."""
    item = InventoryItem.query.get(uuid.UUID(item_id))
    if not item:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(item.client_id):
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json() or {}
    delta = _coerce_num(data.get("delta"), 0)
    item.quantity_on_hand = float(item.quantity_on_hand or 0) + delta
    db.session.commit()
    return jsonify(item.to_dict())
