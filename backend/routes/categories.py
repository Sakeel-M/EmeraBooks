"""Categories CRUD routes."""
import uuid
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from models.base import db
from models.tier0 import Category

categories_bp = Blueprint("categories", __name__, url_prefix="/api")


@categories_bp.route("/categories", methods=["GET"])
@require_auth
def get_categories():
    cat_type = request.args.get("type")
    query = Category.query.filter(
        db.or_(
            Category.user_id == uuid.UUID(g.user_id),
            Category.is_system == True,
        )
    )
    if cat_type:
        query = query.filter(db.or_(Category.type == cat_type, Category.type == "all"))

    categories = query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in categories])


@categories_bp.route("/categories", methods=["POST"])
@require_auth
def create_category():
    data = request.get_json()
    cat = Category(
        user_id=uuid.UUID(g.user_id),
        name=data.get("name"),
        type=data.get("type", "all"),
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@categories_bp.route("/categories/<category_id>", methods=["PATCH"])
@require_auth
def update_category(category_id):
    cat = Category.query.get_or_404(uuid.UUID(category_id))
    if str(cat.user_id) != g.user_id:
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if "name" in data:
        cat.name = data["name"]
    if "type" in data:
        cat.type = data["type"]

    db.session.commit()
    return jsonify(cat.to_dict())


@categories_bp.route("/categories/<category_id>", methods=["DELETE"])
@require_auth
def delete_category(category_id):
    cat = Category.query.get_or_404(uuid.UUID(category_id))
    if str(cat.user_id) != g.user_id:
        return jsonify({"error": "Access denied"}), 403

    db.session.delete(cat)
    db.session.commit()
    return jsonify({"ok": True})
