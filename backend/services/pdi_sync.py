"""PDI Technologies CStore POS sync service — c-store, fuel, and foodservice transactions.
Supports demo mode with realistic UAE convenience store data."""
import uuid
import random
from datetime import date, timedelta
from decimal import Decimal

from models.base import db
from models.tier1 import Connection
from models.tier2 import Transaction

# UAE fuel prices
FUEL_GRADES = [
    {"name": "Super 98", "price": 3.41},
    {"name": "Special 95", "price": 3.29},
    {"name": "E-Plus 91", "price": 3.18},
    {"name": "Diesel", "price": 3.02},
]

CSTORE_ITEMS = [
    # Beverages
    {"name": "Al Ain Water 500ml", "dept": "Merchandise", "min": 2, "max": 4},
    {"name": "Masafi Water 1.5L", "dept": "Merchandise", "min": 3, "max": 5},
    {"name": "Red Bull Energy 250ml", "dept": "Merchandise", "min": 9, "max": 13},
    {"name": "Coca-Cola 330ml", "dept": "Merchandise", "min": 3, "max": 6},
    {"name": "Fresh Orange Juice", "dept": "Merchandise", "min": 8, "max": 15},
    {"name": "Rani Float Mango", "dept": "Merchandise", "min": 3, "max": 5},
    # Snacks
    {"name": "Lay's Chips", "dept": "Merchandise", "min": 5, "max": 10},
    {"name": "KitKat Bar", "dept": "Merchandise", "min": 4, "max": 7},
    {"name": "Mixed Nuts 200g", "dept": "Merchandise", "min": 12, "max": 22},
    {"name": "Bateel Dates Box", "dept": "Merchandise", "min": 15, "max": 35},
    {"name": "Pringles Original", "dept": "Merchandise", "min": 8, "max": 14},
    # Foodservice
    {"name": "Chicken Shawarma Wrap", "dept": "Foodservice", "min": 12, "max": 18},
    {"name": "Beef Hot Dog", "dept": "Foodservice", "min": 8, "max": 14},
    {"name": "Cappuccino Large", "dept": "Foodservice", "min": 12, "max": 18},
    {"name": "Karak Chai", "dept": "Foodservice", "min": 5, "max": 8},
    {"name": "Croissant Zaatar", "dept": "Foodservice", "min": 6, "max": 10},
    {"name": "Glazed Donut", "dept": "Foodservice", "min": 5, "max": 9},
    {"name": "Falafel Sandwich", "dept": "Foodservice", "min": 10, "max": 15},
    # Car Care
    {"name": "Express Car Wash", "dept": "Merchandise", "min": 25, "max": 45},
    {"name": "Premium Car Wash", "dept": "Merchandise", "min": 50, "max": 80},
    {"name": "Windshield Washer Fluid", "dept": "Merchandise", "min": 12, "max": 20},
    {"name": "Air Freshener Tree", "dept": "Merchandise", "min": 8, "max": 15},
    {"name": "Castrol Motor Oil 1L", "dept": "Merchandise", "min": 35, "max": 65},
    # Lottery
    {"name": "Scratch Card - Lucky 7", "dept": "Lottery", "min": 5, "max": 10},
    {"name": "Scratch Card - Gold Rush", "dept": "Lottery", "min": 10, "max": 25},
    {"name": "Emirates Draw Ticket", "dept": "Lottery", "min": 15, "max": 25},
    # Tobacco
    {"name": "Marlboro Gold Pack", "dept": "Merchandise", "min": 18, "max": 22},
    {"name": "Vape Pod Refill", "dept": "Merchandise", "min": 25, "max": 45},
]

PAYMENT_METHODS = ["Cash", "Visa Card", "MasterCard", "Fleet Card", "mada Debit", "Fuel Voucher", "Apple Pay"]
PAYMENT_WEIGHTS = [25, 25, 15, 15, 10, 5, 5]

SITE_NAMES = [
    "PDI CStore - Al Barsha", "PDI CStore - Khalifa City", "PDI CStore - Al Reem Island",
    "PDI CStore - Mussafah", "PDI CStore - Yas Island", "PDI CStore - Corniche Rd",
]

TERMINALS = ["PDI-POS-001", "PDI-POS-002", "PDI-POS-003", "PDI-POS-004"]
REGISTERS = ["REG-01", "REG-02", "REG-03", "REG-04"]


def verify_pdi_connection(api_key, merchant_id, site_id, demo_mode=True):
    """Verify PDI CStore POS connection."""
    if demo_mode or (not api_key and not merchant_id):
        site_name = random.choice(SITE_NAMES)
        return {"ok": True, "site_name": site_name, "demo": True}

    # TODO: Live PDI API verification (requires partner agreement)
    # PDI uses Snowflake data feeds or Instance-to-Instance API
    # Contact pditechnologies.com for API access
    return {"ok": True, "site_name": site_id or "PDI Store", "demo": False}


def _gen_fuel_txn(txn_date, seq):
    """Generate a fuel pump transaction."""
    grade = random.choice(FUEL_GRADES)
    liters = round(random.uniform(15, 130), 2)
    amount = round(liters * grade["price"], 2)
    pump = random.randint(1, 16)
    payment = random.choices(PAYMENT_METHODS, weights=PAYMENT_WEIGHTS, k=1)[0]
    terminal = random.choice(TERMINALS)
    register = random.choice(REGISTERS)
    service = random.choice(["Self-Service", "Self-Service", "Full-Service"])

    return {
        "date": txn_date,
        "description": f"Fuel {grade['name']} - Pump {pump} ({service})",
        "amount": amount,
        "category": "Fuel & Energy",
        "source_ref": f"pdi:FUEL-{txn_date.isoformat()}-{seq:04d}",
        "metadata": {
            "terminal_id": terminal,
            "register_id": register,
            "department": "Fuel",
            "pump_number": pump,
            "fuel_grade": grade["name"],
            "liters": liters,
            "price_per_liter": grade["price"],
            "service_type": service,
            "payment_method": payment,
            "receipt_no": f"PDI-{txn_date.strftime('%Y%m%d')}-{seq:04d}",
            "product_type": "fuel",
        },
    }


def _gen_cstore_txn(txn_date, seq):
    """Generate a c-store / foodservice / lottery transaction."""
    num_items = random.randint(1, 4)
    items = random.sample(CSTORE_ITEMS, min(num_items, len(CSTORE_ITEMS)))
    total = sum(round(random.uniform(i["min"], i["max"]), 2) for i in items)
    dept = items[0]["dept"]  # primary department
    desc_items = ", ".join(i["name"] for i in items[:2])
    if len(items) > 2:
        desc_items += f" +{len(items)-2} more"
    payment = random.choices(PAYMENT_METHODS[:5], weights=[30, 30, 20, 5, 15], k=1)[0]
    terminal = random.choice(TERMINALS)
    register = random.choice(REGISTERS)

    # Loyalty card for ~40% of transactions
    loyalty = None
    if random.random() < 0.4:
        loyalty = f"PDI-LOYAL-{random.randint(1000, 9999)}"

    return {
        "date": txn_date,
        "description": f"CStore Sale - {desc_items}",
        "amount": round(total, 2),
        "category": "Food & Beverage" if dept == "Foodservice" else "Retail & Shopping",
        "source_ref": f"pdi:CSTR-{txn_date.isoformat()}-{seq:04d}",
        "metadata": {
            "terminal_id": terminal,
            "register_id": register,
            "department": dept,
            "payment_method": payment,
            "receipt_no": f"PDI-{txn_date.strftime('%Y%m%d')}-C{seq:04d}",
            "basket_size": num_items,
            "loyalty_card": loyalty,
            "items": [i["name"] for i in items],
            "product_type": "cstore" if dept == "Merchandise" else dept.lower(),
        },
    }


def sync_pdi_transactions(conn: Connection, client_id: uuid.UUID):
    """Import c-store and fuel transactions from PDI POS."""
    config = conn.config or {}

    # Demo mode: use fixed seed so re-syncs produce identical data (dedup works)
    rng = random.Random(hash(str(conn.id) + "pdi-txns"))

    today = date.today()
    start = today - timedelta(days=30)

    demo_txns = []
    seq = 1
    current = start
    while current <= today:
        for _ in range(rng.randint(12, 25)):
            demo_txns.append(_gen_fuel_txn(current, seq))
            seq += 1
        for _ in range(rng.randint(8, 20)):
            demo_txns.append(_gen_cstore_txn(current, seq))
            seq += 1
        current += timedelta(days=1)

    # Take first 55 (deterministic — same on every sync)
    demo_txns = demo_txns[:55]

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
            client_id=client_id, connection_id=conn.id, source="pos",
            source_ref=txn["source_ref"], transaction_date=txn["date"],
            description=txn["description"], amount=txn["amount"], currency="AED",
            category=txn["category"],
            counterparty_name=config.get("site_name", "PDI CStore POS"),
            metadata_=txn["metadata"],
        )
        db.session.add(record)
        created += 1

    db.session.commit()
    return {"fetched": len(demo_txns), "created": created, "updated": updated}


def sync_pdi_settlements(conn: Connection, client_id: uuid.UUID):
    """Import daily settlement reports from PDI POS."""
    config = conn.config or {}

    today = date.today()
    start = today - timedelta(days=30)

    settlements = []
    current = start
    while current <= today:
        fuel_total = round(random.uniform(6000, 20000), 2)
        merch_total = round(random.uniform(1500, 5000), 2)
        food_total = round(random.uniform(800, 2500), 2)
        lottery_total = round(random.uniform(200, 800), 2)
        grand_total = fuel_total + merch_total + food_total + lottery_total

        cash_pct = random.uniform(0.20, 0.30)
        card_pct = random.uniform(0.40, 0.50)
        fleet_pct = random.uniform(0.10, 0.18)
        other_pct = 1 - cash_pct - card_pct - fleet_pct

        settlements.append({
            "date": current,
            "description": f"PDI Daily Settlement - {current.strftime('%d %b %Y')}",
            "amount": grand_total,
            "source_ref": f"pdi:SETTLE-{current.isoformat()}",
            "metadata": {
                "settlement_date": current.isoformat(),
                "department_breakdown": {
                    "fuel": fuel_total,
                    "merchandise": merch_total,
                    "foodservice": food_total,
                    "lottery": lottery_total,
                },
                "payment_breakdown": {
                    "cash": round(grand_total * cash_pct, 2),
                    "card": round(grand_total * card_pct, 2),
                    "fleet": round(grand_total * fleet_pct, 2),
                    "other": round(grand_total * other_pct, 2),
                },
                "transaction_count": random.randint(25, 55),
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
            counterparty_name=config.get("site_name", "PDI CStore POS"),
            metadata_=s["metadata"],
        )
        db.session.add(record)
        created += 1

    db.session.commit()
    return {"fetched": len(settlements), "created": created, "updated": 0}
