"""Tier 1: Data Sources & Integrations models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID, JSONB
from models.base import db

INTEGRATION_TYPES = ("erp", "bank_api", "bank_upload", "pos", "crm", "inventory", "payroll")
CONNECTION_STATUSES = ("connected", "disconnected", "error", "pending", "revoked")


class Connection(db.Model):
    __tablename__ = "v2_connections"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(db.Text, nullable=False)
    provider = db.Column(db.Text, nullable=False)
    display_name = db.Column(db.Text, nullable=False)
    status = db.Column(db.Text, nullable=False, default="pending")
    credentials = db.Column(JSONB, default={})
    config = db.Column(JSONB, default={})
    last_sync_at = db.Column(db.DateTime(timezone=True))
    last_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "type": self.type,
            "provider": self.provider,
            "display_name": self.display_name,
            "status": self.status,
            "credentials": {},  # Never expose secrets to frontend
            "config": self.config,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class SyncRun(db.Model):
    __tablename__ = "v2_sync_runs"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_connections.id", ondelete="CASCADE"), nullable=False)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    status = db.Column(db.Text, nullable=False, default="running")
    records_fetched = db.Column(db.Integer, default=0)
    records_created = db.Column(db.Integer, default=0)
    records_updated = db.Column(db.Integer, default=0)
    error_log = db.Column(JSONB, default=[])
    started_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = db.Column(db.DateTime(timezone=True))

    def to_dict(self):
        return {
            "id": str(self.id),
            "connection_id": str(self.connection_id),
            "client_id": str(self.client_id),
            "status": self.status,
            "records_fetched": self.records_fetched,
            "records_created": self.records_created,
            "records_updated": self.records_updated,
            "error_log": self.error_log,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class BankAccount(db.Model):
    __tablename__ = "v2_bank_accounts"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    connection_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_connections.id", ondelete="SET NULL"))
    account_name = db.Column(db.Text, nullable=False)
    account_number = db.Column(db.Text)
    bank_name = db.Column(db.Text, nullable=False)
    bank_code = db.Column(db.Text)
    currency = db.Column(db.Text, nullable=False, default="AED")
    current_balance = db.Column(db.Numeric(18, 2), default=0)
    last_statement_date = db.Column(db.Date)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "connection_id": str(self.connection_id) if self.connection_id else None,
            "account_name": self.account_name,
            "account_number": self.account_number,
            "bank_name": self.bank_name,
            "bank_code": self.bank_code,
            "currency": self.currency,
            "current_balance": float(self.current_balance) if self.current_balance else 0,
            "last_statement_date": self.last_statement_date.isoformat() if self.last_statement_date else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UploadedFile(db.Model):
    __tablename__ = "v2_uploaded_files"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_bank_accounts.id", ondelete="SET NULL"))
    uploaded_by = db.Column(UUID(as_uuid=True), nullable=False)
    file_name = db.Column(db.Text, nullable=False)
    file_hash = db.Column(db.Text)
    file_size_bytes = db.Column(db.Integer)
    bank_name = db.Column(db.Text)
    currency = db.Column(db.Text)
    total_rows = db.Column(db.Integer, default=0)
    period_start = db.Column(db.Date)
    period_end = db.Column(db.Date)
    processing_status = db.Column(db.Text, nullable=False, default="pending")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "bank_account_id": str(self.bank_account_id) if self.bank_account_id else None,
            "uploaded_by": str(self.uploaded_by),
            "file_name": self.file_name,
            "file_hash": self.file_hash,
            "file_size_bytes": self.file_size_bytes,
            "bank_name": self.bank_name,
            "currency": self.currency,
            "total_rows": self.total_rows,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "processing_status": self.processing_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
