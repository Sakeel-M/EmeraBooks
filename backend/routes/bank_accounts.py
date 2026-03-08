"""Bank accounts CRUD routes."""
import uuid
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import require_client_access
from models.base import db
from models.tier1 import BankAccount

bank_accounts_bp = Blueprint("bank_accounts", __name__, url_prefix="/api")


@bank_accounts_bp.route("/clients/<client_id>/bank-accounts", methods=["GET"])
@require_auth
@require_client_access
def get_bank_accounts(client_id):
    accounts = (
        BankAccount.query
        .filter_by(client_id=uuid.UUID(client_id))
        .order_by(BankAccount.bank_name)
        .all()
    )
    return jsonify([a.to_dict() for a in accounts])


@bank_accounts_bp.route("/clients/<client_id>/bank-accounts", methods=["POST"])
@require_auth
@require_client_access
def create_bank_account(client_id):
    data = request.get_json()
    account = BankAccount(
        client_id=uuid.UUID(client_id),
        account_name=data.get("account_name"),
        bank_name=data.get("bank_name"),
        account_number=data.get("account_number"),
        currency=data.get("currency", "AED"),
        current_balance=data.get("current_balance", 0),
    )
    db.session.add(account)
    db.session.commit()
    return jsonify(account.to_dict()), 201
