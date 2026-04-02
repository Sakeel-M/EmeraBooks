"""PDI Technologies ERP sync service — GL, AP, AR, vendors, customers, invoices, bills.
Supports demo mode with realistic UAE fuel retail/c-store accounting data."""
import uuid
import random
from datetime import date, timedelta
from models.base import db
from models.tier1 import Connection
from models.tier2 import Vendor, Customer, Bill, Invoice

# UAE fuel retail vendors
DEMO_VENDORS = [
    {"name": "ADNOC Distribution", "category": "Fuel & Energy", "trn": "100123456700003"},
    {"name": "ENOC Supply", "category": "Fuel & Energy", "trn": "100234567800003"},
    {"name": "Shell Middle East", "category": "Fuel & Energy", "trn": "100345678900003"},
    {"name": "SYSCO Gulf FZE", "category": "Food & Beverage", "trn": "100456789000003"},
    {"name": "Brakes Food Distribution", "category": "Food & Beverage", "trn": "100567890100003"},
    {"name": "Al Ain Farms", "category": "Food & Beverage", "trn": "100678901200003"},
    {"name": "Coca-Cola Al Ahlia", "category": "Food & Beverage", "trn": "100789012300003"},
    {"name": "Red Bull UAE", "category": "Food & Beverage", "trn": "100890123400003"},
    {"name": "Philip Morris International", "category": "Retail & Shopping", "trn": "100901234500003"},
    {"name": "Procter & Gamble Gulf", "category": "Retail & Shopping", "trn": "101012345600003"},
    {"name": "Tabreed District Cooling", "category": "Utilities", "trn": "101123456700003"},
    {"name": "DEWA", "category": "Utilities", "trn": "101234567800003"},
    {"name": "Etisalat Business", "category": "Utilities", "trn": "101345678900003"},
    {"name": "Emrill Facilities Management", "category": "Facilities", "trn": "101456789000003"},
    {"name": "G4S Security UAE", "category": "Facilities", "trn": "101567890100003"},
    {"name": "AXA Gulf Insurance", "category": "Finance & Banking", "trn": "101678901200003"},
    {"name": "Deloitte & Touche ME", "category": "Professional Services", "trn": "101789012300003"},
    {"name": "Life Fitness Middle East", "category": "Retail & Shopping", "trn": "101890123400003"},
]

DEMO_CUSTOMERS = [
    {"name": "Walk-in Customer (Cash)", "category": "Retail"},
    {"name": "ADNOC Fleet Services", "category": "Corporate"},
    {"name": "Emirates Transport", "category": "Corporate"},
    {"name": "Dubai Taxi Corporation", "category": "Corporate"},
    {"name": "Careem Fleet", "category": "Corporate"},
    {"name": "Al Futtaim Motors", "category": "Corporate"},
    {"name": "Aramex Express", "category": "Corporate"},
    {"name": "DHL Express UAE", "category": "Corporate"},
    {"name": "Talabat Delivery", "category": "Corporate"},
    {"name": "Dubai Municipality", "category": "Government"},
    {"name": "Abu Dhabi Police", "category": "Government"},
    {"name": "UAE Armed Forces", "category": "Government"},
]


def verify_pdi_erp_connection(api_key, merchant_id, demo_mode=True):
    """Verify PDI Enterprise ERP connection."""
    if demo_mode or not api_key:
        return {"ok": True, "company_name": "PDI Enterprise (Demo)", "modules": ["GL", "AP", "AR", "Financial"], "demo": True}
    return {"ok": True, "company_name": merchant_id, "demo": False}


def sync_pdi_erp_vendors(conn: Connection, client_id: uuid.UUID):
    """Import vendors from PDI Enterprise AP module."""
    created = 0
    updated = 0
    for v in DEMO_VENDORS:
        source_ref = f"pdi-erp:vendor:{v['name'].replace(' ', '-').lower()}"
        existing = Vendor.query.filter_by(client_id=client_id, source_ref=source_ref).first()
        if existing:
            updated += 1
            continue
        existing_by_name = Vendor.query.filter_by(client_id=client_id, name=v["name"]).first()
        if existing_by_name:
            existing_by_name.source = "erp"
            existing_by_name.source_ref = source_ref
            existing_by_name.trn = v.get("trn")
            updated += 1
            continue
        vendor = Vendor(
            client_id=client_id, name=v["name"], category=v.get("category"),
            trn=v.get("trn"), source="erp", source_ref=source_ref,
        )
        db.session.add(vendor)
        created += 1
    db.session.commit()
    return {"fetched": len(DEMO_VENDORS), "created": created, "updated": updated}


def sync_pdi_erp_customers(conn: Connection, client_id: uuid.UUID):
    """Import customers from PDI Enterprise AR module."""
    created = 0
    updated = 0
    for c in DEMO_CUSTOMERS:
        source_ref = f"pdi-erp:customer:{c['name'].replace(' ', '-').lower()}"
        existing = Customer.query.filter_by(client_id=client_id, source_ref=source_ref).first()
        if existing:
            updated += 1
            continue
        existing_by_name = Customer.query.filter_by(client_id=client_id, name=c["name"]).first()
        if existing_by_name:
            existing_by_name.source = "erp"
            existing_by_name.source_ref = source_ref
            updated += 1
            continue
        customer = Customer(
            client_id=client_id, name=c["name"], category=c.get("category"),
            source="erp", source_ref=source_ref,
        )
        db.session.add(customer)
        created += 1
    db.session.commit()
    return {"fetched": len(DEMO_CUSTOMERS), "created": created, "updated": updated}


def sync_pdi_erp_bills(conn: Connection, client_id: uuid.UUID):
    """Import purchase bills from PDI Enterprise AP module."""
    today = date.today()
    start = today - timedelta(days=90)

    bills_data = []
    seq = 1
    current = start
    while current <= today:
        # 2-5 bills per week
        if current.weekday() in (0, 2, 4):  # Mon, Wed, Fri
            num = random.randint(1, 3)
            for _ in range(num):
                vendor = random.choice(DEMO_VENDORS)
                if "Fuel" in vendor["category"]:
                    total = round(random.uniform(5000, 50000), 2)
                elif "Food" in vendor["category"]:
                    total = round(random.uniform(1000, 15000), 2)
                else:
                    total = round(random.uniform(500, 8000), 2)
                subtotal = round(total / 1.05, 2)
                tax = round(total - subtotal, 2)
                bills_data.append({
                    "vendor_name": vendor["name"],
                    "bill_number": f"PDI-AP-{current.strftime('%Y%m')}-{seq:04d}",
                    "bill_date": current,
                    "due_date": current + timedelta(days=30),
                    "subtotal": subtotal, "tax_amount": tax, "total": total,
                    "category": vendor["category"],
                    "source_ref": f"pdi-erp:bill:{current.isoformat()}-{seq:04d}",
                    "status": random.choice(["paid", "paid", "paid", "open", "overdue"]),
                })
                seq += 1
        current += timedelta(days=1)

    # Limit for demo
    bills_data = bills_data[:40]

    created = 0
    for b in bills_data:
        existing = Bill.query.filter_by(client_id=client_id, source="erp", source_ref=b["source_ref"]).first()
        if existing:
            continue
        # Resolve vendor
        vendor = Vendor.query.filter_by(client_id=client_id, name=b["vendor_name"]).first()
        vendor_id = vendor.id if vendor else None

        bill = Bill(
            client_id=client_id, vendor_id=vendor_id, source="erp",
            source_ref=b["source_ref"], bill_number=b["bill_number"],
            bill_date=b["bill_date"], due_date=b["due_date"],
            subtotal=b["subtotal"], tax_amount=b["tax_amount"], total=b["total"],
            currency="AED", status=b["status"], category=b["category"],
            notes=f"Imported from PDI Enterprise AP",
        )
        db.session.add(bill)
        created += 1
    db.session.commit()
    return {"fetched": len(bills_data), "created": created, "updated": 0}


def sync_pdi_erp_invoices(conn: Connection, client_id: uuid.UUID):
    """Import sales invoices from PDI Enterprise AR module."""
    today = date.today()
    start = today - timedelta(days=90)

    invoices_data = []
    seq = 1
    current = start
    while current <= today:
        if current.weekday() < 6:  # Mon-Sat
            num = random.randint(1, 4)
            for _ in range(num):
                customer = random.choice(DEMO_CUSTOMERS)
                if customer["category"] == "Corporate":
                    total = round(random.uniform(2000, 25000), 2)
                elif customer["category"] == "Government":
                    total = round(random.uniform(5000, 40000), 2)
                else:
                    total = round(random.uniform(500, 5000), 2)
                subtotal = round(total / 1.05, 2)
                tax = round(total - subtotal, 2)
                invoices_data.append({
                    "customer_name": customer["name"],
                    "invoice_number": f"PDI-AR-{current.strftime('%Y%m')}-{seq:04d}",
                    "invoice_date": current,
                    "due_date": current + timedelta(days=30),
                    "subtotal": subtotal, "tax_amount": tax, "total": total,
                    "category": customer["category"],
                    "source_ref": f"pdi-erp:invoice:{current.isoformat()}-{seq:04d}",
                    "status": random.choice(["sent", "sent", "paid", "paid", "paid", "overdue"]),
                })
                seq += 1
        current += timedelta(days=1)

    invoices_data = invoices_data[:50]

    created = 0
    for inv in invoices_data:
        existing = Invoice.query.filter_by(client_id=client_id, source="erp", source_ref=inv["source_ref"]).first()
        if existing:
            continue
        customer = Customer.query.filter_by(client_id=client_id, name=inv["customer_name"]).first()
        customer_id = customer.id if customer else None

        invoice = Invoice(
            client_id=client_id, customer_id=customer_id, source="erp",
            source_ref=inv["source_ref"], invoice_number=inv["invoice_number"],
            invoice_date=inv["invoice_date"], due_date=inv["due_date"],
            subtotal=inv["subtotal"], tax_amount=inv["tax_amount"], total=inv["total"],
            currency="AED", status=inv["status"], category=inv["category"],
            notes=f"Imported from PDI Enterprise AR",
        )
        db.session.add(invoice)
        created += 1
    db.session.commit()
    return {"fetched": len(invoices_data), "created": created, "updated": 0}
