"""Uploaded files CRUD routes."""
import uuid
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from permissions import require_client_access
from models.base import db
from models.tier1 import UploadedFile, BankAccount
from models.tier2 import Transaction, Bill, Invoice, Vendor, Customer
from models.tier4 import RiskAlert

files_bp = Blueprint("files", __name__, url_prefix="/api")


@files_bp.route("/clients/<client_id>/files", methods=["GET"])
@require_auth
@require_client_access
def get_uploaded_files(client_id):
    from permissions import get_effective_client_ids
    cids = get_effective_client_ids(client_id)
    files = (
        UploadedFile.query
        .filter(UploadedFile.client_id.in_(cids))
        .order_by(UploadedFile.created_at.desc())
        .all()
    )
    return jsonify([f.to_dict() for f in files])


@files_bp.route("/clients/<client_id>/files", methods=["POST"])
@require_auth
@require_client_access
def save_uploaded_file(client_id):
    data = request.get_json()
    f = UploadedFile(
        client_id=uuid.UUID(client_id),
        uploaded_by=uuid.UUID(g.user_id),
        file_name=data.get("file_name"),
        bank_name=data.get("bank_name"),
        currency=data.get("currency"),
        total_rows=data.get("total_rows", 0),
        processing_status="completed",
    )
    db.session.add(f)
    db.session.commit()
    return jsonify(f.to_dict()), 201


@files_bp.route("/clients/<client_id>/files/<file_id>", methods=["PATCH"])
@require_auth
@require_client_access
def update_uploaded_file(client_id, file_id):
    """Update file metadata (currency, bank_name, file_name)."""
    cid = uuid.UUID(client_id)
    fid = uuid.UUID(file_id)
    file_record = UploadedFile.query.filter_by(id=fid, client_id=cid).first()
    if not file_record:
        return jsonify({"error": "File not found"}), 404
    data = request.get_json()
    for key in ("currency", "bank_name", "file_name"):
        if key in data:
            setattr(file_record, key, data[key])
    db.session.commit()
    return jsonify(file_record.to_dict())


@files_bp.route("/clients/<client_id>/files/<file_id>", methods=["DELETE"])
@require_auth
@require_client_access
def delete_uploaded_file(client_id, file_id):
    """Delete an uploaded file and all derived data (transactions, bills, invoices, etc.)."""
    cid = uuid.UUID(client_id)
    fid = uuid.UUID(file_id)

    # Verify file belongs to this client
    file_record = UploadedFile.query.filter_by(id=fid, client_id=cid).first()
    if not file_record:
        return jsonify({"error": "File not found"}), 404

    fid_str = str(fid)

    # Delete derived data created by sync pipeline (source_ref = file_id)
    Bill.query.filter_by(client_id=cid, source="bank_upload", source_ref=fid_str).delete()
    Invoice.query.filter_by(client_id=cid, source="bank_upload", source_ref=fid_str).delete()

    # Delete risk alerts for this client (generated from file data)
    RiskAlert.query.filter_by(client_id=cid).delete()

    # Delete transactions for this file
    Transaction.query.filter_by(client_id=cid, file_id=fid).delete()

    # Check if client has any remaining files — if not, clean up vendors/customers/bank accounts
    remaining_files = UploadedFile.query.filter(
        UploadedFile.client_id == cid,
        UploadedFile.id != fid,
    ).count()
    if remaining_files == 0:
        Vendor.query.filter_by(client_id=cid).delete()
        Customer.query.filter_by(client_id=cid).delete()
        BankAccount.query.filter_by(client_id=cid).delete()

    # Delete the file record itself
    db.session.delete(file_record)
    db.session.commit()

    return jsonify({"deleted": True, "file_id": fid_str})
