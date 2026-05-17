"""Manual journal entries — create, list, edit, delete double-entry journals."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from flask import Blueprint, request, jsonify
from auth import require_auth
from permissions import require_client_access, user_has_client_access, get_effective_client_ids
from models.base import db
from models.tier2 import Account
from models.journal import JournalEntry, JournalEntryLine

journal_entries_bp = Blueprint("journal_entries", __name__, url_prefix="/api")


def _validate_lines(client_id, lines):
    """Returns (error_str | None, normalized_lines)."""
    if not isinstance(lines, list) or len(lines) < 2:
        return "A journal entry must have at least 2 lines", None
    total_debit = Decimal(0)
    total_credit = Decimal(0)
    normalized = []
    for idx, ln in enumerate(lines):
        try:
            account_id = uuid.UUID(ln["account_id"])
        except (KeyError, ValueError, TypeError):
            return f"Line {idx + 1}: invalid or missing account_id", None
        debit = Decimal(str(ln.get("debit") or 0))
        credit = Decimal(str(ln.get("credit") or 0))
        if debit < 0 or credit < 0:
            return f"Line {idx + 1}: amounts must be non-negative", None
        if debit > 0 and credit > 0:
            return f"Line {idx + 1}: a line cannot have both debit and credit", None
        if debit == 0 and credit == 0:
            return f"Line {idx + 1}: must have either a debit or credit amount", None
        # Verify the account belongs to this client (or its sub-clients)
        acct = Account.query.filter_by(id=account_id).first()
        if not acct or not user_has_client_access(acct.client_id):
            return f"Line {idx + 1}: account not found or not accessible", None
        normalized.append({
            "account_id": account_id,
            "debit": debit,
            "credit": credit,
            "description": ln.get("description") or None,
            "line_order": int(ln.get("line_order") or idx),
        })
        total_debit += debit
        total_credit += credit
    if total_debit != total_credit:
        return f"Entry is not balanced: debits={total_debit}, credits={total_credit}", None
    if total_debit == 0:
        return "Entry total is zero", None
    return None, normalized


@journal_entries_bp.route("/clients/<client_id>/journal-entries", methods=["GET"])
@require_auth
@require_client_access
def list_journal_entries(client_id):
    cids = get_effective_client_ids(client_id)
    query = JournalEntry.query.filter(JournalEntry.client_id.in_(cids))
    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    account_id = request.args.get("account_id")
    if account_id:
        try:
            aid = uuid.UUID(account_id)
            query = query.join(JournalEntryLine).filter(JournalEntryLine.account_id == aid)
        except (ValueError, TypeError):
            pass
    entries = query.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc()).all()
    return jsonify([e.to_dict() for e in entries])


@journal_entries_bp.route("/clients/<client_id>/journal-entries", methods=["POST"])
@require_auth
@require_client_access
def create_journal_entry(client_id):
    cid = uuid.UUID(client_id)
    data = request.get_json() or {}
    lines = data.get("lines") or []
    err, normalized = _validate_lines(cid, lines)
    if err:
        return jsonify({"error": err}), 400

    entry_date = data.get("entry_date") or datetime.now(timezone.utc).date().isoformat()
    entry = JournalEntry(
        client_id=cid,
        entry_date=entry_date,
        description=data.get("description"),
        reference=data.get("reference"),
        currency=data.get("currency", "AED"),
        source=data.get("source", "manual"),
        metadata_=data.get("metadata") or {},
    )
    db.session.add(entry)
    db.session.flush()
    for ln in normalized:
        db.session.add(JournalEntryLine(
            journal_entry_id=entry.id,
            account_id=ln["account_id"],
            debit=ln["debit"],
            credit=ln["credit"],
            description=ln["description"],
            line_order=ln["line_order"],
        ))
    db.session.commit()
    return jsonify(entry.to_dict()), 201


@journal_entries_bp.route("/journal-entries/<entry_id>", methods=["PATCH"])
@require_auth
def update_journal_entry(entry_id):
    entry = JournalEntry.query.get(uuid.UUID(entry_id))
    if not entry:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(entry.client_id):
        return jsonify({"error": "Access denied"}), 403
    data = request.get_json() or {}

    if "entry_date" in data:
        entry.entry_date = data["entry_date"]
    if "description" in data:
        entry.description = data["description"]
    if "reference" in data:
        entry.reference = data["reference"]
    if "currency" in data:
        entry.currency = data["currency"]
    if "metadata" in data and isinstance(data["metadata"], dict):
        merged = dict(entry.metadata_ or {})
        merged.update(data["metadata"])
        entry.metadata_ = merged

    if "lines" in data:
        err, normalized = _validate_lines(entry.client_id, data["lines"])
        if err:
            return jsonify({"error": err}), 400
        # Replace lines wholesale
        for old in list(entry.lines):
            db.session.delete(old)
        db.session.flush()
        for ln in normalized:
            db.session.add(JournalEntryLine(
                journal_entry_id=entry.id,
                account_id=ln["account_id"],
                debit=ln["debit"],
                credit=ln["credit"],
                description=ln["description"],
                line_order=ln["line_order"],
            ))

    db.session.commit()
    return jsonify(entry.to_dict())


@journal_entries_bp.route("/journal-entries/<entry_id>", methods=["DELETE"])
@require_auth
def delete_journal_entry(entry_id):
    entry = JournalEntry.query.get(uuid.UUID(entry_id))
    if not entry:
        return jsonify({"error": "Not found"}), 404
    if not user_has_client_access(entry.client_id):
        return jsonify({"error": "Access denied"}), 403
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"ok": True})
