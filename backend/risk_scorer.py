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


@risk_bp.route('/api/risk/ai-score', methods=['POST'])
def risk_ai_score():
    """Generate AI-powered risk score with detailed factor analysis."""
    try:
        data = request.get_json()
        summary = data.get('summary', {})

        if not summary:
            return jsonify({"error": "No summary provided"}), 400

        client = _get_openai_client()
        if not client:
            return jsonify({"score": None, "factors": [], "summary": "AI scoring requires OpenAI API key configuration."}), 200

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
            return jsonify({"score": None, "factors": [], "summary": "AI returned invalid format."}), 200

        return jsonify(result)

    except Exception as e:
        import traceback, sys
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        print(f"Risk AI score error: {type(e).__name__}: {e}", flush=True)
        return jsonify({"score": None, "factors": [], "summary": f"AI scoring failed: {type(e).__name__}: {str(e)}"}), 200
