"""
Statistical variance detection using z-score analysis.
"""
import math
from collections import defaultdict
from datetime import datetime
from flask import Blueprint, request, jsonify

variance_bp = Blueprint('variance', __name__)


def detect_anomaly(current_value, baseline_value, std_deviation, threshold_sigma=2.0):
    """
    Detect if current_value is an anomaly based on baseline statistics.
    Returns dict with is_anomaly, z_score, direction, severity.
    """
    if std_deviation is None or std_deviation == 0:
        return {
            'is_anomaly': False,
            'z_score': 0,
            'direction': 'normal',
            'severity': 'low',
        }

    z_score = (current_value - baseline_value) / std_deviation
    abs_z = abs(z_score)
    is_anomaly = abs_z > threshold_sigma

    if z_score > threshold_sigma:
        direction = 'spike'
    elif z_score < -threshold_sigma:
        direction = 'drop'
    else:
        direction = 'normal'

    if abs_z > 4:
        severity = 'critical'
    elif abs_z > 3:
        severity = 'high'
    elif abs_z > 2:
        severity = 'medium'
    else:
        severity = 'low'

    return {
        'is_anomaly': is_anomaly,
        'z_score': round(z_score, 2),
        'direction': direction,
        'severity': severity,
    }


def compute_baselines(transactions, period_type='monthly'):
    """
    Compute baseline statistics from historical transaction data.

    Args:
        transactions: list of dicts with keys: date (YYYY-MM-DD), amount, category
        period_type: 'monthly' or 'weekly'

    Returns list of baseline dicts.
    """
    period_totals = defaultdict(float)
    category_period_totals = defaultdict(lambda: defaultdict(float))

    for txn in transactions:
        date_str = txn.get('date', '')
        amount = float(txn.get('amount', 0))
        category = txn.get('category', 'Other')

        if period_type == 'monthly' and len(date_str) >= 7:
            period_key = date_str[:7]
        elif period_type == 'weekly' and len(date_str) >= 10:
            try:
                dt = datetime.strptime(date_str[:10], '%Y-%m-%d')
                iso = dt.isocalendar()
                period_key = f"{iso[0]}-W{iso[1]:02d}"
            except ValueError:
                continue
        else:
            continue

        period_totals[period_key] += amount
        category_period_totals[category][period_key] += amount

    def _stats(vals):
        mean = sum(vals) / len(vals)
        if len(vals) > 1:
            variance = sum((x - mean) ** 2 for x in vals) / (len(vals) - 1)
            std = math.sqrt(variance)
        else:
            std = 0
        return round(mean, 2), round(std, 2)

    baselines = []

    if period_totals:
        values = list(period_totals.values())
        revenue_values = [v for v in values if v > 0]
        expense_values = [abs(v) for v in values if v < 0]

        for metric, vals in [
            ('total_revenue', revenue_values),
            ('total_expenses', expense_values),
            ('net_flow', values),
        ]:
            if vals:
                mean, std = _stats(vals)
                baselines.append({
                    'metric_name': f'{period_type}_{metric}',
                    'value': mean,
                    'std_dev': std,
                    'sample_count': len(vals),
                })

    for category, periods in category_period_totals.items():
        vals = list(periods.values())
        if len(vals) >= 2:
            mean, std = _stats(vals)
            baselines.append({
                'metric_name': f'category_spend:{category}',
                'value': mean,
                'std_dev': std,
                'sample_count': len(vals),
            })

    return baselines


@variance_bp.route('/api/variance/detect', methods=['POST'])
def variance_detect():
    """Detect if a metric value is anomalous."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        std_dev = data.get('std_deviation')
        result = detect_anomaly(
            current_value=float(data.get('current_value', 0)),
            baseline_value=float(data.get('baseline_value', 0)),
            std_deviation=float(std_dev) if std_dev is not None else None,
            threshold_sigma=float(data.get('threshold_sigma', 2.0)),
        )
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': f'Variance detection failed: {str(e)}'}), 500


@variance_bp.route('/api/variance/compute-baselines', methods=['POST'])
def variance_baselines():
    """Compute historical baselines from transaction data."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        transactions = data.get('transactions', [])
        period_type = data.get('period_type', 'monthly')
        baselines = compute_baselines(transactions, period_type)
        return jsonify({'baselines': baselines})

    except Exception as e:
        return jsonify({'error': f'Baseline computation failed: {str(e)}'}), 500
