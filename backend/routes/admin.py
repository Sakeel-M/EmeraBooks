"""Admin panel API routes — platform-wide user/org management."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from sqlalchemy import func, distinct
from auth import require_auth, require_admin
from models.base import db
from models.tier0 import Organization, OrgMember, Client, UserRole, UserActiveClient
from models.tier1 import UploadedFile, BankAccount
from models.tier2 import Transaction, Bill, Invoice, Vendor, Customer

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

LOCKABLE_FEATURES = [
    "reconciliation", "risk_monitor", "integrations", "financial_reports",
    "revenue", "expenses", "cash", "settings",
]


# ── Platform Stats ────────────────────────────────────────────────────────

@admin_bp.route("/stats", methods=["GET"])
@require_auth
@require_admin
def admin_stats():
    """Platform-wide statistics for admin dashboard."""
    total_users = db.session.query(func.count(distinct(OrgMember.user_id))).scalar() or 0
    total_orgs = db.session.query(func.count(Organization.id)).scalar() or 0
    total_clients = db.session.query(func.count(Client.id)).scalar() or 0
    total_transactions = db.session.query(func.count(Transaction.id)).scalar() or 0
    total_files = db.session.query(func.count(UploadedFile.id)).scalar() or 0
    total_bills = db.session.query(func.count(Bill.id)).scalar() or 0
    total_invoices = db.session.query(func.count(Invoice.id)).scalar() or 0
    total_vendors = db.session.query(func.count(Vendor.id)).scalar() or 0
    total_customers = db.session.query(func.count(Customer.id)).scalar() or 0

    # New users this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_users = db.session.query(func.count(distinct(OrgMember.user_id))).filter(
        OrgMember.created_at >= month_start
    ).scalar() or 0

    return jsonify({
        "total_users": total_users,
        "total_orgs": total_orgs,
        "total_clients": total_clients,
        "total_transactions": total_transactions,
        "total_files": total_files,
        "total_bills": total_bills,
        "total_invoices": total_invoices,
        "total_vendors": total_vendors,
        "total_customers": total_customers,
        "new_users_this_month": new_users,
    })


# ── User Management ──────────────────────────────────────────────────────

@admin_bp.route("/users", methods=["GET"])
@require_auth
@require_admin
def admin_list_users():
    """List all users with org, client count, and admin status."""
    search = request.args.get("search", "").strip().lower()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    query = (
        db.session.query(
            OrgMember.user_id,
            OrgMember.user_email,
            OrgMember.role,
            OrgMember.created_at,
            Organization.id.label("org_id"),
            Organization.name.label("org_name"),
        )
        .join(Organization, Organization.id == OrgMember.org_id)
    )

    if search:
        query = query.filter(
            db.or_(
                func.lower(OrgMember.user_email).contains(search),
                func.lower(Organization.name).contains(search),
            )
        )

    total = query.count()
    rows = query.order_by(OrgMember.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # Get admin status and client counts in bulk
    user_ids = [str(r.user_id) for r in rows]
    admin_ids = set()
    if user_ids:
        admin_roles = UserRole.query.filter(
            UserRole.user_id.in_([uuid.UUID(uid) for uid in user_ids]),
            UserRole.role == "admin",
        ).all()
        admin_ids = {str(r.user_id) for r in admin_roles}

    users = []
    for r in rows:
        uid = str(r.user_id)
        client_count = Client.query.filter_by(org_id=r.org_id).count()
        file_count = (
            db.session.query(func.count(UploadedFile.id))
            .join(Client, Client.id == UploadedFile.client_id)
            .filter(Client.org_id == r.org_id)
            .scalar() or 0
        )
        users.append({
            "user_id": uid,
            "email": r.user_email or "",
            "org_id": str(r.org_id),
            "org_name": r.org_name,
            "role": r.role,
            "client_count": client_count,
            "file_count": file_count,
            "is_admin": uid in admin_ids,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return jsonify({"users": users, "total": total, "page": page, "per_page": per_page})


@admin_bp.route("/users/<user_id>", methods=["GET"])
@require_auth
@require_admin
def admin_user_detail(user_id):
    """Detailed view of a single user."""
    uid = uuid.UUID(user_id)
    member = OrgMember.query.filter_by(user_id=uid).first()
    if not member:
        return jsonify({"error": "User not found"}), 404

    org = Organization.query.get(member.org_id)
    clients = Client.query.filter_by(org_id=member.org_id).all()
    is_admin = UserRole.query.filter_by(user_id=uid, role="admin").first() is not None

    # Aggregate stats across all clients
    client_ids = [c.id for c in clients]
    txn_count = 0
    file_count = 0
    if client_ids:
        txn_count = Transaction.query.filter(Transaction.client_id.in_(client_ids)).count()
        file_count = UploadedFile.query.filter(UploadedFile.client_id.in_(client_ids)).count()

    return jsonify({
        "user_id": user_id,
        "email": member.user_email or "",
        "role": member.role,
        "is_admin": is_admin,
        "created_at": member.created_at.isoformat() if member.created_at else None,
        "org": org.to_dict() if org else None,
        "clients": [c.to_dict() for c in clients],
        "stats": {
            "transaction_count": txn_count,
            "file_count": file_count,
            "client_count": len(clients),
        },
    })


@admin_bp.route("/users/<user_id>/role", methods=["PATCH"])
@require_auth
@require_admin
def admin_update_role(user_id):
    """Grant or revoke admin role."""
    data = request.get_json()
    action = data.get("action")  # "grant" or "revoke"
    uid = uuid.UUID(user_id)

    if action == "grant":
        existing = UserRole.query.filter_by(user_id=uid, role="admin").first()
        if existing:
            return jsonify({"message": "Already an admin"}), 200
        role = UserRole(user_id=uid, role="admin")
        db.session.add(role)
        db.session.commit()
        return jsonify({"ok": True, "action": "granted"})

    elif action == "revoke":
        # Safety: don't allow revoking the last admin
        admin_count = UserRole.query.filter_by(role="admin").count()
        if admin_count <= 1:
            return jsonify({"error": "Cannot revoke the last admin"}), 400
        existing = UserRole.query.filter_by(user_id=uid, role="admin").first()
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return jsonify({"ok": True, "action": "revoked"})

    return jsonify({"error": "action must be 'grant' or 'revoke'"}), 400


# ── Impersonation ────────────────────────────────────────────────────────

@admin_bp.route("/impersonate/<user_id>", methods=["POST"])
@require_auth
@require_admin
def admin_impersonate(user_id):
    """Validate impersonation target and return their context."""
    uid = uuid.UUID(user_id)
    member = OrgMember.query.filter_by(user_id=uid).first()
    if not member:
        return jsonify({"error": "User not found"}), 404

    org = Organization.query.get(member.org_id)
    clients = Client.query.filter_by(org_id=member.org_id).all()

    # Get their active client
    active = UserActiveClient.query.filter_by(user_id=uid).first()
    active_client_id = str(active.client_id) if active else (str(clients[0].id) if clients else None)

    return jsonify({
        "user_id": user_id,
        "email": member.user_email or "",
        "org_name": org.name if org else "",
        "active_client_id": active_client_id,
        "clients": [{"id": str(c.id), "name": c.name} for c in clients],
    })


# ── Organization Management ──────────────────────────────────────────────

@admin_bp.route("/orgs", methods=["GET"])
@require_auth
@require_admin
def admin_list_orgs():
    """List all organizations with member/client counts and locked features."""
    search = request.args.get("search", "").strip().lower()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 50))

    query = Organization.query
    if search:
        query = query.filter(func.lower(Organization.name).contains(search))

    total = query.count()
    orgs = query.order_by(Organization.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for org in orgs:
        member_count = OrgMember.query.filter_by(org_id=org.id).count()
        client_count = Client.query.filter_by(org_id=org.id).count()
        result.append({
            **org.to_dict(),
            "member_count": member_count,
            "client_count": client_count,
        })

    return jsonify({"orgs": result, "total": total, "page": page, "per_page": per_page})


@admin_bp.route("/orgs/<org_id>/features", methods=["PATCH"])
@require_auth
@require_admin
def admin_update_features(org_id):
    """Set locked features for an organization."""
    org = Organization.query.get(uuid.UUID(org_id))
    if not org:
        return jsonify({"error": "Organization not found"}), 404

    data = request.get_json()
    features = data.get("locked_features", [])

    # Validate feature keys
    invalid = [f for f in features if f not in LOCKABLE_FEATURES]
    if invalid:
        return jsonify({"error": f"Invalid feature keys: {invalid}. Valid: {LOCKABLE_FEATURES}"}), 400

    org.locked_features = features
    db.session.commit()
    return jsonify({"ok": True, "locked_features": org.locked_features})


# ── Lockable Features List ───────────────────────────────────────────────

@admin_bp.route("/features", methods=["GET"])
@require_auth
@require_admin
def admin_list_features():
    """List all lockable feature keys."""
    return jsonify({"features": LOCKABLE_FEATURES})
