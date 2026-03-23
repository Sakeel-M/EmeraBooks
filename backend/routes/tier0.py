"""Tier 0 routes: Organization, Client, User context."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import user_has_org_access
from models.base import db
from models.tier0 import Organization, OrgMember, Client, UserActiveClient, UserRole

tier0_bp = Blueprint("tier0", __name__, url_prefix="/api")


# ── Organizations ─────────────────────────────────────────────────────────

@tier0_bp.route("/organizations", methods=["POST"])
@require_auth
def create_organization():
    # If user already has an org, return it instead of creating a duplicate
    existing_member = OrgMember.query.filter_by(user_id=uuid.UUID(g.user_id)).first()
    if existing_member:
        existing_org = Organization.query.get(existing_member.org_id)
        if existing_org:
            return jsonify(existing_org.to_dict()), 200

    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"error": "name is required"}), 400

    slug = name.lower()
    for ch in " _/\\@#$%^&*()":
        slug = slug.replace(ch, "-")
    slug = slug.strip("-")

    # Handle duplicate slugs by appending a number
    base_slug = slug
    counter = 1
    while Organization.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(
        name=name,
        slug=slug,
        default_currency=data.get("default_currency", "USD"),
        country=data.get("country", "AE"),
        vat_rate=data.get("vat_rate", 5.00),
        fiscal_year_start=data.get("fiscal_year_start", 1),
    )
    db.session.add(org)
    db.session.flush()

    member = OrgMember(
        org_id=org.id,
        user_id=uuid.UUID(g.user_id),
        user_email=g.user_email,
        role="owner",
        accepted_at=datetime.now(timezone.utc),
    )
    db.session.add(member)
    db.session.commit()
    return jsonify(org.to_dict()), 201


@tier0_bp.route("/organizations/<org_id>/clients", methods=["POST"])
@require_auth
def create_client(org_id):
    if not user_has_org_access(org_id):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    client = Client(
        org_id=uuid.UUID(org_id),
        name=data.get("name"),
        currency=data.get("currency", "AED"),
        country=data.get("country", "AE"),
        industry=data.get("industry"),
        trade_license=data.get("trade_license"),
        trn=data.get("trn"),
    )
    db.session.add(client)
    db.session.flush()

    # Set as active client
    uac = UserActiveClient.query.filter_by(user_id=uuid.UUID(g.user_id)).first()
    if uac:
        uac.client_id = client.id
        uac.updated_at = datetime.now(timezone.utc)
    else:
        uac = UserActiveClient(
            user_id=uuid.UUID(g.user_id),
            client_id=client.id,
        )
        db.session.add(uac)

    db.session.commit()
    return jsonify(client.to_dict()), 201


@tier0_bp.route("/organizations/<org_id>/clients", methods=["GET"])
@require_auth
def get_clients(org_id):
    if not user_has_org_access(org_id):
        return jsonify({"error": "Access denied"}), 403

    clients = (
        Client.query
        .filter_by(org_id=uuid.UUID(org_id))
        .order_by(Client.name)
        .all()
    )
    return jsonify([c.to_dict() for c in clients])


@tier0_bp.route("/clients/<client_id>", methods=["PATCH"])
@require_auth
def update_client(client_id):
    client = Client.query.get(uuid.UUID(client_id))
    if not client:
        return jsonify({"error": "Not found"}), 404
    if not user_has_org_access(str(client.org_id)):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if "name" in data:
        client.name = data["name"]
    if "currency" in data:
        client.currency = data["currency"]
    if "country" in data:
        client.country = data["country"]
    if "industry" in data:
        client.industry = data["industry"]
    if "status" in data:
        client.status = data["status"]
    if "trade_license" in data:
        client.trade_license = data["trade_license"]
    if "trn" in data:
        client.trn = data["trn"]
    if "fiscal_year_start" in data:
        client.fiscal_year_start = data["fiscal_year_start"]
    if "metadata" in data:
        client.metadata_ = data["metadata"]

    db.session.commit()
    return jsonify(client.to_dict())


@tier0_bp.route("/clients/<client_id>", methods=["DELETE"])
@require_auth
def delete_client(client_id):
    client = Client.query.get(uuid.UUID(client_id))
    if not client:
        return jsonify({"error": "Not found"}), 404
    if not user_has_org_access(str(client.org_id)):
        return jsonify({"error": "Access denied"}), 403

    db.session.delete(client)
    db.session.commit()
    return jsonify({"ok": True})


# ── User Context ──────────────────────────────────────────────────────────

@tier0_bp.route("/me/active-client", methods=["GET"])
@require_auth
def get_active_client():
    uac = UserActiveClient.query.filter_by(user_id=uuid.UUID(g.user_id)).first()
    if not uac:
        return jsonify(None)

    client = Client.query.get(uac.client_id)
    if not client:
        return jsonify(None)

    org = Organization.query.get(client.org_id)
    return jsonify({
        "client_id": str(client.id),
        "client": client.to_dict(),
        "org_id": str(client.org_id),
        "org_name": org.name if org else None,
        "currency": client.currency,
    })


@tier0_bp.route("/me/active-client", methods=["PUT"])
@require_auth
def switch_active_client():
    data = request.get_json()
    client_id = data.get("client_id")
    if not client_id:
        return jsonify({"error": "client_id required"}), 400

    uac = UserActiveClient.query.filter_by(user_id=uuid.UUID(g.user_id)).first()
    if uac:
        uac.client_id = uuid.UUID(client_id)
        uac.updated_at = datetime.now(timezone.utc)
    else:
        uac = UserActiveClient(
            user_id=uuid.UUID(g.user_id),
            client_id=uuid.UUID(client_id),
        )
        db.session.add(uac)

    db.session.commit()
    return jsonify({"ok": True})


@tier0_bp.route("/me/org", methods=["GET"])
@require_auth
def get_my_org():
    membership = (
        OrgMember.query
        .filter_by(user_id=uuid.UUID(g.user_id))
        .first()
    )
    if not membership:
        return jsonify(None)

    # Backfill email if missing (for users created before this field existed)
    if not membership.user_email and g.user_email:
        membership.user_email = g.user_email
        db.session.commit()

    org = Organization.query.get(membership.org_id)
    clients = (
        Client.query
        .filter_by(org_id=membership.org_id)
        .order_by(Client.name)
        .all()
    )

    return jsonify({
        "org": org.to_dict() if org else None,
        "org_id": str(membership.org_id),
        "role": membership.role,
        "clients": [c.to_dict() for c in clients],
        "has_org": True,
    })


@tier0_bp.route("/me/is-admin", methods=["GET"])
@require_auth
def get_is_admin():
    role = (
        UserRole.query
        .filter_by(user_id=uuid.UUID(g.user_id), role="admin")
        .first()
    )
    return jsonify({"is_admin": role is not None})


@tier0_bp.route("/me/org-membership", methods=["GET"])
@require_auth
def get_org_membership():
    """Used by ProtectedRoute to check if user has an org (needs onboarding or not)."""
    membership = (
        OrgMember.query
        .filter_by(user_id=uuid.UUID(g.user_id))
        .first()
    )
    if membership:
        return jsonify({"has_org": True, "org_id": str(membership.org_id), "role": membership.role})
    return jsonify({"has_org": False})
