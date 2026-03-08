"""Transactions CRUD routes."""
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import require_client_access, user_has_client_access
from models.base import db
from models.tier1 import BankAccount, UploadedFile
from models.tier2 import Transaction, Vendor, Customer, Bill, Invoice
from models.tier4 import RiskAlert

transactions_bp = Blueprint("transactions", __name__, url_prefix="/api")


@transactions_bp.route("/clients/<client_id>/transactions", methods=["GET"])
@require_auth
@require_client_access
def get_transactions(client_id):
    query = (
        Transaction.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(Transaction.transaction_date.desc())
    )

    file_id = request.args.get("file_id")
    if file_id:
        query = query.filter_by(file_id=uuid.UUID(file_id))

    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)

    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)

    limit = request.args.get("limit", type=int)
    if limit:
        query = query.limit(limit)

    txns = query.all()
    return jsonify([t.to_dict() for t in txns])


@transactions_bp.route("/clients/<client_id>/transactions/date-range", methods=["GET"])
@require_auth
@require_client_access
def get_transaction_date_range(client_id):
    """Returns min and max dates across transactions, invoices, and bills."""
    from sqlalchemy import func as sqlfunc
    cid = uuid.UUID(client_id)

    # Query all three tables for their date ranges
    txn_result = db.session.query(
        sqlfunc.min(Transaction.transaction_date),
        sqlfunc.max(Transaction.transaction_date),
    ).filter_by(client_id=cid).first()

    inv_result = db.session.query(
        sqlfunc.min(Invoice.invoice_date),
        sqlfunc.max(Invoice.invoice_date),
    ).filter_by(client_id=cid).first()

    bill_result = db.session.query(
        sqlfunc.min(Bill.bill_date),
        sqlfunc.max(Bill.bill_date),
    ).filter_by(client_id=cid).first()

    # Collect all non-null min/max dates
    all_mins = []
    all_maxs = []
    for r in [txn_result, inv_result, bill_result]:
        if r and r[0]:
            val = r[0].isoformat() if hasattr(r[0], 'isoformat') else str(r[0])
            all_mins.append(val)
        if r and r[1]:
            val = r[1].isoformat() if hasattr(r[1], 'isoformat') else str(r[1])
            all_maxs.append(val)

    if all_mins and all_maxs:
        return jsonify({
            "min_date": min(all_mins),
            "max_date": max(all_maxs),
        })
    return jsonify({"min_date": None, "max_date": None})


@transactions_bp.route("/clients/<client_id>/transactions", methods=["POST"])
@require_auth
@require_client_access
def save_transactions(client_id):
    data = request.get_json()
    file_id = data.get("file_id")
    currency = data.get("currency", "AED")
    transactions = data.get("transactions", [])

    cid = uuid.UUID(client_id)
    fid = uuid.UUID(file_id) if file_id else None

    # Delete existing transactions for this file
    if fid:
        Transaction.query.filter_by(client_id=cid, file_id=fid).delete()

    rows = []
    for t in transactions:
        rows.append(Transaction(
            client_id=cid,
            file_id=fid,
            source=t.get("source", "bank_upload"),
            transaction_date=t.get("transaction_date"),
            description=t.get("description", ""),
            amount=t.get("amount", 0),
            currency=currency,
            category=t.get("category"),
            counterparty_name=t.get("counterparty_name"),
            is_transfer=t.get("is_transfer", False),
        ))

    db.session.bulk_save_objects(rows)
    db.session.commit()
    return jsonify({"ok": True, "count": len(rows)}), 201


@transactions_bp.route("/transactions/<transaction_id>", methods=["PATCH"])
@require_auth
def update_transaction(transaction_id):
    """Update a single transaction's category (and matching bill if any)."""
    from permissions import user_has_client_access
    txn = Transaction.query.get(uuid.UUID(transaction_id))
    if not txn:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(txn.client_id):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if "category" in data:
        txn.category = data["category"]
        # Also update matching bill by description + amount + date
        matching_bill = Bill.query.filter(
            Bill.client_id == txn.client_id,
            Bill.vendor_name == txn.counterparty_name,
            Bill.total == db.func.abs(txn.amount),
        ).first()
        if matching_bill:
            matching_bill.category = data["category"]

    db.session.commit()
    return jsonify(txn.to_dict())


@transactions_bp.route("/clients/<client_id>/transactions/sync-category", methods=["POST"])
@require_auth
@require_client_access
def sync_category(client_id):
    """Bulk update transactions + bills matching keywords to a new category."""
    data = request.get_json()
    category = data.get("category", "").strip()
    keywords = data.get("keywords", [])
    if not category or not keywords:
        return jsonify({"error": "category and keywords required"}), 400

    cid = uuid.UUID(client_id)
    txn_count = 0
    bill_count = 0

    for kw in keywords:
        pattern = f"%{kw}%"
        # Update transactions
        updated = (
            Transaction.query
            .filter(
                Transaction.client_id == cid,
                db.or_(
                    Transaction.description.ilike(pattern),
                    Transaction.counterparty_name.ilike(pattern),
                ),
            )
            .update({Transaction.category: category}, synchronize_session="fetch")
        )
        txn_count += updated

        # Update bills
        bill_updated = (
            Bill.query
            .filter(
                Bill.client_id == cid,
                db.or_(
                    Bill.vendor_name.ilike(pattern),
                    Bill.description.ilike(pattern),
                ),
            )
            .update({Bill.category: category}, synchronize_session="fetch")
        )
        bill_count += bill_updated

    db.session.commit()
    return jsonify({
        "ok": True,
        "transactions_updated": txn_count,
        "bills_updated": bill_count,
    })


@transactions_bp.route("/clients/<client_id>/sync", methods=["POST"])
@require_auth
@require_client_access
def sync_file_data(client_id):
    """Derive vendors, customers, bills, invoices, bank account, and risk alerts
    from raw transactions for a given file_id."""
    data = request.get_json()
    file_id = data.get("file_id")
    if not file_id:
        return jsonify({"error": "file_id is required"}), 400

    cid = uuid.UUID(client_id)
    fid = uuid.UUID(file_id)

    # Get the uploaded file info
    uploaded_file = UploadedFile.query.get(fid)
    if not uploaded_file:
        return jsonify({"error": "File not found"}), 404

    # Get all transactions for this file
    txns = Transaction.query.filter_by(client_id=cid, file_id=fid).all()
    if not txns:
        return jsonify({"error": "No transactions found for this file"}), 404

    currency = uploaded_file.currency or "AED"
    bank_name = uploaded_file.bank_name or "Bank Account"

    # ── 1. Auto-create bank account if none exists ────────────────────────
    bank_account_created = False
    existing_bank = BankAccount.query.filter_by(client_id=cid).first()
    if not existing_bank:
        total_balance = sum(float(t.amount) for t in txns)
        max_date = max(t.transaction_date for t in txns)
        bank_acct = BankAccount(
            client_id=cid,
            account_name=f"{bank_name} Account",
            bank_name=bank_name,
            currency=currency,
            current_balance=total_balance,
            last_statement_date=max_date,
            is_active=True,
        )
        db.session.add(bank_acct)
        db.session.flush()
        bank_account_created = True
    else:
        # Update balance from transactions
        total_balance = sum(float(t.amount) for t in txns)
        existing_bank.current_balance = (float(existing_bank.current_balance or 0)) + total_balance
        max_date = max(t.transaction_date for t in txns)
        if not existing_bank.last_statement_date or max_date > existing_bank.last_statement_date:
            existing_bank.last_statement_date = max_date

    # ── 2. Extract vendors from expense transactions ──────────────────────
    import re as _re
    _DATE_LIKE = _re.compile(
        r'^[\d]{1,4}[/\-.][\d]{1,2}[/\-.][\d]{2,4}'  # starts with date pattern
        r'|^[\d]{2}:[\d]{2}'                           # starts with time HH:MM
        r'|^[\d]{6,}$'                                  # pure digits (ref numbers)
    )

    def _is_valid_entity_name(name: str) -> bool:
        """Reject dates, timestamps, pure numbers, and very short strings."""
        if not name or len(name) < 3:
            return False
        if _DATE_LIKE.search(name):
            return False
        # Reject strings that are mostly digits/punctuation
        alpha_count = sum(1 for c in name if c.isalpha())
        if alpha_count < 2:
            return False
        return True

    expense_txns = [t for t in txns if float(t.amount) < 0 and not t.is_transfer]
    income_txns = [t for t in txns if float(t.amount) > 0 and not t.is_transfer]

    vendor_names = set()
    for t in expense_txns:
        name = (t.counterparty_name or t.description or "").strip()
        if _is_valid_entity_name(name):
            vendor_names.add(name)

    # Bulk insert vendors (skip duplicates)
    vendors_created = 0
    vendor_map = {}  # name -> vendor_id
    # First load existing vendors
    existing_vendors = Vendor.query.filter_by(client_id=cid).all()
    for v in existing_vendors:
        vendor_map[v.name.lower()] = v.id

    for name in vendor_names:
        if name.lower() not in vendor_map:
            vendor = Vendor(client_id=cid, name=name)
            db.session.add(vendor)
            db.session.flush()
            vendor_map[name.lower()] = vendor.id
            vendors_created += 1

    # ── 3. Extract customers from income transactions ─────────────────────
    customer_names = set()
    for t in income_txns:
        name = (t.counterparty_name or t.description or "").strip()
        if _is_valid_entity_name(name):
            customer_names.add(name)

    customers_created = 0
    customer_map = {}
    existing_customers = Customer.query.filter_by(client_id=cid).all()
    for c in existing_customers:
        customer_map[c.name.lower()] = c.id

    for name in customer_names:
        if name.lower() not in customer_map:
            customer = Customer(client_id=cid, name=name)
            db.session.add(customer)
            db.session.flush()
            customer_map[name.lower()] = customer.id
            customers_created += 1

    # ── 4. Check if bills/invoices already exist for this file ────────────
    existing_bills = Bill.query.filter_by(client_id=cid, source="bank_upload", source_ref=str(fid)).count()
    if existing_bills > 0:
        # Already synced — skip bill/invoice creation
        db.session.commit()
        return jsonify({
            "ok": True,
            "already_synced": True,
            "vendors_created": vendors_created,
            "customers_created": customers_created,
            "bank_account_created": bank_account_created,
        })

    # ── 5. Create bills from expense transactions ─────────────────────────
    bills_created = 0
    for t in expense_txns:
        amt = abs(float(t.amount))
        name = (t.counterparty_name or t.description or "").strip()
        vid = vendor_map.get(name.lower()) if name else None
        subtotal = round(amt / 1.05, 2)
        tax = round(amt - subtotal, 2)

        bill = Bill(
            client_id=cid,
            vendor_id=vid,
            source="bank_upload",
            source_ref=str(fid),
            bill_date=t.transaction_date,
            due_date=t.transaction_date,
            subtotal=subtotal,
            tax_amount=tax,
            total=amt,
            currency=currency,
            status="paid",
            category=t.category,
            notes=t.description,
        )
        db.session.add(bill)
        bills_created += 1

    # ── 6. Create invoices from income transactions ───────────────────────
    invoices_created = 0
    for t in income_txns:
        amt = float(t.amount)
        name = (t.counterparty_name or t.description or "").strip()
        cust_id = customer_map.get(name.lower()) if name else None
        subtotal = round(amt / 1.05, 2)
        tax = round(amt - subtotal, 2)

        invoice = Invoice(
            client_id=cid,
            customer_id=cust_id,
            source="bank_upload",
            source_ref=str(fid),
            invoice_date=t.transaction_date,
            due_date=t.transaction_date,
            subtotal=subtotal,
            tax_amount=tax,
            total=amt,
            currency=currency,
            status="paid",
            category=t.category,
            notes=t.description,
        )
        db.session.add(invoice)
        invoices_created += 1

    # ── 7. Auto-generate risk alerts ──────────────────────────────────────
    alerts_created = 0
    for t in txns:
        amt = abs(float(t.amount))
        # Large transaction (> 10,000)
        if amt > 10000:
            alert = RiskAlert(
                client_id=cid,
                alert_type="large_transaction",
                severity="high" if amt > 50000 else "medium",
                title=f"Large transaction: {currency} {amt:,.2f}",
                description=t.description,
                entity_type="transaction",
                entity_id=str(t.id),
                amount=amt,
                status="open",
            )
            db.session.add(alert)
            alerts_created += 1

        # Round amount (>= 5,000 and divisible by 1,000)
        if amt >= 5000 and amt % 1000 == 0:
            alert = RiskAlert(
                client_id=cid,
                alert_type="round_amount",
                severity="low",
                title=f"Round amount: {currency} {amt:,.0f}",
                description=t.description,
                entity_type="transaction",
                entity_id=str(t.id),
                amount=amt,
                status="open",
            )
            db.session.add(alert)
            alerts_created += 1

        # Weekend transaction
        if t.transaction_date and t.transaction_date.weekday() >= 5:
            alert = RiskAlert(
                client_id=cid,
                alert_type="weekend_transaction",
                severity="low",
                title=f"Weekend transaction: {currency} {amt:,.2f}",
                description=f"{t.description} on {t.transaction_date.strftime('%A')}",
                entity_type="transaction",
                entity_id=str(t.id),
                amount=amt,
                status="open",
            )
            db.session.add(alert)
            alerts_created += 1

    db.session.commit()
    return jsonify({
        "ok": True,
        "vendors_created": vendors_created,
        "customers_created": customers_created,
        "bills_created": bills_created,
        "invoices_created": invoices_created,
        "bank_account_created": bank_account_created,
        "alerts_created": alerts_created,
    }), 201


@transactions_bp.route("/admin/sync/<client_id>/<file_id>", methods=["POST"])
def admin_sync(client_id, file_id):
    """One-time admin sync — no auth required. Remove after first use."""
    cid = uuid.UUID(client_id)
    fid = uuid.UUID(file_id)

    uploaded_file = UploadedFile.query.get(fid)
    if not uploaded_file:
        return jsonify({"error": "File not found"}), 404

    txns = Transaction.query.filter_by(client_id=cid, file_id=fid).all()
    if not txns:
        return jsonify({"error": "No transactions"}), 404

    currency = uploaded_file.currency or "AED"
    bank_name = uploaded_file.bank_name or "Bank Account"

    # Bank account
    existing_bank = BankAccount.query.filter_by(client_id=cid).first()
    if not existing_bank:
        total_balance = sum(float(t.amount) for t in txns)
        max_date = max(t.transaction_date for t in txns)
        bank_acct = BankAccount(
            client_id=cid, account_name=f"{bank_name} Account",
            bank_name=bank_name, currency=currency,
            current_balance=total_balance, last_statement_date=max_date, is_active=True,
        )
        db.session.add(bank_acct)

    expense_txns = [t for t in txns if float(t.amount) < 0 and not t.is_transfer]
    income_txns = [t for t in txns if float(t.amount) > 0 and not t.is_transfer]

    # Vendors
    vendor_map = {}
    for v in Vendor.query.filter_by(client_id=cid).all():
        vendor_map[v.name.lower()] = v.id
    for t in expense_txns:
        name = (t.counterparty_name or t.description or "").strip()
        if _is_valid_entity_name(name) and name.lower() not in vendor_map:
            vendor = Vendor(client_id=cid, name=name)
            db.session.add(vendor)
            db.session.flush()
            vendor_map[name.lower()] = vendor.id

    # Customers
    customer_map = {}
    for c in Customer.query.filter_by(client_id=cid).all():
        customer_map[c.name.lower()] = c.id
    for t in income_txns:
        name = (t.counterparty_name or t.description or "").strip()
        if _is_valid_entity_name(name) and name.lower() not in customer_map:
            customer = Customer(client_id=cid, name=name)
            db.session.add(customer)
            db.session.flush()
            customer_map[name.lower()] = customer.id

    # Check already synced
    existing_bills = Bill.query.filter_by(client_id=cid, source="bank_upload", source_ref=str(fid)).count()
    if existing_bills > 0:
        db.session.commit()
        return jsonify({"ok": True, "already_synced": True})

    # Bills
    bills_created = 0
    for t in expense_txns:
        amt = abs(float(t.amount))
        name = (t.counterparty_name or t.description or "").strip()
        vid = vendor_map.get(name.lower()) if name else None
        subtotal = round(amt / 1.05, 2)
        tax = round(amt - subtotal, 2)
        db.session.add(Bill(
            client_id=cid, vendor_id=vid, source="bank_upload", source_ref=str(fid),
            bill_date=t.transaction_date, due_date=t.transaction_date,
            subtotal=subtotal, tax_amount=tax, total=amt,
            currency=currency, status="paid", category=t.category, notes=t.description,
        ))
        bills_created += 1

    # Invoices
    invoices_created = 0
    for t in income_txns:
        amt = float(t.amount)
        name = (t.counterparty_name or t.description or "").strip()
        cust_id = customer_map.get(name.lower()) if name else None
        subtotal = round(amt / 1.05, 2)
        tax = round(amt - subtotal, 2)
        db.session.add(Invoice(
            client_id=cid, customer_id=cust_id, source="bank_upload", source_ref=str(fid),
            invoice_date=t.transaction_date, due_date=t.transaction_date,
            subtotal=subtotal, tax_amount=tax, total=amt,
            currency=currency, status="paid", category=t.category, notes=t.description,
        ))
        invoices_created += 1

    # Risk alerts
    alerts_created = 0
    for t in txns:
        amt = abs(float(t.amount))
        if amt > 10000:
            db.session.add(RiskAlert(
                client_id=cid, alert_type="large_transaction",
                severity="high" if amt > 50000 else "medium",
                title=f"Large transaction: {currency} {amt:,.2f}",
                description=t.description, entity_type="transaction",
                entity_id=str(t.id), amount=amt, status="open",
            ))
            alerts_created += 1
        if amt >= 5000 and amt % 1000 == 0:
            db.session.add(RiskAlert(
                client_id=cid, alert_type="round_amount", severity="low",
                title=f"Round amount: {currency} {amt:,.0f}",
                description=t.description, entity_type="transaction",
                entity_id=str(t.id), amount=amt, status="open",
            ))
            alerts_created += 1

    db.session.commit()
    return jsonify({
        "ok": True, "bills_created": bills_created,
        "invoices_created": invoices_created, "alerts_created": alerts_created,
    }), 201
