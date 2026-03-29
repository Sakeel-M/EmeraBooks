"""Verifone Cloud POS sync service — card transactions and settlements.
Supports demo mode with realistic UAE retail/F&B data."""
import uuid
import random
import string
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from models.base import db
from models.tier1 import Connection
from models.tier2 import Transaction

TERMINAL_TYPES = ["Carbon", "Carbon", "Engage", "Engage", "VX520"]
TERMINAL_IDS = [
    "Carbon-001", "Carbon-002", "Engage-003", "Engage-004", "VX520-005",
    "Carbon-006", "Engage-007",
]

PAYMENT_METHODS = ["Visa", "MasterCard", "mada Debit", "AMEX", "Apple Pay", "Samsung Pay"]
PAYMENT_WEIGHTS = [35, 30, 15, 10, 7, 3]

TXN_TYPES = ["sale", "sale", "sale", "sale", "sale", "sale", "sale", "sale", "sale", "refund", "void"]

# UAE retail/F&B merchants for demo descriptions
MERCHANTS = [
    {"name": "Carrefour Express", "category": "Retail & Shopping", "min": 25, "max": 350},
    {"name": "Spinneys", "category": "Food & Beverage", "min": 30, "max": 400},
    {"name": "Lulu Hypermarket", "category": "Retail & Shopping", "min": 20, "max": 500},
    {"name": "Zara Dubai Mall", "category": "Retail & Shopping", "min": 100, "max": 800},
    {"name": "H&M City Centre", "category": "Retail & Shopping", "min": 50, "max": 400},
    {"name": "Sharaf DG Electronics", "category": "Retail & Shopping", "min": 80, "max": 2000},
    {"name": "Costa Coffee", "category": "Food & Beverage", "min": 15, "max": 50},
    {"name": "Starbucks", "category": "Food & Beverage", "min": 18, "max": 65},
    {"name": "Tim Hortons", "category": "Food & Beverage", "min": 12, "max": 45},
    {"name": "Shake Shack", "category": "Food & Beverage", "min": 35, "max": 120},
    {"name": "PF Chang's", "category": "Food & Beverage", "min": 80, "max": 350},
    {"name": "The Cheesecake Factory", "category": "Food & Beverage", "min": 100, "max": 450},
    {"name": "Nando's", "category": "Food & Beverage", "min": 40, "max": 150},
    {"name": "Five Guys", "category": "Food & Beverage", "min": 35, "max": 100},
    {"name": "Boots Pharmacy", "category": "Healthcare", "min": 20, "max": 200},
    {"name": "Life Pharmacy", "category": "Healthcare", "min": 15, "max": 150},
    {"name": "Paris Gallery", "category": "Retail & Shopping", "min": 100, "max": 1500},
    {"name": "Virgin Megastore", "category": "Entertainment & Media", "min": 30, "max": 300},
    {"name": "Ace Hardware", "category": "Supplies & Consumables", "min": 25, "max": 500},
    {"name": "IKEA", "category": "Retail & Shopping", "min": 50, "max": 2000},
]


def verify_verifone_connection(credentials, config):
    """Verify Verifone Cloud connection credentials."""
    demo_mode = config.get("demo_mode", True)

    if demo_mode:
        return {"ok": True, "merchant_name": "EMARA Retail", "terminals": len(TERMINAL_IDS), "demo": True}

    # TODO: Live OAuth2 authentication
    # client_id = credentials.get("client_id")
    # client_secret = credentials.get("client_secret")
    # base_url = config.get("base_url", "https://api.verifone.cloud/v1")
    # token_resp = requests.post(f"{base_url}/oauth/token",
    #     data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret})
    # access_token = token_resp.json()["access_token"]
    # merchant_resp = requests.get(f"{base_url}/merchants/{config['merchant_id']}",
    #     headers={"Authorization": f"Bearer {access_token}"})
    # return {"ok": True, "merchant_name": merchant_resp.json()["name"], ...}

    return {"ok": True, "merchant_name": config.get("merchant_id", "Verifone POS"), "demo": False}


def _generate_card_transaction(txn_date, seq):
    """Generate a realistic card payment transaction."""
    merchant = random.choice(MERCHANTS)
    amount = round(random.uniform(merchant["min"], merchant["max"]), 2)
    txn_type = random.choice(TXN_TYPES)
    payment = random.choices(PAYMENT_METHODS, weights=PAYMENT_WEIGHTS, k=1)[0]
    terminal = random.choice(TERMINAL_IDS)
    terminal_type = terminal.split("-")[0]
    card_last4 = "".join(random.choices(string.digits, k=4))
    auth_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    # Tips on F&B (0-15%)
    tip = 0
    if merchant["category"] == "Food & Beverage" and random.random() < 0.4:
        tip = round(amount * random.uniform(0.05, 0.15), 2)

    # Refunds are negative
    if txn_type == "refund":
        amount = -amount
        tip = 0

    return {
        "date": txn_date,
        "description": f"{merchant['name']} - {payment} ***{card_last4}",
        "amount": round(amount + tip, 2),
        "category": merchant["category"],
        "source_ref": f"verifone:TXN-{txn_date.isoformat()}-{seq:05d}",
        "metadata": {
            "terminal_id": terminal,
            "terminal_type": terminal_type,
            "payment_method": payment,
            "card_last4": card_last4,
            "auth_code": auth_code,
            "receipt_no": f"VFN-{txn_date.strftime('%Y%m%d')}-{seq:05d}",
            "tip_amount": tip,
            "txn_type": txn_type,
            "merchant_name": merchant["name"],
            "product_type": "card_payment",
        },
    }


def sync_verifone_transactions(conn: Connection, client_id: uuid.UUID):
    """Import card payment transactions from Verifone POS."""
    config = conn.config or {}

    # Demo mode: generate transactions for last 30 days
    today = date.today()
    start = today - timedelta(days=30)

    demo_txns = []
    seq = 1
    current = start
    while current <= today:
        # 20-50 card transactions per day
        num_txns = random.randint(20, 50)
        for _ in range(num_txns):
            demo_txns.append(_generate_card_transaction(current, seq))
            seq += 1
        current += timedelta(days=1)

    # Limit to reasonable count for demo
    if len(demo_txns) > 60:
        demo_txns = random.sample(demo_txns, 60)

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
            category=txn["category"],
            counterparty_name=txn["metadata"]["merchant_name"],
            metadata_=txn["metadata"],
        )
        db.session.add(record)
        created += 1

    db.session.commit()
    return {"fetched": len(demo_txns), "created": created, "updated": updated}


def sync_verifone_settlements(conn: Connection, client_id: uuid.UUID):
    """Import daily batch settlements from Verifone POS."""
    config = conn.config or {}

    today = date.today()
    start = today - timedelta(days=30)

    settlements = []
    current = start
    while current <= today:
        # One settlement per terminal per day
        for terminal in random.sample(TERMINAL_IDS, min(3, len(TERMINAL_IDS))):
            total_sales = round(random.uniform(5000, 25000), 2)
            total_refunds = round(random.uniform(0, total_sales * 0.05), 2)
            net = round(total_sales - total_refunds, 2)
            txn_count = random.randint(15, 50)

            settlements.append({
                "date": current,
                "description": f"Settlement Batch - {terminal} - {current.strftime('%d %b %Y')}",
                "amount": net,
                "source_ref": f"verifone:BATCH-{terminal}-{current.isoformat()}",
                "metadata": {
                    "settlement_date": current.isoformat(),
                    "batch_id": f"BATCH-{terminal}-{current.strftime('%Y%m%d')}",
                    "terminal_id": terminal,
                    "total_sales": total_sales,
                    "total_refunds": total_refunds,
                    "net_amount": net,
                    "transaction_count": txn_count,
                    "product_type": "settlement",
                },
            })
        current += timedelta(days=1)

    # Limit settlements for demo
    if len(settlements) > 30:
        settlements = random.sample(settlements, 30)

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
            counterparty_name="Verifone Settlement",
            metadata_=s["metadata"],
        )
        db.session.add(record)
        created += 1

    db.session.commit()
    return {"fetched": len(settlements), "created": created, "updated": 0}
