"""Risk alerts CRUD routes."""
import uuid
from datetime import datetime, timezone, date, timedelta
from flask import Blueprint, request, jsonify, g
from sqlalchemy import func
from auth import require_auth
from permissions import require_client_access, user_has_client_access
from models.base import db
from models.tier4 import RiskAlert
from models.tier3 import ReconciliationItem
from models.tier2 import Bill, Invoice, Transaction

risk_alerts_crud_bp = Blueprint("risk_alerts_crud", __name__, url_prefix="/api")


@risk_alerts_crud_bp.route("/clients/<client_id>/risk-alerts", methods=["GET"])
@require_auth
@require_client_access
def get_risk_alerts(client_id):
    query = (
        RiskAlert.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(RiskAlert.created_at.desc())
    )
    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)
    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(RiskAlert.created_at >= start_date)
    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(RiskAlert.created_at <= end_date + " 23:59:59")

    alerts = query.all()
    return jsonify([a.to_dict() for a in alerts])


@risk_alerts_crud_bp.route("/clients/<client_id>/risk-alerts", methods=["POST"])
@require_auth
@require_client_access
def create_risk_alert(client_id):
    data = request.get_json()
    alert = RiskAlert(
        client_id=uuid.UUID(client_id),
        alert_type=data.get("alert_type"),
        severity=data.get("severity", "medium"),
        title=data.get("title"),
        description=data.get("description"),
        entity_type=data.get("entity_type"),
        entity_id=uuid.UUID(data["entity_id"]) if data.get("entity_id") else None,
        amount=data.get("amount"),
    )
    db.session.add(alert)
    db.session.commit()
    return jsonify(alert.to_dict()), 201


@risk_alerts_crud_bp.route("/risk-alerts/<alert_id>", methods=["PATCH"])
@require_auth
def update_risk_alert(alert_id):
    alert = RiskAlert.query.get_or_404(uuid.UUID(alert_id))
    if not user_has_client_access(alert.client_id):
        return jsonify({"error": "Access denied"}), 403

    data = request.get_json()
    if "status" in data:
        alert.status = data["status"]
    if "resolution" in data:
        alert.description = data["resolution"]

    if data.get("status") in ("resolved", "dismissed"):
        alert.resolved_by = uuid.UUID(g.user_id)
        alert.resolved_at = datetime.now(timezone.utc)

    alert.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(alert.to_dict())


@risk_alerts_crud_bp.route("/clients/<client_id>/risk-alerts/summary", methods=["GET"])
@require_auth
@require_client_access
def get_risk_alerts_summary(client_id):
    """Returns unified alert counts across risk alerts, flagged recon items, and overdues."""
    cid = uuid.UUID(client_id)
    today = date.today()

    # 1. Risk alerts by severity (existing)
    counts = (
        db.session.query(RiskAlert.severity, func.count(RiskAlert.id))
        .filter_by(client_id=cid, status="open")
        .group_by(RiskAlert.severity)
        .all()
    )
    sev = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    risk_total = 0
    for severity, count in counts:
        if severity in sev:
            sev[severity] = count
        risk_total += count

    # Count anomaly subset
    anomaly_count = (
        db.session.query(func.count(RiskAlert.id))
        .filter_by(client_id=cid, status="open", alert_type="anomaly")
        .scalar() or 0
    )

    # 2. Flagged reconciliation items
    flagged_count = ReconciliationItem.query.filter_by(client_id=cid, status="flagged").count()

    # 3. Overdue invoices
    overdue_inv = Invoice.query.filter(
        Invoice.client_id == cid,
        Invoice.status.notin_(["paid", "cancelled"]),
        Invoice.due_date.isnot(None),
        Invoice.due_date < today,
    ).count()

    # 4. Overdue bills
    overdue_bill = Bill.query.filter(
        Bill.client_id == cid,
        Bill.status.notin_(["paid", "cancelled"]),
        Bill.due_date.isnot(None),
        Bill.due_date < today,
    ).count()

    total = risk_total  # Only actual risk alerts count as "open alerts"

    return jsonify({
        **sev,
        "alertCount": total,
        "breakdown": {
            "riskAlerts": risk_total - anomaly_count,
            "anomalies": anomaly_count,
            "flaggedRecon": flagged_count,
            "overdueInvoices": overdue_inv,
            "overdueBills": overdue_bill,
        },
    })


@risk_alerts_crud_bp.route("/clients/<client_id>/risk-alerts/detect-anomalies", methods=["POST"])
@require_auth
@require_client_access
def detect_anomalies(client_id):
    """Run z-score anomaly detection on the current month vs 6-month baseline."""
    from variance_detector import compute_baselines, detect_anomaly

    cid = uuid.UUID(client_id)
    today = date.today()
    current_month = today.strftime("%Y-%m")
    six_months_ago = (today - timedelta(days=180))

    # Fetch transactions for last 6 months
    txns = (
        Transaction.query
        .filter(
            Transaction.client_id == cid,
            Transaction.transaction_date >= six_months_ago,
        )
        .all()
    )

    if len(txns) < 10:
        return jsonify({"anomalies": [], "message": "Not enough data for anomaly detection"})

    # Convert to dict format for compute_baselines
    txn_dicts = []
    current_month_revenue = 0.0
    current_month_expenses = 0.0
    current_month_category = {}

    for t in txns:
        date_str = t.transaction_date.isoformat() if t.transaction_date else ""
        amount = float(t.amount) if t.amount else 0.0
        category = t.category or "Other"
        txn_dicts.append({"date": date_str, "amount": amount, "category": category})

        # Track current month totals
        if date_str.startswith(current_month):
            if amount > 0:
                current_month_revenue += amount
            else:
                current_month_expenses += abs(amount)
            current_month_category[category] = current_month_category.get(category, 0) + amount

    # Compute baselines (excluding current month data for fair comparison)
    past_txn_dicts = [t for t in txn_dicts if not t["date"].startswith(current_month)]
    if len(past_txn_dicts) < 5:
        return jsonify({"anomalies": [], "message": "Not enough historical data"})

    baselines = compute_baselines(past_txn_dicts, "monthly")
    baseline_map = {b["metric_name"]: b for b in baselines}

    # Detect anomalies
    found_anomalies = []
    checks = [
        ("monthly_total_revenue", current_month_revenue, "Revenue"),
        ("monthly_total_expenses", current_month_expenses, "Expenses"),
        ("monthly_net_flow", current_month_revenue - current_month_expenses, "Net Cash Flow"),
    ]

    # Add per-category checks
    for cat, total in current_month_category.items():
        metric = f"category_spend:{cat}"
        if metric in baseline_map:
            checks.append((metric, abs(total), f"Category: {cat}"))

    for metric_name, current_value, label in checks:
        bl = baseline_map.get(metric_name)
        if not bl or bl["sample_count"] < 2:
            continue

        result = detect_anomaly(
            current_value=current_value,
            baseline_value=bl["value"],
            std_deviation=bl["std_dev"],
            threshold_sigma=2.0,
        )

        if result["is_anomaly"]:
            direction = result["direction"]
            severity = result["severity"]
            z_score = result["z_score"]

            if "category_spend:" in metric_name:
                cat_name = metric_name.split(":", 1)[1]
                title = f"Spending {'Spike' if direction == 'spike' else 'Drop'} in {cat_name}"
            else:
                title = f"{label} {'Spike' if direction == 'spike' else 'Drop'} Detected"

            description = (
                f"Current month: {current_value:,.2f} vs baseline avg {bl['value']:,.2f} "
                f"(z-score: {z_score}, {bl['sample_count']} months of history)"
            )

            # Check for existing alert with same metric+month (dedup)
            existing = RiskAlert.query.filter(
                RiskAlert.client_id == cid,
                RiskAlert.alert_type == "anomaly",
                RiskAlert.status == "open",
                RiskAlert.metadata_["metric_name"].astext == metric_name,
                RiskAlert.metadata_["month"].astext == current_month,
            ).first()

            if not existing:
                alert = RiskAlert(
                    client_id=cid,
                    alert_type="anomaly",
                    severity=severity,
                    title=title,
                    description=description,
                    amount=current_value,
                    metadata_={
                        "metric_name": metric_name,
                        "month": current_month,
                        "z_score": z_score,
                        "direction": direction,
                        "baseline_value": bl["value"],
                        "current_value": current_value,
                    },
                )
                db.session.add(alert)
                found_anomalies.append({
                    "title": title, "severity": severity, "description": description,
                    "direction": direction, "z_score": z_score, "metric_name": metric_name,
                })
            else:
                found_anomalies.append(existing.to_dict())

    db.session.commit()
    return jsonify({"anomalies": found_anomalies, "baselines_used": len(baselines)})
