"""Vendors, Customers, Bills, Invoices, Accounts, Connections routes."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from auth import require_auth
from permissions import require_client_access, user_has_client_access
from models.base import db
from models.tier1 import Connection, SyncRun
from models.tier2 import Vendor, Customer, Bill, Invoice, Account

entities_bp = Blueprint("entities", __name__, url_prefix="/api")


@entities_bp.route("/clients/<client_id>/vendors", methods=["GET"])
@require_auth
@require_client_access
def get_vendors(client_id):
    query = Vendor.query.filter_by(client_id=uuid.UUID(client_id))
    source = request.args.get("source")
    if source:
        query = query.filter_by(source=source)
    vendors = query.order_by(Vendor.name).all()
    return jsonify([v.to_dict() for v in vendors])


@entities_bp.route("/clients/<client_id>/customers", methods=["GET"])
@require_auth
@require_client_access
def get_customers(client_id):
    query = Customer.query.filter_by(client_id=uuid.UUID(client_id))
    source = request.args.get("source")
    if source:
        query = query.filter_by(source=source)
    customers = query.order_by(Customer.name).all()
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
    cid = uuid.UUID(client_id)
    total = float(data.get("total", 0))
    subtotal = float(data.get("subtotal", round(total / 1.05, 2)))
    tax_amount = float(data.get("tax_amount", round(total - subtotal, 2)))

    # Resolve customer: accept customer_id OR customer_name
    customer_id = None
    if data.get("customer_id"):
        customer_id = uuid.UUID(data["customer_id"])
    elif data.get("customer_name"):
        name = data["customer_name"].strip()
        cust = Customer.query.filter_by(client_id=cid, name=name).first()
        if not cust:
            cust = Customer(client_id=cid, name=name)
            db.session.add(cust)
            db.session.flush()
        customer_id = cust.id

    invoice = Invoice(
        client_id=cid,
        customer_id=customer_id,
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
        description=data.get("description"),
        line_items=data.get("line_items"),
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
    source = request.args.get("source")
    if source:
        query = query.filter_by(source=source)
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
    source = request.args.get("source")
    if source:
        query = query.filter_by(source=source)
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
                "tax_amount", "total", "currency", "status", "category", "notes",
                "description", "line_items"):
        if key in data:
            setattr(invoice, key, data[key])
    if "customer_id" in data:
        invoice.customer_id = uuid.UUID(data["customer_id"]) if data["customer_id"] else None
    elif "customer_name" in data and data["customer_name"]:
        name = data["customer_name"].strip()
        cust = Customer.query.filter_by(client_id=invoice.client_id, name=name).first()
        if not cust:
            cust = Customer(client_id=invoice.client_id, name=name)
            db.session.add(cust)
            db.session.flush()
        invoice.customer_id = cust.id
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


@entities_bp.route("/clients/<client_id>/connections", methods=["POST"])
@require_auth
@require_client_access
def create_connection(client_id):
    """Create/connect an integration (Odoo, QuickBooks, etc.)."""
    import requests as http_requests

    data = request.get_json()
    integration_type = data.get("integration_type", "odoo")
    creds = data.get("credentials", {})

    server_url = (creds.get("server_url") or "").strip()
    database_name = (creds.get("database") or "").strip()
    username = (creds.get("username") or "").strip()
    password = (creds.get("password") or "").strip()
    api_key = (creds.get("api_key") or "").strip()

    if not server_url:
        return jsonify({"error": "Server URL is required"}), 400
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400

    # Clean URL
    clean_url = server_url.rstrip("/")
    for suffix in ("/web", "/odoo", "/web/login"):
        if clean_url.lower().endswith(suffix):
            clean_url = clean_url[: -len(suffix)]
    if not clean_url.startswith("http"):
        clean_url = "https://" + clean_url

    # Auto-detect database from URL if not provided
    if not database_name:
        import re
        m = re.match(r"https?://([a-zA-Z0-9_-]+)\.odoo\.com", clean_url, re.IGNORECASE)
        if m:
            database_name = m.group(1)
    if not database_name:
        return jsonify({"error": "Database name is required"}), 400

    uid = None
    auth_method = ""

    # Strategy 1: Session-based auth (works on all Odoo plans)
    try:
        resp = http_requests.post(
            f"{clean_url}/web/session/authenticate",
            json={"jsonrpc": "2.0", "params": {"db": database_name, "login": username, "password": password}},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        if resp.status_code == 200:
            result = resp.json().get("result", {})
            if result.get("uid"):
                uid = result["uid"]
                auth_method = "session"
    except http_requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot reach server. Check the Server URL."}), 400
    except http_requests.exceptions.Timeout:
        return jsonify({"error": "Server did not respond (timeout). Check the URL."}), 400
    except Exception:
        pass

    # Strategy 2: XML-RPC with API key
    if not uid and api_key:
        try:
            import xmlrpc.client
            common = xmlrpc.client.ServerProxy(f"{clean_url}/xmlrpc/2/common", allow_none=True)
            uid = common.authenticate(database_name, username, api_key, {})
            if uid:
                auth_method = "xmlrpc"
        except Exception:
            pass

    if not uid:
        return jsonify({"error": "Authentication failed. Please check your credentials (username, password, database name)."}), 401

    # Upsert connection
    cid = uuid.UUID(client_id)
    existing = Connection.query.filter_by(client_id=cid, provider=integration_type).first()
    if existing:
        existing.status = "connected"
        existing.config = {
            "server_url": clean_url,
            "database": database_name,
            "username": username,
            "uid": uid,
            "auth_method": auth_method,
        }
        existing.credentials = {"api_key": api_key, "password": password}
        existing.last_error = None
        existing.updated_at = datetime.now(timezone.utc)
        conn = existing
    else:
        conn = Connection(
            client_id=cid,
            type="erp",
            provider=integration_type,
            display_name=f"Odoo ({database_name})",
            status="connected",
            config={
                "server_url": clean_url,
                "database": database_name,
                "username": username,
                "uid": uid,
                "auth_method": auth_method,
            },
            credentials={"api_key": api_key, "password": password},
        )
        db.session.add(conn)

    db.session.commit()
    return jsonify(conn.to_dict()), 201


@entities_bp.route("/clients/<client_id>/connections/<conn_id>", methods=["DELETE"])
@require_auth
@require_client_access
def delete_connection(client_id, conn_id):
    """Disconnect/delete an integration."""
    conn = Connection.query.get_or_404(uuid.UUID(conn_id))
    db.session.delete(conn)
    db.session.commit()
    return jsonify({"ok": True})


@entities_bp.route("/clients/<client_id>/connections/<conn_id>/sync", methods=["POST"])
@require_auth
@require_client_access
def sync_connection(client_id, conn_id):
    """Sync data from an external integration (Odoo, etc.)."""
    conn = Connection.query.get_or_404(uuid.UUID(conn_id))
    if conn.status != "connected":
        return jsonify({"error": "Connection is not active"}), 400

    data = request.get_json()
    entity_type = data.get("entity_type", "all")
    direction = data.get("direction", "import")

    if direction == "export":
        return jsonify({"suggestion": "Export is not yet supported. Use import to bring data from your ERP."}), 200

    # Create SyncRun for tracking
    cid = uuid.UUID(client_id)
    sync_run = SyncRun(
        connection_id=conn.id,
        client_id=cid,
        status="running",
    )
    db.session.add(sync_run)
    db.session.commit()

    try:
        from services.odoo_sync import sync_customers, sync_vendors, sync_invoices, sync_bills

        handlers = {
            "customers": sync_customers,
            "vendors": sync_vendors,
            "invoices": sync_invoices,
            "bills": sync_bills,
        }

        handler = handlers.get(entity_type)
        if not handler:
            sync_run.status = "completed"
            sync_run.completed_at = datetime.now(timezone.utc)
            db.session.commit()
            return jsonify({"suggestion": f"Import for '{entity_type}' is not yet supported. Try customers, vendors, invoices, or bills."}), 200

        result = handler(conn, cid)

        sync_run.status = "completed"
        sync_run.records_fetched = result["fetched"]
        sync_run.records_created = result["created"]
        sync_run.records_updated = result["updated"]
        sync_run.completed_at = datetime.now(timezone.utc)

        conn.last_sync_at = datetime.now(timezone.utc)
        conn.last_error = None
        db.session.commit()

        mapped = result["created"] + result["updated"]

        # If nothing found, check if the OTHER type has data and hint
        suggestion = None
        if mapped == 0 and result["fetched"] == 0:
            from services.odoo_sync import _fetch_odoo_data
            hint_map = {
                "invoices": ("bills (vendor purchases)", [("move_type", "=", "in_invoice")]),
                "bills": ("invoices (customer sales)", [("move_type", "=", "out_invoice")]),
            }
            if entity_type in hint_map:
                label, domain = hint_map[entity_type]
                try:
                    alt = _fetch_odoo_data(conn, "account.move", domain, ["id"])
                    if alt:
                        suggestion = f"No {entity_type} found in your Odoo, but {len(alt)} {label} exist. Try importing those instead."
                except Exception:
                    pass

        resp = {
            "ok": True,
            "mapped": mapped,
            "created": result["created"],
            "updated": result["updated"],
            "fetched": result["fetched"],
        }
        if suggestion:
            resp["suggestion"] = suggestion
        return jsonify(resp)

    except Exception as e:
        sync_run.status = "failed"
        sync_run.error_log = [str(e)]
        sync_run.completed_at = datetime.now(timezone.utc)
        conn.last_error = str(e)
        db.session.commit()
        return jsonify({"error": f"Sync failed: {str(e)}"}), 500
