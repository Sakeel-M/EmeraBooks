"""
Multi-pass reconciliation matching engine.
Matches bank transactions against bills (expenses) and invoices (income).
Supports both dual-source and single-source (bank-only) reconciliation.
"""
from flask import Blueprint, request, jsonify
from datetime import datetime

reconciliation_bp = Blueprint('reconciliation', __name__)


def _amount_within_tolerance(a, b, rule):
    """Check if two amounts match within the rule's tolerance."""
    tol_type = rule.get('amount_tolerance_type', 'exact')
    tol_value = float(rule.get('amount_tolerance_value', 0))
    diff = abs(a - b)

    if tol_type == 'exact':
        return diff == 0
    elif tol_type == 'cents':
        return diff <= tol_value
    elif tol_type == 'percent':
        if a == 0:
            return b == 0
        return (diff / abs(a)) * 100 <= tol_value
    elif tol_type == 'fixed':
        return diff <= tol_value
    return False


def _date_within_tolerance(date_a, date_b, days_tolerance):
    """Check if two dates are within N days of each other."""
    if not date_a or not date_b:
        return False
    try:
        da = datetime.strptime(date_a, '%Y-%m-%d') if isinstance(date_a, str) else date_a
        db = datetime.strptime(date_b, '%Y-%m-%d') if isinstance(date_b, str) else date_b
        return abs((da - db).days) <= days_tolerance
    except (ValueError, TypeError):
        return False


def _date_diff_days(date_a, date_b):
    """Return absolute day difference between two date strings."""
    try:
        da = datetime.strptime(date_a, '%Y-%m-%d')
        db = datetime.strptime(date_b, '%Y-%m-%d')
        return abs((da - db).days)
    except (ValueError, TypeError, AttributeError):
        return 0


def _description_similarity(desc_a, desc_b):
    """Simple keyword overlap similarity score (0-1)."""
    if not desc_a or not desc_b:
        return 0.0
    words_a = set(desc_a.lower().split())
    words_b = set(desc_b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union) if union else 0.0


def _name_in_description(name, description):
    """Check if a vendor/customer name appears in a transaction description."""
    if not name or not description:
        return False
    name_lower = name.lower().strip()
    desc_lower = description.lower().strip()
    # Direct substring match
    if name_lower in desc_lower:
        return True
    # Check if all significant words from the name appear in description
    name_words = [w for w in name_lower.split() if len(w) > 2]
    if not name_words:
        return False
    matches = sum(1 for w in name_words if w in desc_lower)
    return matches >= len(name_words) * 0.5


def _classify_txn_type(description):
    """Classify a bank transaction by its description into a human-readable type."""
    if not description:
        return 'unknown', 'Unknown transaction'
    desc = description.upper()

    # UAE banking transaction types
    if 'MOBN' in desc and 'TELEX' in desc:
        return 'wire_transfer', 'Mobile Banking Wire Transfer (MOBN TELEX)'
    if 'MOBN' in desc:
        return 'mobile_transfer', 'Mobile Banking Transfer (MOBN)'
    if 'TELEX' in desc or 'SWIFT' in desc or 'TT ' in desc:
        return 'wire_transfer', 'Wire/SWIFT Transfer'
    if 'IBFT' in desc:
        return 'ibft', 'Instant Bank Fund Transfer (IBFT)'
    if 'ATM' in desc or 'CASH WITHDRAWAL' in desc:
        return 'atm', 'ATM Cash Withdrawal'
    if 'CCDM' in desc or 'CASH DEPOSIT' in desc or 'CDM' in desc:
        return 'cash_deposit', 'Cash/Cheque Deposit (CCDM)'
    if 'UPOS' in desc or 'POS' in desc:
        return 'pos', 'Point of Sale (POS) Purchase'
    if 'SALARY' in desc or 'WPS' in desc:
        return 'salary', 'Salary/WPS Payment'
    if 'SALIK' in desc:
        return 'toll', 'SALIK Road Toll'
    if 'DEWA' in desc:
        return 'utility', 'DEWA Utility Payment'
    if 'ETISALAT' in desc or desc.startswith('E&') or 'DU TELECOM' in desc:
        return 'telecom', 'Telecom Payment'
    if 'RENT' in desc:
        return 'rent', 'Rent Payment'
    if 'VAT' in desc or 'TAX' in desc or 'FTA' in desc:
        return 'tax', 'Tax/VAT Payment'
    if 'LOAN' in desc or 'EMI' in desc or 'MORTGAGE' in desc:
        return 'loan', 'Loan/EMI Payment'
    if 'INSURANCE' in desc:
        return 'insurance', 'Insurance Payment'
    if 'CHARGE' in desc or 'FEE' in desc or 'COMMISSION' in desc:
        return 'bank_fee', 'Bank Charge/Fee'
    if 'INTEREST' in desc:
        return 'interest', 'Interest Credit/Debit'
    if 'REFUND' in desc or 'REVERSAL' in desc:
        return 'refund', 'Refund/Reversal'
    if 'STANDING ORDER' in desc or 'S/O' in desc:
        return 'standing_order', 'Standing Order'
    if 'DIRECT DEBIT' in desc or 'D/D' in desc:
        return 'direct_debit', 'Direct Debit'
    if 'CHEQUE' in desc or 'CHQ' in desc:
        return 'cheque', 'Cheque Payment'
    if 'TRANSFER' in desc or 'TRF' in desc:
        return 'transfer', 'Fund Transfer'
    if any(w in desc for w in ['AMAZON', 'NOON', 'TALABAT', 'CAREEM', 'UBER', 'DELIVEROO']):
        return 'online_purchase', 'Online Purchase'
    if any(w in desc for w in ['ADNOC', 'ENOC', 'EPPCO', 'FUEL', 'PETROL']):
        return 'fuel', 'Fuel Purchase'
    return 'general', 'General Transaction'


def _find_nearest_match(txn, candidates, is_expense=True):
    """Find the closest potential match from candidates, even if below threshold.
    Returns (candidate, score, reasons) or (None, 0, []) if no candidates."""
    txn_amount = abs(float(txn.get('amount', 0)))
    txn_date = txn.get('date', '')
    txn_desc = txn.get('description', '')
    best = None
    best_score = 0
    best_reasons = []

    for c in candidates:
        c_amount = abs(float(c.get('amount', 0)))
        c_date = c.get('date', '')
        c_name = c.get('vendor_name', '') or c.get('customer_name', '') or c.get('description', '')
        score = 0
        reasons = []

        amount_diff = abs(txn_amount - c_amount)
        pct_diff = (amount_diff / txn_amount * 100) if txn_amount > 0 else 0
        if amount_diff == 0:
            score += 50
            reasons.append('Amount: exact match')
        elif amount_diff <= 1.0:
            score += 30
            reasons.append(f'Amount: off by {amount_diff:.2f}')
        elif pct_diff <= 10:
            score += 15
            reasons.append(f'Amount: {pct_diff:.1f}% difference ({amount_diff:.2f})')
        else:
            reasons.append(f'Amount: {pct_diff:.1f}% difference ({amount_diff:.2f}) — too large')

        days = _date_diff_days(txn_date, c_date)
        if days == 0:
            score += 30
            reasons.append('Date: same day')
        elif days <= 3:
            score += 20
            reasons.append(f'Date: {days} day(s) apart')
        elif days <= 7:
            score += 10
            reasons.append(f'Date: {days} days apart')
        elif days <= 30:
            reasons.append(f'Date: {days} days apart — outside tolerance')
        else:
            reasons.append(f'Date: {days} days apart — too far')

        if _name_in_description(c_name, txn_desc):
            score += 20
            reasons.append(f'Name: "{c_name}" found in description')
        else:
            sim = _description_similarity(txn_desc, c_name)
            if sim > 0.2:
                score += sim * 15
                reasons.append(f'Name: partial similarity ({sim:.0%})')
            else:
                reasons.append(f'Name: no match ("{c_name}")')

        if score > best_score:
            best_score = score
            best = c
            best_reasons = reasons

    return best, best_score, best_reasons


def _match_by_rules(txn_amount, txn_date, txn_desc, candidate_amount, candidate_date, candidate_name, rules):
    """
    Evaluate a transaction-candidate pair against user-defined rules.
    Returns (score, reasons, auto_match, rule_name) for the first matching rule,
    or (0, [], False, None) if no rule matches.
    """
    for rule in rules:
        score = 0
        reasons = []
        passes = True

        # Amount check
        if rule.get('match_by_amount', True):
            if _amount_within_tolerance(txn_amount, candidate_amount, rule):
                diff = abs(txn_amount - candidate_amount)
                if diff == 0:
                    score += 50
                    reasons.append('Amount: exact match')
                else:
                    score += 30
                    reasons.append(f'Amount: off by {diff:.2f} (within tolerance)')
            else:
                passes = False

        # Date check
        if passes and rule.get('match_by_date', True):
            days_tol = rule.get('date_tolerance_days', 0)
            if _date_within_tolerance(txn_date, candidate_date, days_tol):
                days_diff = _date_diff_days(txn_date, candidate_date)
                if days_diff == 0:
                    score += 30
                    reasons.append('Date: same day')
                else:
                    score += 20
                    reasons.append(f'Date: {days_diff} day(s) apart')
            else:
                passes = False

        # Description check
        if passes and rule.get('match_by_description', False):
            if _name_in_description(candidate_name, txn_desc):
                score += 20
                reasons.append(f'Description: "{candidate_name}" found')
            else:
                sim = _description_similarity(txn_desc, candidate_name)
                if sim > 0.3:
                    score += int(sim * 15)
                    reasons.append(f'Description: partial similarity ({sim:.0%})')
                else:
                    passes = False

        if passes and score > 0:
            auto = rule.get('auto_match', False)
            reasons.append(f'Rule: {rule.get("name", "unnamed")}')
            return score, reasons, auto, rule.get('name')

    return 0, [], False, None


def reconcile_bank_single_source(bank_txns, bills, invoices, user_rules=None):
    """
    Bank reconciliation for single-source data (all transactions from bank).
    Matches bank transactions against derived bills (expenses) and invoices (income).

    When user_rules are provided, ONLY those rules are used for matching.
    Without user_rules, the default scoring logic applies.

    Args:
        bank_txns: list of dicts {id, date, description, amount, category}
        bills: list of dicts {id, date, description, amount, vendor_name, status}
        invoices: list of dicts {id, date, description, amount, customer_name, status}
        user_rules: optional list of rule dicts sorted by priority

    Returns:
        dict with matched, flagged items, match_rate, total_discrepancy
    """
    matched = []
    flagged = []
    matched_txn_ids = set()
    matched_bill_ids = set()
    matched_invoice_ids = set()
    use_rules = user_rules is not None and len(user_rules) > 0

    # ── Pass 1: Match expense transactions to bills ──────────────────
    expense_txns = [t for t in bank_txns if float(t.get('amount', 0)) < 0]
    income_txns = [t for t in bank_txns if float(t.get('amount', 0)) > 0]

    for txn in expense_txns:
        txn_amount = abs(float(txn.get('amount', 0)))
        txn_date = txn.get('date', '')
        txn_desc = txn.get('description', '')
        best_match = None
        best_score = 0
        best_reasons = []
        best_auto = False

        for bill in bills:
            if bill['id'] in matched_bill_ids:
                continue

            bill_amount = abs(float(bill.get('amount', 0)))
            bill_date = bill.get('date', '')
            bill_vendor = bill.get('vendor_name', '') or bill.get('description', '')

            if use_rules:
                # ── User-defined rules ──
                score, reasons, auto, _ = _match_by_rules(
                    txn_amount, txn_date, txn_desc,
                    bill_amount, bill_date, bill_vendor,
                    user_rules,
                )
            else:
                # ── Default scoring logic ──
                score = 0
                reasons = []
                auto = False

                amount_diff = abs(txn_amount - bill_amount)
                if amount_diff == 0:
                    score += 50
                    reasons.append('Amount: exact match')
                elif amount_diff <= 1.0:
                    score += 30
                    reasons.append(f'Amount: off by {amount_diff:.2f}')
                else:
                    continue  # amounts must be close

                days_diff = _date_diff_days(txn_date, bill_date)
                if days_diff == 0:
                    score += 30
                    reasons.append('Date: same day')
                elif days_diff <= 3:
                    score += 20
                    reasons.append(f'Date: {days_diff} day(s) apart')
                elif days_diff <= 7:
                    score += 10
                    reasons.append(f'Date: {days_diff} days apart')
                else:
                    reasons.append(f'Date: {days_diff} days apart (outside 7-day window)')

                if _name_in_description(bill_vendor, txn_desc):
                    score += 20
                    reasons.append(f'Vendor: "{bill_vendor}" found in description')
                else:
                    sim = _description_similarity(txn_desc, bill_vendor)
                    score += sim * 15
                    if sim > 0.2:
                        reasons.append(f'Vendor: partial similarity ({sim:.0%})')

            if score > best_score:
                best_score = score
                best_match = bill
                best_reasons = reasons
                best_auto = auto

        if best_match and best_score >= 50:
            bill_amount = abs(float(best_match.get('amount', 0)))
            diff = round(txn_amount - bill_amount, 2)
            days = _date_diff_days(txn_date, best_match.get('date', ''))
            quality = 'exact' if diff == 0 and days == 0 else 'near'

            matched.append({
                'source_a_id': txn['id'],
                'source_a_date': txn_date,
                'source_a_desc': txn_desc,
                'source_a_amount': float(txn.get('amount', 0)),
                'source_b_id': best_match['id'],
                'source_b_date': best_match.get('date'),
                'source_b_desc': best_match.get('vendor_name') or best_match.get('description', ''),
                'source_b_amount': -bill_amount,  # negate to show expense
                'status': 'matched',
                'match_quality': quality,
                'flag_type': 'matched',
                'difference': diff,
                'days_diff': days,
                'reason': ' | '.join(best_reasons),
            })
            matched_txn_ids.add(txn['id'])
            matched_bill_ids.add(best_match['id'])

    # ── Pass 2: Match income transactions to invoices ────────────────
    for txn in income_txns:
        txn_amount = float(txn.get('amount', 0))
        txn_date = txn.get('date', '')
        txn_desc = txn.get('description', '')
        best_match = None
        best_score = 0
        best_reasons = []
        best_auto = False

        for inv in invoices:
            if inv['id'] in matched_invoice_ids:
                continue

            inv_amount = abs(float(inv.get('amount', 0)))
            inv_date = inv.get('date', '')
            inv_customer = inv.get('customer_name', '') or inv.get('description', '')

            if use_rules:
                # ── User-defined rules ──
                score, reasons, auto, _ = _match_by_rules(
                    txn_amount, txn_date, txn_desc,
                    inv_amount, inv_date, inv_customer,
                    user_rules,
                )
            else:
                # ── Default scoring logic ──
                score = 0
                reasons = []
                auto = False

                # Amount match
                amount_diff = abs(txn_amount - inv_amount)
                if amount_diff == 0:
                    score += 50
                    reasons.append('Amount: exact match')
                elif amount_diff <= 1.0:
                    score += 30
                    reasons.append(f'Amount: off by {amount_diff:.2f}')
                else:
                    continue

                # Date match
                days_diff = _date_diff_days(txn_date, inv_date)
                if days_diff == 0:
                    score += 30
                    reasons.append('Date: same day')
                elif days_diff <= 3:
                    score += 20
                    reasons.append(f'Date: {days_diff} day(s) apart')
                elif days_diff <= 7:
                    score += 10
                    reasons.append(f'Date: {days_diff} days apart')

                # Description match
                if _name_in_description(inv_customer, txn_desc):
                    score += 20
                    reasons.append(f'Customer: "{inv_customer}" found in description')
                else:
                    sim = _description_similarity(txn_desc, inv_customer)
                    score += sim * 15
                    if sim > 0.2:
                        reasons.append(f'Customer: partial similarity ({sim:.0%})')

            if score > best_score:
                best_score = score
                best_match = inv
                best_reasons = reasons
                best_auto = auto

        if best_match and best_score >= 50:
            inv_amount = abs(float(best_match.get('amount', 0)))
            diff = round(txn_amount - inv_amount, 2)
            days = _date_diff_days(txn_date, best_match.get('date', ''))
            quality = 'exact' if diff == 0 and days == 0 else 'near'

            matched.append({
                'source_a_id': txn['id'],
                'source_a_date': txn_date,
                'source_a_desc': txn_desc,
                'source_a_amount': float(txn.get('amount', 0)),
                'source_b_id': best_match['id'],
                'source_b_date': best_match.get('date'),
                'source_b_desc': best_match.get('customer_name') or best_match.get('description', ''),
                'source_b_amount': inv_amount,
                'status': 'matched',
                'match_quality': quality,
                'flag_type': 'matched',
                'difference': diff,
                'days_diff': days,
                'reason': ' | '.join(best_reasons),
            })
            matched_txn_ids.add(txn['id'])
            matched_invoice_ids.add(best_match['id'])

    # ── Pass 3: Flag unmatched transactions ──────────────────────────
    # Collect all amounts by date for duplicate detection
    amounts_by_date = {}
    for txn in bank_txns:
        key = (txn.get('date', ''), round(abs(float(txn.get('amount', 0))), 2))
        amounts_by_date.setdefault(key, []).append(txn['id'])

    duplicate_ids = set()
    for key, ids in amounts_by_date.items():
        if len(ids) > 1:
            for tid in ids:
                duplicate_ids.add(tid)

    # Build remaining (unmatched) bills/invoices for nearest-match search
    remaining_bills = [b for b in bills if b['id'] not in matched_bill_ids]
    remaining_invoices = [i for i in invoices if i['id'] not in matched_invoice_ids]

    for txn in bank_txns:
        if txn['id'] in matched_txn_ids:
            continue

        txn_amount = float(txn.get('amount', 0))
        abs_amount = abs(txn_amount)
        txn_desc = txn.get('description', '')
        flag_types = []

        # Classify transaction type
        txn_type, txn_type_label = _classify_txn_type(txn_desc)

        # Determine primary flag type
        if txn_amount < 0:
            flag_types.append('missing_bill')
        elif txn_amount > 0:
            flag_types.append('missing_invoice')

        # Secondary flags
        if txn['id'] in duplicate_ids:
            flag_types.append('duplicate_suspect')

        if abs_amount >= 10000:
            flag_types.append('large_transaction')
        elif abs_amount >= 5000 and abs_amount % 1000 == 0:
            flag_types.append('round_amount')
        elif abs_amount >= 1000 and abs_amount % 100 == 0:
            flag_types.append('round_amount')

        # Use the most specific flag type
        if 'duplicate_suspect' in flag_types:
            primary_flag = 'duplicate_suspect'
        elif 'large_transaction' in flag_types:
            primary_flag = 'large_transaction'
        elif 'round_amount' in flag_types:
            primary_flag = 'round_amount'
        elif 'missing_bill' in flag_types:
            primary_flag = 'missing_bill'
        elif 'missing_invoice' in flag_types:
            primary_flag = 'missing_invoice'
        else:
            primary_flag = 'unmatched'

        # Find nearest potential match for context
        nearest = None
        nearest_score = 0
        nearest_reasons = []
        if txn_amount < 0 and remaining_bills:
            nearest, nearest_score, nearest_reasons = _find_nearest_match(
                txn, remaining_bills, is_expense=True)
        elif txn_amount > 0 and remaining_invoices:
            nearest, nearest_score, nearest_reasons = _find_nearest_match(
                txn, remaining_invoices, is_expense=False)

        # Build detailed reason
        reason_parts = [f'Transaction type: {txn_type_label}']
        if primary_flag == 'duplicate_suspect':
            dup_count = len(amounts_by_date.get(
                (txn.get('date', ''), round(abs_amount, 2)), []))
            reason_parts.append(
                f'Found {dup_count} transactions with same amount ({abs_amount:.2f}) on same date')
        if primary_flag == 'large_transaction':
            reason_parts.append(f'Amount ({abs_amount:,.2f}) exceeds 10,000 threshold')
        if primary_flag == 'round_amount':
            reason_parts.append(f'Round amount ({abs_amount:,.2f}) may indicate estimate or transfer')

        if txn_amount < 0:
            reason_parts.append(
                f'Searched {len(bills)} bills — {len(remaining_bills)} unmatched bills available')
        else:
            reason_parts.append(
                f'Searched {len(invoices)} invoices — {len(remaining_invoices)} unmatched invoices available')

        if nearest and nearest_score > 0:
            n_name = nearest.get('vendor_name', '') or nearest.get('customer_name', '') or nearest.get('description', '')
            n_amount = abs(float(nearest.get('amount', 0)))
            reason_parts.append(
                f'Closest potential match: "{n_name}" for {n_amount:,.2f} (score: {nearest_score}/100)')
            reason_parts.extend(nearest_reasons)
        else:
            reason_parts.append('No potential matches found in the ledger')

        flagged.append({
            'source_a_id': txn['id'],
            'source_a_date': txn.get('date'),
            'source_a_desc': txn_desc,
            'source_a_amount': txn_amount,
            'source_b_id': nearest['id'] if nearest and nearest_score >= 30 else None,
            'source_b_date': nearest.get('date') if nearest and nearest_score >= 30 else None,
            'source_b_desc': (nearest.get('vendor_name') or nearest.get('customer_name') or nearest.get('description', '')) if nearest and nearest_score >= 30 else None,
            'source_b_amount': -abs(float(nearest.get('amount', 0))) if nearest and nearest_score >= 30 and txn_amount < 0 else (abs(float(nearest.get('amount', 0))) if nearest and nearest_score >= 30 else None),
            'status': 'flagged',
            'flag_type': primary_flag,
            'difference': txn_amount,
            'days_diff': 0,
            'reason': ' | '.join(reason_parts),
            'txn_type': txn_type,
            'txn_type_label': txn_type_label,
        })

    # ── Pass 4: Flag unmatched bills/invoices ────────────────────────
    for bill in bills:
        if bill['id'] not in matched_bill_ids:
            bill_amount = -abs(float(bill.get('amount', 0)))
            vendor = bill.get('vendor_name', '') or bill.get('description', '')
            reason = (
                f'Bill from "{vendor}" for {abs(bill_amount):,.2f} has no matching bank transaction. '
                f'This may indicate an unpaid bill, a payment via cash/cheque, '
                f'or a payment outside the reconciliation period.'
            )
            flagged.append({
                'source_a_id': None,
                'source_a_date': None,
                'source_a_desc': None,
                'source_a_amount': None,
                'source_b_id': bill['id'],
                'source_b_date': bill.get('date'),
                'source_b_desc': vendor,
                'source_b_amount': bill_amount,
                'status': 'flagged',
                'flag_type': 'missing_in_bank',
                'difference': bill_amount,
                'days_diff': 0,
                'reason': reason,
            })

    for inv in invoices:
        if inv['id'] not in matched_invoice_ids:
            inv_amount = abs(float(inv.get('amount', 0)))
            customer = inv.get('customer_name', '') or inv.get('description', '')
            reason = (
                f'Invoice to "{customer}" for {inv_amount:,.2f} has no matching bank deposit. '
                f'This may indicate an unpaid invoice, a cash payment not deposited, '
                f'or a receipt outside the reconciliation period.'
            )
            flagged.append({
                'source_a_id': None,
                'source_a_date': None,
                'source_a_desc': None,
                'source_a_amount': None,
                'source_b_id': inv['id'],
                'source_b_date': inv.get('date'),
                'source_b_desc': customer,
                'source_b_amount': inv_amount,
                'status': 'flagged',
                'flag_type': 'missing_in_bank',
                'difference': inv_amount,
                'days_diff': 0,
                'reason': reason,
            })

    total = len(matched) + len(flagged)
    match_rate = round((len(matched) / total * 100), 2) if total > 0 else 0
    total_discrepancy = round(
        sum(abs(m['difference']) for m in matched) +
        sum(abs(f['difference'] or 0) for f in flagged),
        2
    )

    return {
        'matched': matched,
        'flagged': flagged,
        'match_count': len(matched),
        'flag_count': len(flagged),
        'match_rate': match_rate,
        'total_discrepancy': total_discrepancy,
    }


def reconcile_transactions(source_a, source_b, rules):
    """
    Multi-pass reconciliation engine for dual-source matching.

    Args:
        source_a: list of dicts with keys: id, date, description, amount
        source_b: list of dicts with keys: id, date, description, amount
        rules: list of matching rule dicts, sorted by priority (lowest first)

    Returns:
        dict with matched, flagged items, match_rate, total_discrepancy
    """
    matched = []
    matched_a_ids = set()
    matched_b_ids = set()

    sorted_rules = sorted(rules, key=lambda r: r.get('priority', 100))

    for rule in sorted_rules:
        if not rule.get('is_active', True):
            continue

        match_amount = rule.get('match_by_amount', True)
        match_date = rule.get('match_by_date', True)
        match_desc = rule.get('match_by_description', False)
        match_sign = rule.get('match_sign', True)
        date_tol = rule.get('date_tolerance_days', 3)

        for item_a in source_a:
            if item_a['id'] in matched_a_ids:
                continue

            best_match = None
            best_score = 0

            for item_b in source_b:
                if item_b['id'] in matched_b_ids:
                    continue

                score = 0
                checks_passed = 0
                checks_total = 0

                # Amount check
                if match_amount:
                    checks_total += 1
                    a_amt = float(item_a.get('amount', 0))
                    b_amt = float(item_b.get('amount', 0))
                    if match_sign:
                        b_amt = -b_amt
                    if _amount_within_tolerance(a_amt, b_amt, rule):
                        checks_passed += 1
                        score += 40
                    else:
                        continue

                # Date check
                if match_date:
                    checks_total += 1
                    if _date_within_tolerance(item_a.get('date'), item_b.get('date'), date_tol):
                        checks_passed += 1
                        days = _date_diff_days(item_a.get('date', ''), item_b.get('date', ''))
                        score += max(0, 30 - days * 5)
                    else:
                        continue

                # Description check (optional, adds to score)
                if match_desc:
                    checks_total += 1
                    sim = _description_similarity(
                        item_a.get('description', ''),
                        item_b.get('description', '')
                    )
                    if sim > 0.3:
                        checks_passed += 1
                        score += sim * 30

                if checks_passed == checks_total and score > best_score:
                    best_match = item_b
                    best_score = score

            if best_match:
                a_amt = float(item_a.get('amount', 0))
                b_amt = float(best_match.get('amount', 0))
                b_amt_compare = -b_amt if match_sign else b_amt
                diff = round(a_amt - b_amt_compare, 2)
                days_diff = _date_diff_days(item_a.get('date', ''), best_match.get('date', ''))
                quality = 'exact' if diff == 0 and days_diff == 0 else 'near'

                matched.append({
                    'source_a_id': item_a['id'],
                    'source_a_date': item_a.get('date'),
                    'source_a_desc': item_a.get('description', ''),
                    'source_a_amount': float(item_a.get('amount', 0)),
                    'source_b_id': best_match['id'],
                    'source_b_date': best_match.get('date'),
                    'source_b_desc': best_match.get('description', ''),
                    'source_b_amount': float(best_match.get('amount', 0)),
                    'status': 'matched',
                    'match_quality': quality,
                    'flag_type': 'matched',
                    'difference': diff,
                    'days_diff': days_diff,
                })
                matched_a_ids.add(item_a['id'])
                matched_b_ids.add(best_match['id'])

    # Unmatched items -> flagged
    flagged = []
    for item_a in source_a:
        if item_a['id'] not in matched_a_ids:
            flagged.append({
                'source_a_id': item_a['id'],
                'source_a_date': item_a.get('date'),
                'source_a_desc': item_a.get('description', ''),
                'source_a_amount': float(item_a.get('amount', 0)),
                'source_b_id': None, 'source_b_date': None,
                'source_b_desc': None, 'source_b_amount': None,
                'status': 'flagged',
                'flag_type': 'missing_in_source_b',
                'difference': float(item_a.get('amount', 0)),
                'days_diff': 0,
            })

    for item_b in source_b:
        if item_b['id'] not in matched_b_ids:
            flagged.append({
                'source_a_id': None, 'source_a_date': None,
                'source_a_desc': None, 'source_a_amount': None,
                'source_b_id': item_b['id'],
                'source_b_date': item_b.get('date'),
                'source_b_desc': item_b.get('description', ''),
                'source_b_amount': float(item_b.get('amount', 0)),
                'status': 'flagged',
                'flag_type': 'missing_in_source_a',
                'difference': float(item_b.get('amount', 0)),
                'days_diff': 0,
            })

    total = len(matched) + len(flagged)
    match_rate = round((len(matched) / total * 100), 2) if total > 0 else 0
    total_discrepancy = round(
        sum(abs(m['difference']) for m in matched) +
        sum(abs(f['difference'] or 0) for f in flagged),
        2
    )

    return {
        'matched': matched,
        'flagged': flagged,
        'match_count': len(matched),
        'flag_count': len(flagged),
        'match_rate': match_rate,
        'total_discrepancy': total_discrepancy,
    }


@reconciliation_bp.route('/api/reconcile', methods=['POST'])
def reconcile():
    """Run reconciliation matching between two transaction sets."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        source_a = data.get('source_a_transactions', [])
        source_b = data.get('source_b_transactions', [])
        bills = data.get('bills', [])
        invoices = data.get('invoices', [])
        rules = data.get('rules', [])

        # If bills/invoices provided, use single-source bank reconciliation
        if bills or invoices:
            # Pass user-defined rules if any — engine uses them instead of defaults
            active_rules = [r for r in rules if r.get('is_active', True)]
            active_rules.sort(key=lambda r: r.get('priority', 999))
            result = reconcile_bank_single_source(source_a, bills, invoices, active_rules if active_rules else None)
            return jsonify(result)

        if not source_a and not source_b:
            return jsonify({'error': 'At least one source must have transactions'}), 400

        if not rules:
            rules = [{
                'priority': 1, 'is_active': True,
                'match_by_amount': True, 'match_by_date': True,
                'match_by_description': False, 'match_sign': True,
                'amount_tolerance_type': 'exact', 'amount_tolerance_value': 0,
                'date_tolerance_days': 3,
            }]

        result = reconcile_transactions(source_a, source_b, rules)
        return jsonify(result)

    except Exception as e:
        return jsonify({'error': f'Reconciliation failed: {str(e)}'}), 500
