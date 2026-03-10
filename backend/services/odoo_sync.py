"""Odoo XML-RPC sync service — fetches data from Odoo and creates local records."""
import uuid
import xmlrpc.client
from datetime import date, datetime, timezone

from models.base import db
from models.tier1 import Connection
from models.tier2 import Vendor, Customer, Bill, Invoice


def get_odoo_rpc(conn: Connection):
    """Return (models_proxy, db_name, uid, auth_key) from stored connection."""
    config = conn.config or {}
    creds = conn.credentials or {}
    server_url = config.get("server_url")
    db_name = config.get("database")
    uid = config.get("uid")
    # Prefer api_key, fall back to password
    auth_key = creds.get("api_key") or creds.get("password")
    if not server_url or not db_name or not uid or not auth_key:
        raise ValueError("Incomplete connection credentials. Please reconnect.")
    models = xmlrpc.client.ServerProxy(
        f"{server_url}/xmlrpc/2/object", allow_none=True
    )
    return models, db_name, uid, auth_key


def _m2o_name(field_val):
    """Extract display name from Odoo Many2one field ([id, 'Name'] or False)."""
    if isinstance(field_val, (list, tuple)) and len(field_val) >= 2:
        return str(field_val[1])
    return None


def _m2o_id(field_val):
    """Extract integer id from Odoo Many2one field."""
    if isinstance(field_val, (list, tuple)) and len(field_val) >= 1:
        return int(field_val[0])
    return None


def _odoo_date(field_val):
    """Parse Odoo date field (string 'YYYY-MM-DD' or False) → date or None."""
    if not field_val:
        return None
    if isinstance(field_val, str):
        try:
            return date.fromisoformat(field_val[:10])
        except ValueError:
            return None
    return None


def _odoo_status(state, is_invoice=True):
    """Map Odoo account.move state → local status."""
    mapping_inv = {"draft": "draft", "posted": "sent", "cancel": "cancelled"}
    mapping_bill = {"draft": "draft", "posted": "open", "cancel": "cancelled"}
    m = mapping_inv if is_invoice else mapping_bill
    return m.get(state, "draft")


# ── Vendors ──────────────────────────────────────────────────────────────────

def sync_vendors(conn: Connection, client_id: uuid.UUID):
    """Import vendors (suppliers) from Odoo res.partner."""
    models, db_name, uid, auth_key = get_odoo_rpc(conn)

    partner_ids = models.execute_kw(
        db_name, uid, auth_key,
        'res.partner', 'search',
        [[('supplier_rank', '>', 0)]],
    )
    if not partner_ids:
        return {"fetched": 0, "created": 0, "updated": 0}

    partners = models.execute_kw(
        db_name, uid, auth_key,
        'res.partner', 'read',
        [partner_ids],
        {'fields': ['name', 'email', 'phone', 'vat']},
    )

    created = 0
    updated = 0
    for p in partners:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        source_ref = f"res.partner:{p['id']}"

        # Check by source_ref first (dedup for re-imports)
        existing = Vendor.query.filter_by(
            client_id=client_id, source_ref=source_ref
        ).first()
        if existing:
            existing.email = p.get("email") or existing.email
            existing.phone = p.get("phone") or existing.phone
            existing.trn = p.get("vat") or existing.trn
            updated += 1
            continue

        # Check by name (might exist from bank upload)
        existing_by_name = Vendor.query.filter_by(
            client_id=client_id, name=name
        ).first()
        if existing_by_name:
            existing_by_name.source = "odoo"
            existing_by_name.source_ref = source_ref
            existing_by_name.email = p.get("email") or existing_by_name.email
            existing_by_name.phone = p.get("phone") or existing_by_name.phone
            existing_by_name.trn = p.get("vat") or existing_by_name.trn
            updated += 1
            continue

        vendor = Vendor(
            client_id=client_id,
            name=name,
            email=p.get("email") or None,
            phone=p.get("phone") or None,
            trn=p.get("vat") or None,
            source="odoo",
            source_ref=source_ref,
        )
        db.session.add(vendor)
        created += 1

    db.session.commit()
    return {"fetched": len(partners), "created": created, "updated": updated}


# ── Customers ────────────────────────────────────────────────────────────────

def sync_customers(conn: Connection, client_id: uuid.UUID):
    """Import customers from Odoo res.partner."""
    models, db_name, uid, auth_key = get_odoo_rpc(conn)

    partner_ids = models.execute_kw(
        db_name, uid, auth_key,
        'res.partner', 'search',
        [[('customer_rank', '>', 0)]],
    )
    if not partner_ids:
        return {"fetched": 0, "created": 0, "updated": 0}

    partners = models.execute_kw(
        db_name, uid, auth_key,
        'res.partner', 'read',
        [partner_ids],
        {'fields': ['name', 'email', 'phone', 'vat']},
    )

    created = 0
    updated = 0
    for p in partners:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        source_ref = f"res.partner:{p['id']}"

        existing = Customer.query.filter_by(
            client_id=client_id, source_ref=source_ref
        ).first()
        if existing:
            existing.email = p.get("email") or existing.email
            existing.phone = p.get("phone") or existing.phone
            existing.trn = p.get("vat") or existing.trn
            updated += 1
            continue

        existing_by_name = Customer.query.filter_by(
            client_id=client_id, name=name
        ).first()
        if existing_by_name:
            existing_by_name.source = "odoo"
            existing_by_name.source_ref = source_ref
            existing_by_name.email = p.get("email") or existing_by_name.email
            existing_by_name.phone = p.get("phone") or existing_by_name.phone
            existing_by_name.trn = p.get("vat") or existing_by_name.trn
            updated += 1
            continue

        customer = Customer(
            client_id=client_id,
            name=name,
            email=p.get("email") or None,
            phone=p.get("phone") or None,
            trn=p.get("vat") or None,
            source="odoo",
            source_ref=source_ref,
        )
        db.session.add(customer)
        created += 1

    db.session.commit()
    return {"fetched": len(partners), "created": created, "updated": updated}


# ── Helper: resolve or create partner ────────────────────────────────────────

def _resolve_vendor(client_id, partner_name, partner_id_odoo):
    """Find or create a Vendor by name. Returns vendor.id or None."""
    if not partner_name:
        return None
    source_ref = f"res.partner:{partner_id_odoo}" if partner_id_odoo else None
    if source_ref:
        v = Vendor.query.filter_by(client_id=client_id, source_ref=source_ref).first()
        if v:
            return v.id
    v = Vendor.query.filter_by(client_id=client_id, name=partner_name).first()
    if v:
        if source_ref and not v.source_ref:
            v.source = "odoo"
            v.source_ref = source_ref
        return v.id
    vendor = Vendor(
        client_id=client_id, name=partner_name,
        source="odoo", source_ref=source_ref,
    )
    db.session.add(vendor)
    db.session.flush()
    return vendor.id


def _resolve_customer(client_id, partner_name, partner_id_odoo):
    """Find or create a Customer by name. Returns customer.id or None."""
    if not partner_name:
        return None
    source_ref = f"res.partner:{partner_id_odoo}" if partner_id_odoo else None
    if source_ref:
        c = Customer.query.filter_by(client_id=client_id, source_ref=source_ref).first()
        if c:
            return c.id
    c = Customer.query.filter_by(client_id=client_id, name=partner_name).first()
    if c:
        if source_ref and not c.source_ref:
            c.source = "odoo"
            c.source_ref = source_ref
        return c.id
    customer = Customer(
        client_id=client_id, name=partner_name,
        source="odoo", source_ref=source_ref,
    )
    db.session.add(customer)
    db.session.flush()
    return customer.id


# ── Invoices (Sales) ─────────────────────────────────────────────────────────

def sync_invoices(conn: Connection, client_id: uuid.UUID):
    """Import customer invoices from Odoo account.move."""
    models, db_name, uid, auth_key = get_odoo_rpc(conn)

    move_ids = models.execute_kw(
        db_name, uid, auth_key,
        'account.move', 'search',
        [[('move_type', '=', 'out_invoice')]],
    )
    if not move_ids:
        return {"fetched": 0, "created": 0, "updated": 0}

    moves = models.execute_kw(
        db_name, uid, auth_key,
        'account.move', 'read',
        [move_ids],
        {'fields': [
            'name', 'partner_id', 'invoice_date', 'invoice_date_due',
            'amount_total', 'amount_untaxed', 'amount_tax',
            'state', 'currency_id', 'ref',
        ]},
    )

    created = 0
    updated = 0
    for m in moves:
        source_ref = f"account.move:{m['id']}"

        existing = Invoice.query.filter_by(
            client_id=client_id, source="odoo", source_ref=source_ref
        ).first()
        if existing:
            # Update status and amounts
            existing.status = _odoo_status(m.get("state"), is_invoice=True)
            existing.total = float(m.get("amount_total") or 0)
            existing.subtotal = float(m.get("amount_untaxed") or 0)
            existing.tax_amount = float(m.get("amount_tax") or 0)
            updated += 1
            continue

        partner_name = _m2o_name(m.get("partner_id"))
        partner_odoo_id = _m2o_id(m.get("partner_id"))
        customer_id = _resolve_customer(client_id, partner_name, partner_odoo_id)

        inv_date = _odoo_date(m.get("invoice_date")) or date.today()
        due_date = _odoo_date(m.get("invoice_date_due"))
        currency = _m2o_name(m.get("currency_id")) or "AED"
        total = float(m.get("amount_total") or 0)
        subtotal = float(m.get("amount_untaxed") or 0)
        tax = float(m.get("amount_tax") or 0)

        invoice = Invoice(
            client_id=client_id,
            customer_id=customer_id,
            source="odoo",
            source_ref=source_ref,
            invoice_number=m.get("name") or None,
            invoice_date=inv_date,
            due_date=due_date,
            subtotal=subtotal,
            tax_amount=tax,
            total=total,
            currency=currency,
            status=_odoo_status(m.get("state"), is_invoice=True),
            notes=m.get("ref") or None,
            metadata_={"odoo_id": m["id"]},
        )
        db.session.add(invoice)
        created += 1

    db.session.commit()
    return {"fetched": len(moves), "created": created, "updated": updated}


# ── Bills (Purchases) ───────────────────────────────────────────────────────

def sync_bills(conn: Connection, client_id: uuid.UUID):
    """Import vendor bills from Odoo account.move."""
    models, db_name, uid, auth_key = get_odoo_rpc(conn)

    move_ids = models.execute_kw(
        db_name, uid, auth_key,
        'account.move', 'search',
        [[('move_type', '=', 'in_invoice')]],
    )
    if not move_ids:
        return {"fetched": 0, "created": 0, "updated": 0}

    moves = models.execute_kw(
        db_name, uid, auth_key,
        'account.move', 'read',
        [move_ids],
        {'fields': [
            'name', 'partner_id', 'invoice_date', 'invoice_date_due',
            'amount_total', 'amount_untaxed', 'amount_tax',
            'state', 'currency_id', 'ref',
        ]},
    )

    created = 0
    updated = 0
    for m in moves:
        source_ref = f"account.move:{m['id']}"

        existing = Bill.query.filter_by(
            client_id=client_id, source="odoo", source_ref=source_ref
        ).first()
        if existing:
            existing.status = _odoo_status(m.get("state"), is_invoice=False)
            existing.total = float(m.get("amount_total") or 0)
            existing.subtotal = float(m.get("amount_untaxed") or 0)
            existing.tax_amount = float(m.get("amount_tax") or 0)
            updated += 1
            continue

        partner_name = _m2o_name(m.get("partner_id"))
        partner_odoo_id = _m2o_id(m.get("partner_id"))
        vendor_id = _resolve_vendor(client_id, partner_name, partner_odoo_id)

        bill_date = _odoo_date(m.get("invoice_date")) or date.today()
        due_date = _odoo_date(m.get("invoice_date_due"))
        currency = _m2o_name(m.get("currency_id")) or "AED"
        total = float(m.get("amount_total") or 0)
        subtotal = float(m.get("amount_untaxed") or 0)
        tax = float(m.get("amount_tax") or 0)

        bill = Bill(
            client_id=client_id,
            vendor_id=vendor_id,
            source="odoo",
            source_ref=source_ref,
            bill_number=m.get("name") or None,
            bill_date=bill_date,
            due_date=due_date,
            subtotal=subtotal,
            tax_amount=tax,
            total=total,
            currency=currency,
            status=_odoo_status(m.get("state"), is_invoice=False),
            notes=m.get("ref") or None,
            metadata_={"odoo_id": m["id"]},
        )
        db.session.add(bill)
        created += 1

    db.session.commit()
    return {"fetched": len(moves), "created": created, "updated": updated}
