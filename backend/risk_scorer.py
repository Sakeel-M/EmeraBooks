"""
Composite risk score calculation.
Weights: Reconciliation 30%, Alerts 20%, AR Health 15%, AP Health 15%, Data Freshness 20%.
"""
import json
import os
from flask import Blueprint, request, jsonify

risk_bp = Blueprint('risk', __name__)

def _get_openai_client():
    """Lazy-init OpenAI client so env vars are definitely loaded."""
    import openai as openai_mod
    import httpx
    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        return None
    return openai_mod.OpenAI(
        api_key=key,
        http_client=httpx.Client(timeout=60.0),
    )


def compute_risk_score(metrics):
    """
    Compute overall risk score (0-100, higher = healthier).

    metrics keys:
        recon_match_rate: 0-100
        alerts_resolved_pct: 0-100
        ar_health_pct: 0-100
        ap_health_pct: 0-100
        data_freshness_pct: 0-100
    """
    weights = {
        'recon_match_rate': 0.30,
        'alerts_resolved_pct': 0.20,
        'ar_health_pct': 0.15,
        'ap_health_pct': 0.15,
        'data_freshness_pct': 0.20,
    }

    score = 0
    breakdown = []

    for key, weight in weights.items():
        value = min(100, max(0, float(metrics.get(key, 0))))
        weighted = value * weight
        score += weighted
        breakdown.append({
            'category': key.replace('_pct', '').replace('_', ' ').title(),
            'raw_score': round(value, 1),
            'weight': weight,
            'weighted_score': round(weighted, 1),
        })

    overall = round(score, 1)

    if overall >= 80:
        risk_level = 'low'
    elif overall >= 60:
        risk_level = 'medium'
    elif overall >= 40:
        risk_level = 'high'
    else:
        risk_level = 'critical'

    return {
        'overall_score': overall,
        'risk_level': risk_level,
        'breakdown': breakdown,
    }


@risk_bp.route('/api/risk/score', methods=['POST'])
def risk_score():
    """Compute composite risk score."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        metrics = data.get('metrics', {})
        result = compute_risk_score(metrics)
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': f'Risk scoring failed: {str(e)}'}), 500


def _rule_based_score(summary):
    """
    Deterministic rule-based risk score used as a fallback when OpenAI is
    unavailable (no key, quota exhausted, network error). Produces the same
    response shape as the AI path so the frontend renders identically.
    """
    def clamp(v, lo=0, hi=100):
        return max(lo, min(hi, v))

    cur = summary.get('currency', 'USD')
    total_income = float(summary.get('totalIncome', 0) or 0)
    total_expenses = float(summary.get('totalExpenses', 0) or 0)
    net_income = float(summary.get('netIncome', 0) or 0)
    cash_balance = float(summary.get('cashBalance', 0) or 0)
    runway_raw = summary.get('runway', 'N/A')
    try:
        runway = 100.0 if runway_raw == '100+' else float(runway_raw)
    except (TypeError, ValueError):
        runway = 0.0
    avg_burn = float(summary.get('avgMonthlyBurn', 0) or 0)
    avg_income = float(summary.get('avgMonthlyIncome', 0) or 0)
    overdue_bills_ct = int(summary.get('overdueBillsCount', 0) or 0)
    overdue_bills_amt = float(summary.get('overdueBillsAmount', 0) or 0)
    overdue_inv_ct = int(summary.get('overdueInvoicesCount', 0) or 0)
    overdue_inv_amt = float(summary.get('overdueInvoicesAmount', 0) or 0)
    dup_ct = int(summary.get('duplicateCount', 0) or 0)
    txn_ct = int(summary.get('transactionCount', 0) or 0)
    match_rate = float(summary.get('matchRate', 0) or 0)
    open_alerts = int(summary.get('openAlerts', 0) or 0)
    spike_cats = summary.get('spikeCategories', []) or []
    top_cat_pct = float(summary.get('topCategoryPct', 0) or 0)

    # 1. Liquidity Health — runway + burn-vs-income
    if runway >= 12:
        liq = 95
    elif runway >= 6:
        liq = 75
    elif runway >= 3:
        liq = 55
    elif runway >= 1:
        liq = 30
    else:
        liq = 15
    if avg_burn > 0 and avg_income < avg_burn:
        liq -= 15
    liq = clamp(liq)

    # 2. Revenue Stability — income vs expenses
    if avg_income == 0:
        rev = 20
    else:
        ratio = avg_income / max(avg_burn, 1)
        rev = clamp(30 + 50 * min(ratio / 2, 1.4))
    if net_income < 0:
        rev -= 15
    rev = clamp(rev)

    # 3. Expense Control — concentration + spikes
    exp = 85
    if top_cat_pct >= 50:
        exp -= 25
    elif top_cat_pct >= 35:
        exp -= 10
    exp -= min(len(spike_cats) * 8, 30)
    exp = clamp(exp)

    # 4. Receivables Quality — overdue invoices
    if total_income <= 0:
        arq = 60 if overdue_inv_ct == 0 else 40
    else:
        pct = (overdue_inv_amt / total_income) * 100
        arq = clamp(95 - pct * 2)
    if overdue_inv_ct > 20:
        arq -= 10
    arq = clamp(arq)

    # 5. Payables Management — overdue bills
    if total_expenses <= 0:
        apm = 70
    else:
        pct = (overdue_bills_amt / total_expenses) * 100
        apm = clamp(95 - pct * 2)
    if overdue_bills_ct > 20:
        apm -= 10
    apm = clamp(apm)

    # 6. Data Integrity — match rate, duplicates
    di = clamp(40 + match_rate * 0.5)
    if dup_ct > 0:
        di -= min(dup_ct * 3, 30)
    di = clamp(di)

    # 7. Compliance Posture — open alerts
    if open_alerts == 0:
        cp = 90
    elif open_alerts <= 3:
        cp = 70
    elif open_alerts <= 10:
        cp = 50
    else:
        cp = 30
    cp = clamp(cp)

    # 8. Overall Financial Resilience — weighted echo
    resilience = round((liq * 0.35 + rev * 0.25 + di * 0.15 + apm * 0.15 + cp * 0.10))

    factors = [
        {"name": "Liquidity Health", "score": round(liq), "weight": 20,
         "finding": f"Cash runway is {runway_raw} months with avg burn {cur} {avg_burn:,.0f}/mo.",
         "recommendation": "Maintain at least 6 months of runway; tighten discretionary spend if below." if runway < 6 else "Runway is healthy — continue current cash management."},
        {"name": "Revenue Stability", "score": round(rev), "weight": 15,
         "finding": f"Avg monthly income {cur} {avg_income:,.0f} vs burn {cur} {avg_burn:,.0f}; net {cur} {net_income:,.0f}.",
         "recommendation": "Diversify revenue streams and track monthly recurring income." if rev < 60 else "Revenue vs burn ratio is healthy."},
        {"name": "Expense Control", "score": round(exp), "weight": 15,
         "finding": f"Top category is {top_cat_pct:.0f}% of spend; {len(spike_cats)} category spike(s) detected.",
         "recommendation": "Diversify expense categories and investigate any spikes." if exp < 70 else "Expense profile looks balanced."},
        {"name": "Receivables Quality", "score": round(arq), "weight": 10,
         "finding": f"{overdue_inv_ct} overdue invoices totaling {cur} {overdue_inv_amt:,.0f}.",
         "recommendation": "Tighten collections cadence and send reminders on overdue AR." if arq < 70 else "Receivables are in good shape."},
        {"name": "Payables Management", "score": round(apm), "weight": 10,
         "finding": f"{overdue_bills_ct} overdue bills totaling {cur} {overdue_bills_amt:,.0f}.",
         "recommendation": "Prioritize overdue supplier payments to preserve credit terms." if apm < 70 else "Payables are well-managed."},
        {"name": "Data Integrity", "score": round(di), "weight": 15,
         "finding": f"Reconciliation match rate {match_rate:.0f}% with {dup_ct} possible duplicate(s).",
         "recommendation": "Reconcile more frequently and investigate duplicates." if di < 70 else "Data integrity is strong."},
        {"name": "Compliance Posture", "score": round(cp), "weight": 5,
         "finding": f"{open_alerts} open risk alert(s).",
         "recommendation": "Triage and resolve open alerts promptly." if cp < 70 else "Compliance posture is solid."},
        {"name": "Overall Financial Resilience", "score": resilience, "weight": 10,
         "finding": f"Composite across liquidity, revenue, data, AP, and compliance ≈ {resilience}.",
         "recommendation": "Focus improvements on the lowest-scoring factor above." if resilience < 70 else "Resilience is broadly healthy."},
    ]

    overall = round(sum(f['score'] * f['weight'] for f in factors) / 100)
    if overall >= 81:
        level = "Low Risk"
    elif overall >= 61:
        level = "Medium Risk"
    elif overall >= 41:
        level = "High Risk"
    else:
        level = "Critical Risk"

    summary_text = (
        f"Rule-based score: {overall}/100 ({level}). "
        f"Runway {runway_raw} months, net income {cur} {net_income:,.0f}, "
        f"{overdue_bills_ct} overdue bills, {overdue_inv_ct} overdue invoices, "
        f"match rate {match_rate:.0f}%."
    )

    return {
        "score": overall,
        "level": level,
        "factors": factors,
        "summary": summary_text,
        "engine": "rule-based",
    }


@risk_bp.route('/api/risk/ai-score', methods=['POST'])
def risk_ai_score():
    """Generate AI-powered risk score with detailed factor analysis.

    Falls back to a deterministic rule-based engine when OpenAI is
    unavailable (missing key, quota exhausted, timeout). The response shape
    is identical so the frontend renders both paths the same way.
    """
    try:
        data = request.get_json()
        summary = data.get('summary', {})

        if not summary:
            return jsonify({"error": "No summary provided"}), 400

        client = _get_openai_client()
        if not client:
            result = _rule_based_score(summary)
            result["summary"] = "OpenAI key not configured — showing rule-based score. " + result["summary"]
            return jsonify(result), 200

        prompt = (
            "You are a senior forensic accountant and risk analyst. Analyze this company's financial data "
            "and produce a comprehensive AI Risk Score from 0 to 100 (100 = lowest risk, healthiest).\n\n"
            f"Financial Data:\n"
            f"- Currency: {summary.get('currency', 'USD')}\n"
            f"- Total Income: {summary.get('totalIncome', 0):,.2f}\n"
            f"- Total Expenses: {summary.get('totalExpenses', 0):,.2f}\n"
            f"- Net Income: {summary.get('netIncome', 0):,.2f}\n"
            f"- Cash Balance: {summary.get('cashBalance', 0):,.2f}\n"
            f"- Cash Runway: {summary.get('runway', 'N/A')} months\n"
            f"- Avg Monthly Burn: {summary.get('avgMonthlyBurn', 0):,.2f}\n"
            f"- Avg Monthly Income: {summary.get('avgMonthlyIncome', 0):,.2f}\n"
            f"- Overdue Bills (AP): {summary.get('overdueBillsCount', 0)} totaling {summary.get('overdueBillsAmount', 0):,.2f}\n"
            f"- Overdue Invoices (AR): {summary.get('overdueInvoicesCount', 0)} totaling {summary.get('overdueInvoicesAmount', 0):,.2f}\n"
            f"- Duplicate Payment Risk: {summary.get('duplicateCount', 0)} potential duplicates\n"
            f"- Total Transactions: {summary.get('transactionCount', 0)}\n"
            f"- Reconciliation Match Rate: {summary.get('matchRate', 0):.1f}%\n"
            f"- Open Risk Alerts: {summary.get('openAlerts', 0)}\n"
            f"- Top Spending Categories: {', '.join(summary.get('topCategories', []))}\n"
            f"- Spending Spike Categories: {', '.join(summary.get('spikeCategories', []))}\n"
            f"- Expense Concentration: Top category is {summary.get('topCategoryPct', 0):.0f}% of total spend\n"
            f"- Industry: {summary.get('industry', 'Unknown')}\n\n"
            "Score the company on these 8 dimensions (each 0-100):\n"
            "1. Liquidity Health - cash runway, burn rate vs income\n"
            "2. Revenue Stability - income consistency, growth trend\n"
            "3. Expense Control - spending efficiency, concentration risk\n"
            "4. Receivables Quality - AR aging, overdue ratio\n"
            "5. Payables Management - AP aging, overdue ratio\n"
            "6. Data Integrity - match rate, duplicates, reconciliation health\n"
            "7. Compliance Posture - alerts, anomalies, documentation gaps\n"
            "8. Overall Financial Resilience - combined stress tolerance\n\n"
            'Return ONLY valid JSON in this exact format:\n'
            '{\n'
            '  "score": <integer 0-100>,\n'
            '  "level": "<Critical Risk|High Risk|Medium Risk|Low Risk>",\n'
            '  "factors": [\n'
            '    {"name": "Liquidity Health", "score": <0-100>, "weight": 20, "finding": "<1-2 sentence specific finding>", "recommendation": "<actionable recommendation>"},\n'
            '    {"name": "Revenue Stability", "score": <0-100>, "weight": 15, "finding": "...", "recommendation": "..."},\n'
            '    {"name": "Expense Control", "score": <0-100>, "weight": 15, "finding": "...", "recommendation": "..."},\n'
            '    {"name": "Receivables Quality", "score": <0-100>, "weight": 10, "finding": "...", "recommendation": "..."},\n'
            '    {"name": "Payables Management", "score": <0-100>, "weight": 10, "finding": "...", "recommendation": "..."},\n'
            '    {"name": "Data Integrity", "score": <0-100>, "weight": 15, "finding": "...", "recommendation": "..."},\n'
            '    {"name": "Compliance Posture", "score": <0-100>, "weight": 5, "finding": "...", "recommendation": "..."},\n'
            '    {"name": "Overall Financial Resilience", "score": <0-100>, "weight": 10, "finding": "...", "recommendation": "..."}\n'
            '  ],\n'
            '  "summary": "<2-3 sentence executive summary of the company risk profile>"\n'
            '}'
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a forensic accountant. Return ONLY valid JSON, no markdown."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0,
            seed=42
        )

        ai_text = response.choices[0].message.content.strip()
        if '```json' in ai_text:
            ai_text = ai_text.split('```json')[1].split('```')[0].strip()
        elif '```' in ai_text:
            ai_text = ai_text.split('```')[1].split('```')[0].strip()

        result = json.loads(ai_text)
        if not isinstance(result, dict) or 'score' not in result:
            fallback = _rule_based_score(summary)
            fallback["summary"] = "AI returned invalid format — showing rule-based score. " + fallback["summary"]
            return jsonify(fallback), 200

        result["engine"] = "openai"
        return jsonify(result)

    except Exception as e:
        import traceback, sys
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        err_name = type(e).__name__
        print(f"Risk AI score error: {err_name}: {e}", flush=True)
        try:
            data = request.get_json(silent=True) or {}
            summary = data.get('summary', {}) or {}
            if summary:
                fallback = _rule_based_score(summary)
                reason = "quota exceeded" if "RateLimit" in err_name or "Quota" in err_name else "AI unavailable"
                fallback["summary"] = f"OpenAI {reason} — showing rule-based score. " + fallback["summary"]
                return jsonify(fallback), 200
        except Exception:
            pass
        return jsonify({"score": None, "factors": [], "summary": f"AI scoring failed: {err_name}: {str(e)}"}), 200
