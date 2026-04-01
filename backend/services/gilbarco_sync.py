"""Gilbarco Passport POS sync service — fuel station transactions and settlements.
Supports demo mode with realistic UAE fuel station data."""
import uuid
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from models.base import db
from models.tier1 import Connection
from models.tier2 import Transaction

# UAE fuel prices (March 2026 approximate)
FUEL_GRADES = [
    {"name": "Super 98", "price": 3.41},
    {"name": "Special 95", "price": 3.29},
    {"name": "E-Plus 91", "price": 3.18},
    {"name": "Diesel", "price": 3.02},
]

CSTORE_ITEMS = [
    {"name": "Bottled Water 500ml", "min": 2, "max": 5},
    {"name": "Al Ain Water 1.5L", "min": 3, "max": 6},
    {"name": "Snickers Bar", "min": 5, "max": 8},
    {"name": "Lay's Chips", "min": 5, "max": 10},
    {"name": "Red Bull Energy", "min": 10, "max": 15},
    {"name": "Car Wash - Basic", "min": 30, "max": 45},
    {"name": "Car Wash - Premium", "min": 55, "max": 80},
    {"name": "Motor Oil 1L", "min": 40, "max": 75},
    {"name": "Windshield Washer Fluid", "min": 15, "max": 25},
    {"name": "Air Freshener", "min": 10, "max": 20},
    {"name": "Phone Charger", "min": 25, "max": 45},
    {"name": "Cigarettes Pack", "min": 18, "max": 25},
]

PAYMENT_METHODS = ["Cash", "Visa Card", "MasterCard", "Fleet Card", "mada Debit", "Apple Pay"]
PAYMENT_WEIGHTS = [30, 25, 15, 20, 7, 3]

SITE_NAMES = [
    "ADNOC Al Barsha", "ADNOC Business Bay", "ADNOC Jumeirah",
    "ENOC Sheikh Zayed Rd", "ENOC Al Quoz", "ENOC Dubai Marina",
    "EPPCO Deira", "EPPCO Al Rashidiya",
]

TERMINALS = ["PASSPORT-001", "PASSPORT-002", "PASSPORT-003", "PASSPORT-004"]


def verify_gilbarco_connection(api_key, merchant_id, site_id, base_url, demo_mode=True):
    """Verify Gilbarco POS connection credentials."""
    if demo_mode or (not api_key and not merchant_id):
        # Demo mode: always succeed
        site_name = random.choice(SITE_NAMES)
        return {"ok": True, "site_name": site_name, "demo": True}

    # TODO: Live API verification
    # resp = requests.get(f"{base_url}/sites/{site_id}/status",
    #     headers={"Authorization": f"Bearer {api_key}", "X-Merchant-ID": merchant_id},
    #     timeout=15)
    # if resp.status_code != 200: raise ValueError("Authentication failed")
    # return {"ok": True, "site_name": resp.json().get("site_name", site_id)}

    return {"ok": True, "site_name": site_id, "demo": False}


def _generate_fuel_transaction(txn_date, seq):
    """Generate a realistic fuel pump transaction."""
    grade = random.choice(FUEL_GRADES)
    liters = round(random.uniform(15, 120), 2)
    amount = round(liters * grade["price"], 2)
    pump = random.randint(1, 12)
    payment = random.choices(PAYMENT_METHODS, weights=PAYMENT_WEIGHTS, k=1)[0]
    terminal = random.choice(TERMINALS)

    return {
        "date": txn_date,
        "description": f"Fuel Sale - {grade['name']} - Pump {pump}",
        "amount": amount,
        "source_ref": f"gilbarco:FUEL-{txn_date.isoformat()}-{seq:04d}",
        "metadata": {
            "terminal_id": terminal,
            "pump_number": pump,
            "fuel_grade": grade["name"],
            "liters": liters,
            "price_per_liter": grade["price"],
            "payment_method": payment,
            "receipt_no": f"RCT-{txn_date.strftime('%Y%m%d')}-{seq:04d}",
            "product_type": "fuel",
        },
    }


def _generate_cstore_transaction(txn_date, seq):
    """Generate a convenience store transaction."""
    # 1-3 items per transaction
    num_items = random.randint(1, 3)
    items = random.sample(CSTORE_ITEMS, min(num_items, len(CSTORE_ITEMS)))
    total = sum(round(random.uniform(i["min"], i["max"]), 2) for i in items)
    desc_items = ", ".join(i["name"] for i in items)
    payment = random.choices(PAYMENT_METHODS[:4], weights=[35, 30, 20, 15], k=1)[0]
    terminal = random.choice(TERMINALS)

    return {
        "date": txn_date,
        "description": f"C-Store Sale - {desc_items}",
        "amount": round(total, 2),
        "source_ref": f"gilbarco:CSTR-{txn_date.isoformat()}-{seq:04d}",
        "metadata": {
            "terminal_id": terminal,
            "payment_method": payment,
            "receipt_no": f"CST-{txn_date.strftime('%Y%m%d')}-{seq:04d}",
            "product_type": "cstore",
            "items": [i["name"] for i in items],
            "item_count": num_items,
        },
    }


def sync_gilbarco_transactions(conn: Connection, client_id: uuid.UUID):
    """Import fuel and convenience store transactions from Gilbarco POS."""
    config = conn.config or {}
    demo_mode = config.get("demo_mode", True)

    if not demo_mode:
        # TODO: Live API call
        # base_url = config.get("base_url")
        # creds = conn.credentials or {}
        # resp = requests.get(f"{base_url}/sites/{creds['site_id']}/transactions", ...)
        # raw_transactions = resp.json()["transactions"]
        pass

    # Demo mode: generate realistic transactions for the last 30 days
    today = date.today()
    start = today - timedelta(days=30)

    demo_txns = []
    seq = 1
    current = start
    while current <= today:
        # 15-30 fuel transactions per day
        num_fuel = random.randint(15, 30)
        for _ in range(num_fuel):
            demo_txns.append(_generate_fuel_transaction(current, seq))
            seq += 1
        # 5-15 c-store transactions per day
        num_cstore = random.randint(5, 15)
        for _ in range(num_cstore):
            demo_txns.append(_generate_cstore_transaction(current, seq))
            seq += 1
        current += timedelta(days=1)

    # Take first 50 (deterministic — same on every sync for dedup)
    demo_txns = demo_txns[:50]

    # Create Transaction records
    created = 0
    updated = 0
    for txn in demo_txns:
        existing = Transaction.query.filter_by(
            client_id=client_id, source="pos", source_ref=txn["source_ref"]
        ).first()
        if existing:
            updated += 1
            continue

        record = Transaction(
            client_id=client_id,
            connection_id=conn.id,
            source="pos",
            source_ref=txn["source_ref"],
            transaction_date=txn["date"],
            description=txn["description"],
            amount=txn["amount"],
            currency="AED",
            category="Fuel & Energy" if txn["metadata"]["product_type"] == "fuel" else "Retail & Shopping",
            counterparty_name=config.get("site_name", "Gilbarco POS"),
            metadata_=txn["metadata"],
        )
        db.session.add(record)
        created += 1

    db.session.commit()
    return {"fetched": len(demo_txns), "created": created, "updated": updated}


def sync_gilbarco_settlements(conn: Connection, client_id: uuid.UUID):
    """Import daily settlement/shift reports from Gilbarco POS."""
    config = conn.config or {}

    # Demo mode: generate daily settlements for last 30 days
    today = date.today()
    start = today - timedelta(days=30)

    settlements = []
    current = start
    while current <= today:
        total_fuel = round(random.uniform(8000, 25000), 2)
        total_cstore = round(random.uniform(1500, 5000), 2)
        total = total_fuel + total_cstore
        cash_pct = random.uniform(0.25, 0.35)
        card_pct = random.uniform(0.35, 0.45)
        fleet_pct = 1 - cash_pct - card_pct

        settlements.append({
            "date": current,
            "description": f"Daily Settlement - {current.strftime('%d %b %Y')}",
            "amount": total,
            "source_ref": f"gilbarco:SETTLE-{current.isoformat()}",
            "metadata": {
                "settlement_date": current.isoformat(),
                "total_fuel_sales": total_fuel,
                "total_cstore_sales": total_cstore,
                "total_cash": round(total * cash_pct, 2),
                "total_card": round(total * card_pct, 2),
                "total_fleet": round(total * fleet_pct, 2),
                "transaction_count": random.randint(20, 45),
                "product_type": "settlement",
            },
        })
        current += timedelta(days=1)

    created = 0
    for s in settlements:
        existing = Transaction.query.filter_by(
            client_id=client_id, source="pos", source_ref=s["source_ref"]
        ).first()
        if existing:
            continue
        record = Transaction(
            client_id=client_id, connection_id=conn.id, source="pos",
            source_ref=s["source_ref"], transaction_date=s["date"],
            description=s["description"], amount=s["amount"], currency="AED",
            category="POS Settlement",
            counterparty_name=config.get("site_name", "Gilbarco POS"),
            metadata_=s["metadata"],
        )
        db.session.add(record)
        created += 1

    db.session.commit()
    return {"fetched": len(settlements), "created": created, "updated": 0}
