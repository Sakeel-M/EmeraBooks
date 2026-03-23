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
    cid = uuid.UUID(client_id)
    total = float(data.get("total", 0))
    subtotal = float(data.get("subtotal", round(total / 1.05, 2)))
    tax_amount = float(data.get("tax_amount", round(total - subtotal, 2)))

    # Resolve vendor: accept vendor_id OR vendor_name
    vendor_id = None
    if data.get("vendor_id"):
        vendor_id = uuid.UUID(data["vendor_id"])
    elif data.get("vendor_name"):
        name = data["vendor_name"].strip()
        v = Vendor.query.filter_by(client_id=cid, name=name).first()
        if not v:
            v = Vendor(client_id=cid, name=name)
            db.session.add(v)
            db.session.flush()
        vendor_id = v.id

    bill = Bill(
        client_id=cid,
        vendor_id=vendor_id,
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
    elif "vendor_name" in data and data["vendor_name"]:
        name = data["vendor_name"].strip()
        v = Vendor.query.filter_by(client_id=bill.client_id, name=name).first()
        if not v:
            v = Vendor(client_id=bill.client_id, name=name)
            db.session.add(v)
            db.session.flush()
        bill.vendor_id = v.id
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


@entities_bp.route("/clients/<client_id>/accounts/bulk-delete", methods=["POST"])
@require_auth
@require_client_access
def bulk_delete_accounts(client_id):
    """Delete multiple accounts by IDs."""
    data = request.get_json()
    ids = data.get("ids", [])
    if not ids:
        return jsonify({"error": "No account IDs provided"}), 400
    cid = uuid.UUID(client_id)
    deleted = 0
    for aid in ids:
        try:
            account = Account.query.filter_by(id=uuid.UUID(aid), client_id=cid).first()
            if account:
                db.session.delete(account)
                deleted += 1
        except Exception:
            continue
    db.session.commit()
    return jsonify({"deleted": deleted})


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


@entities_bp.route("/clients/<client_id>/accounts/import-document", methods=["POST"])
@require_auth
@require_client_access
def import_account_document(client_id):
    """Parse an IFRS/CoA document (PDF, Excel, CSV) and extract accounts."""
    import io, json, re, os

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    ext = file.filename.lower().rsplit(".", 1)[-1] if "." in file.filename else ""
    if ext not in ("pdf", "xlsx", "xls", "csv", "txt"):
        return jsonify({"error": "Unsupported format. Upload PDF, Excel, CSV, or TXT."}), 400

    cid = uuid.UUID(client_id)
    file_bytes = file.read()
    text = ""

    # ── Extract text based on file type ──
    try:
        if ext == "pdf":
            import pdfplumber
            pdf = pdfplumber.open(io.BytesIO(file_bytes))
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            pdf.close()

        elif ext in ("xlsx", "xls"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            for ws in wb.worksheets:
                for row in ws.iter_rows(values_only=True):
                    vals = [str(c) if c is not None else "" for c in row]
                    text += "\t".join(vals) + "\n"
            wb.close()

        elif ext == "csv":
            text = file_bytes.decode("utf-8", errors="replace")

        elif ext == "txt":
            text = file_bytes.decode("utf-8", errors="replace")

    except Exception as e:
        return jsonify({"error": f"Failed to read file: {str(e)}"}), 400

    if not text.strip():
        return jsonify({"error": "Could not extract text from file. File may be empty or image-based."}), 400

    # ── Priority 1: Structured CSV/TSV parsing (code,name,type per line) ──
    accounts_data = []
    csv_pattern = re.compile(
        r'^(\d{3,6})\s*[,\t]\s*(.+?)\s*[,\t]\s*(Asset|Liability|Equity|Revenue|Expense)\s*$', re.I
    )
    for line in text.split("\n"):
        m = csv_pattern.match(line.strip())
        if m:
            accounts_data.append({
                "code": m.group(1),
                "name": m.group(2).strip(),
                "type": m.group(3).strip().capitalize(),
            })
    if accounts_data:
        print(f"[CoA Import] CSV parsing: found {len(accounts_data)} accounts")

    # ── Priority 2: AI extraction (for unstructured documents) ──
    openai_key = os.getenv("OPENAI_API_KEY")

    if not accounts_data and openai_key:
        try:
            import openai
            openai.api_key = openai_key

            prompt = f"""You are an expert accountant. Extract ALL accounting accounts from this IFRS / Chart of Accounts document.

DOCUMENT TEXT:
{text[:12000]}

INSTRUCTIONS:
1. Extract every account mentioned — account code (if present) and account name
2. Classify each account as one of: Asset, Liability, Equity, Revenue, Expense
3. If no account codes exist, generate sequential codes: Assets=1xxx, Liabilities=2xxx, Equity=3xxx, Revenue=4xxx, Expenses=5xxx
4. Include ALL sub-accounts and line items — do not skip any
5. If the document mentions terms like "Sales Revenue", "Cost of Sales", "Trade Receivables", etc., include them as separate accounts
6. For IFRS standards documents, extract the standard account categories they define

OUTPUT FORMAT (JSON array only, no markdown):
[
  {{"code": "1000", "name": "Cash and Cash Equivalents", "type": "Asset"}},
  {{"code": "1100", "name": "Trade Receivables", "type": "Asset"}},
  {{"code": "4000", "name": "Sales Revenue", "type": "Revenue"}}
]

Return ONLY the JSON array. No explanation."""

            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a financial data extraction expert. Return ONLY valid JSON arrays."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=4000,
                temperature=0.1,
            )

            ai_text = response.choices[0].message.content.strip()
            if "```json" in ai_text:
                ai_text = ai_text.split("```json")[1].split("```")[0].strip()
            elif "```" in ai_text:
                ai_text = ai_text.replace("```", "").strip()

            accounts_data = json.loads(ai_text)
            print(f"[CoA Import] AI extracted {len(accounts_data)} accounts")

        except Exception as e:
            print(f"[CoA Import] AI extraction failed: {e}")

    # ── Fallback: regex-based extraction ──
    if not accounts_data:
        print("[CoA Import] Using regex fallback...")
        current_type = "Asset"
        code_counter = {"Asset": 1000, "Liability": 2000, "Equity": 3000, "Revenue": 4000, "Expense": 5000}

        type_patterns = {
            "Asset": re.compile(r"(?:ASSETS?|CURRENT\s+ASSETS?|NON.CURRENT\s+ASSETS?)", re.I),
            "Liability": re.compile(r"(?:LIABILIT|CURRENT\s+LIABILIT|NON.CURRENT\s+LIABILIT|PAYABLE)", re.I),
            "Equity": re.compile(r"(?:EQUITY|SHAREHOLDER|CAPITAL|RETAINED)", re.I),
            "Revenue": re.compile(r"(?:REVENUE|INCOME|SALES)", re.I),
            "Expense": re.compile(r"(?:EXPENSE|COST\s+OF|OPERATING\s+EXPENSE|ADMIN)", re.I),
        }

        # Pattern: optional code + account name
        line_pattern = re.compile(r"^(\d{3,6})?\s*[.\-)]?\s*(.{5,80})\s*$")

        for line in text.split("\n"):
            line = line.strip()
            if not line or len(line) < 3:
                continue

            # Detect section type headers
            for acct_type, pat in type_patterns.items():
                if pat.search(line) and len(line) < 60:
                    current_type = acct_type
                    break

            # Try to extract account line
            m = line_pattern.match(line)
            if m:
                code = m.group(1)
                name = m.group(2).strip()
                # Skip if name is a header or too generic
                if any(kw in name.upper() for kw in ["TOTAL", "NOTE", "PAGE", "DATE", "PERIOD", "COMPANY"]):
                    continue
                if not code:
                    code = str(code_counter[current_type])
                    code_counter[current_type] += 10
                accounts_data.append({"code": code, "name": name, "type": current_type})

    if not accounts_data:
        return jsonify({"error": "Could not extract any accounts from the document. Please check the file content."}), 400

    # ── Create accounts (dedup by code) ──
    created = []
    skipped = 0
    for a in accounts_data:
        code = str(a.get("code", "")).strip()
        name = (a.get("name") or "").strip()
        acct_type = a.get("type", "Asset")
        if acct_type not in ("Asset", "Liability", "Equity", "Revenue", "Expense"):
            acct_type = "Asset"
        if not name:
            continue

        existing = Account.query.filter_by(client_id=cid, code=code).first()
        if existing:
            skipped += 1
            continue

        account = Account(client_id=cid, code=code, name=name, type=acct_type, is_active=True)
        db.session.add(account)
        created.append(account)

    db.session.commit()

    return jsonify({
        "imported": len(created),
        "skipped": skipped,
        "total_found": len(accounts_data),
        "accounts": [{"code": a.code, "name": a.name, "type": a.type} for a in created],
    }), 201


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
