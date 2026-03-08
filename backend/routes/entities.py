"""Vendors, Customers, Bills, Invoices, Accounts, Connections routes."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from auth import require_auth
from permissions import require_client_access, user_has_client_access
from models.base import db
from models.tier1 import Connection
from models.tier2 import Vendor, Customer, Bill, Invoice, Account

entities_bp = Blueprint("entities", __name__, url_prefix="/api")


@entities_bp.route("/clients/<client_id>/vendors", methods=["GET"])
@require_auth
@require_client_access
def get_vendors(client_id):
    vendors = (
        Vendor.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Vendor.name)
        .all()
    )
    return jsonify([v.to_dict() for v in vendors])


@entities_bp.route("/clients/<client_id>/customers", methods=["GET"])
@require_auth
@require_client_access
def get_customers(client_id):
    customers = (
        Customer.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Customer.name)
        .all()
    )
    return jsonify([c.to_dict() for c in customers])


@entities_bp.route("/clients/<client_id>/vendors", methods=["POST"])
@require_auth
@require_client_access
def create_vendor(client_id):
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    # Check duplicate
    existing = Vendor.query.filter_by(client_id=uuid.UUID(client_id), name=name).first()
    if existing:
        return jsonify(existing.to_dict()), 200
    vendor = Vendor(
        client_id=uuid.UUID(client_id),
        name=name,
        email=data.get("email"),
        phone=data.get("phone"),
        trn=data.get("trn"),
        category=data.get("category"),
        payment_terms=data.get("payment_terms", 30),
    )
    db.session.add(vendor)
    db.session.commit()
    return jsonify(vendor.to_dict()), 201


@entities_bp.route("/clients/<client_id>/customers", methods=["POST"])
@require_auth
@require_client_access
def create_customer(client_id):
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    existing = Customer.query.filter_by(client_id=uuid.UUID(client_id), name=name).first()
    if existing:
        return jsonify(existing.to_dict()), 200
    customer = Customer(
        client_id=uuid.UUID(client_id),
        name=name,
        email=data.get("email"),
        phone=data.get("phone"),
        trn=data.get("trn"),
        category=data.get("category"),
        payment_terms=data.get("payment_terms", 30),
    )
    db.session.add(customer)
    db.session.commit()
    return jsonify(customer.to_dict()), 201


@entities_bp.route("/clients/<client_id>/bills", methods=["POST"])
@require_auth
@require_client_access
def create_bill(client_id):
    data = request.get_json()
    total = float(data.get("total", 0))
    subtotal = float(data.get("subtotal", round(total / 1.05, 2)))
    tax_amount = float(data.get("tax_amount", round(total - subtotal, 2)))
    bill = Bill(
        client_id=uuid.UUID(client_id),
        vendor_id=uuid.UUID(data["vendor_id"]) if data.get("vendor_id") else None,
        source=data.get("source", "manual"),
        bill_number=data.get("bill_number"),
        bill_date=data.get("bill_date", datetime.now(timezone.utc).date().isoformat()),
        due_date=data.get("due_date"),
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency=data.get("currency", "AED"),
        status=data.get("status", "open"),
        category=data.get("category"),
        notes=data.get("notes"),
    )
    db.session.add(bill)
    db.session.commit()
    return jsonify(bill.to_dict()), 201


@entities_bp.route("/bills/<bill_id>", methods=["PATCH"])
@require_auth
def update_bill(bill_id):
    bill = Bill.query.get(uuid.UUID(bill_id))
    if not bill:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(bill.client_id):
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json()
    for key in ("bill_number", "bill_date", "due_date", "subtotal",
                "tax_amount", "total", "currency", "status", "category", "notes"):
        if key in data:
            setattr(bill, key, data[key])
    if "vendor_id" in data:
        bill.vendor_id = uuid.UUID(data["vendor_id"]) if data["vendor_id"] else None
    db.session.commit()
    return jsonify(bill.to_dict())


@entities_bp.route("/bills/<bill_id>", methods=["DELETE"])
@require_auth
def delete_bill(bill_id):
    bill = Bill.query.get(uuid.UUID(bill_id))
    if not bill:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(bill.client_id):
        return jsonify({"error": "Access denied"}), 403
    db.session.delete(bill)
    db.session.commit()
    return jsonify({"ok": True})


@entities_bp.route("/clients/<client_id>/invoices", methods=["POST"])
@require_auth
@require_client_access
def create_invoice(client_id):
    data = request.get_json()
    total = float(data.get("total", 0))
    subtotal = float(data.get("subtotal", round(total / 1.05, 2)))
    tax_amount = float(data.get("tax_amount", round(total - subtotal, 2)))
    invoice = Invoice(
        client_id=uuid.UUID(client_id),
        customer_id=uuid.UUID(data["customer_id"]) if data.get("customer_id") else None,
        source=data.get("source", "manual"),
        invoice_number=data.get("invoice_number"),
        invoice_date=data.get("invoice_date", datetime.now(timezone.utc).date().isoformat()),
        due_date=data.get("due_date"),
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        currency=data.get("currency", "AED"),
        status=data.get("status", "draft"),
        category=data.get("category"),
        notes=data.get("notes"),
    )
    db.session.add(invoice)
    db.session.commit()
    return jsonify(invoice.to_dict()), 201


@entities_bp.route("/clients/<client_id>/bills", methods=["GET"])
@require_auth
@require_client_access
def get_bills(client_id):
    query = (
        Bill.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Bill.bill_date.desc())
    )
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(Bill.bill_date >= start_date)
    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(Bill.bill_date <= end_date)

    bills = query.all()
    return jsonify([b.to_dict() for b in bills])


@entities_bp.route("/clients/<client_id>/invoices", methods=["GET"])
@require_auth
@require_client_access
def get_invoices(client_id):
    query = (
        Invoice.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Invoice.invoice_date.desc())
    )
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(Invoice.invoice_date >= start_date)
    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(Invoice.invoice_date <= end_date)

    invoices = query.all()
    return jsonify([i.to_dict() for i in invoices])


@entities_bp.route("/invoices/<invoice_id>", methods=["PATCH"])
@require_auth
def update_invoice(invoice_id):
    invoice = Invoice.query.get(uuid.UUID(invoice_id))
    if not invoice:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(invoice.client_id):
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json()
    for key in ("invoice_number", "invoice_date", "due_date", "subtotal",
                "tax_amount", "total", "currency", "status", "category", "notes"):
        if key in data:
            setattr(invoice, key, data[key])
    if "customer_id" in data:
        invoice.customer_id = uuid.UUID(data["customer_id"]) if data["customer_id"] else None
    db.session.commit()
    return jsonify(invoice.to_dict())


@entities_bp.route("/invoices/<invoice_id>", methods=["DELETE"])
@require_auth
def delete_invoice(invoice_id):
    invoice = Invoice.query.get(uuid.UUID(invoice_id))
    if not invoice:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(invoice.client_id):
        return jsonify({"error": "Access denied"}), 403
    db.session.delete(invoice)
    db.session.commit()
    return jsonify({"ok": True})


@entities_bp.route("/clients/<client_id>/accounts", methods=["GET"])
@require_auth
@require_client_access
def get_accounts(client_id):
    accounts = (
        Account.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Account.code)
        .all()
    )
    return jsonify([a.to_dict() for a in accounts])


@entities_bp.route("/clients/<client_id>/accounts", methods=["POST"])
@require_auth
@require_client_access
def create_account(client_id):
    data = request.get_json()
    account = Account(
        client_id=uuid.UUID(client_id),
        code=data.get("code", ""),
        name=data.get("name", ""),
        type=data.get("type", "Asset"),
        parent_id=uuid.UUID(data["parent_id"]) if data.get("parent_id") else None,
        is_active=data.get("is_active", True),
    )
    db.session.add(account)
    db.session.commit()
    return jsonify(account.to_dict()), 201


@entities_bp.route("/accounts/<account_id>", methods=["PATCH"])
@require_auth
def update_account(account_id):
    account = Account.query.get(uuid.UUID(account_id))
    if not account:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json()
    if "name" in data:
        account.name = data["name"]
    if "code" in data:
        account.code = data["code"]
    if "type" in data:
        account.type = data["type"]
    if "is_active" in data:
        account.is_active = data["is_active"]
    db.session.commit()
    return jsonify(account.to_dict())


@entities_bp.route("/accounts/<account_id>", methods=["DELETE"])
@require_auth
def delete_account(account_id):
    account = Account.query.get(uuid.UUID(account_id))
    if not account:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(account)
    db.session.commit()
    return jsonify({"ok": True})


@entities_bp.route("/clients/<client_id>/accounts/import-template", methods=["POST"])
@require_auth
@require_client_access
def import_account_template(client_id):
    """Import a standard Chart of Accounts template."""
    data = request.get_json()
    template = data.get("template", "uae")
    accounts_data = data.get("accounts", [])

    # If frontend sends pre-built accounts list
    created = []
    for a in accounts_data:
        existing = Account.query.filter_by(
            client_id=uuid.UUID(client_id), code=a.get("code", "")
        ).first()
        if existing:
            continue
        account = Account(
            client_id=uuid.UUID(client_id),
            code=a.get("code", ""),
            name=a.get("name", ""),
            type=a.get("type", "Asset"),
            is_active=True,
        )
        db.session.add(account)
        created.append(account)

    db.session.commit()
    return jsonify({"imported": len(created), "template": template}), 201


@entities_bp.route("/clients/<client_id>/connections", methods=["GET"])
@require_auth
@require_client_access
def get_connections(client_id):
    connections = (
        Connection.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Connection.created_at)
        .all()
    )
    return jsonify([c.to_dict() for c in connections])
