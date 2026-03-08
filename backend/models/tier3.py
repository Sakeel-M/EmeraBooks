"""Tier 3: Reconciliation Engine models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID
from models.base import db


class ReconciliationSession(db.Model):
    __tablename__ = "v2_reconciliation_sessions"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_bank_accounts.id"))
    recon_type = db.Column(db.Text, nullable=False, default="bank")
    source_a = db.Column(db.Text, nullable=False)
    source_b = db.Column(db.Text, nullable=False)
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    status = db.Column(db.Text, nullable=False, default="in_progress")
    statement_ending_balance = db.Column(db.Numeric(18, 2))
    ledger_ending_balance = db.Column(db.Numeric(18, 2))
    unreconciled_difference = db.Column(db.Numeric(18, 2), default=0)
    match_count = db.Column(db.Integer, default=0)
    flag_count = db.Column(db.Integer, default=0)
    match_rate = db.Column(db.Numeric(5, 2), default=0)
    finalized_by = db.Column(UUID(as_uuid=True))
    finalized_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items = db.relationship("ReconciliationItem", backref="session", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "bank_account_id": str(self.bank_account_id) if self.bank_account_id else None,
            "recon_type": self.recon_type,
            "source_a": self.source_a,
            "source_b": self.source_b,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "status": self.status,
            "statement_ending_balance": float(self.statement_ending_balance) if self.statement_ending_balance else None,
            "ledger_ending_balance": float(self.ledger_ending_balance) if self.ledger_ending_balance else None,
            "unreconciled_difference": float(self.unreconciled_difference) if self.unreconciled_difference else 0,
            "match_count": self.match_count,
            "flag_count": self.flag_count,
            "match_rate": float(self.match_rate) if self.match_rate else 0,
            "finalized_by": str(self.finalized_by) if self.finalized_by else None,
            "finalized_at": self.finalized_at.isoformat() if self.finalized_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ReconciliationItem(db.Model):
    __tablename__ = "v2_reconciliation_items"
    __table_args__ = (
        db.Index("idx_v2_recon_items_session", "session_id", "status"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_reconciliation_sessions.id", ondelete="CASCADE"), nullable=False)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    source_a_id = db.Column(UUID(as_uuid=True))
    source_a_date = db.Column(db.Date)
    source_a_desc = db.Column(db.Text)
    source_a_amount = db.Column(db.Numeric(18, 2))
    source_b_id = db.Column(UUID(as_uuid=True))
    source_b_date = db.Column(db.Date)
    source_b_desc = db.Column(db.Text)
    source_b_amount = db.Column(db.Numeric(18, 2))
    status = db.Column(db.Text, nullable=False, default="flagged")
    match_quality = db.Column(db.Text)
    flag_type = db.Column(db.Text)
    difference = db.Column(db.Numeric(18, 2), default=0)
    days_diff = db.Column(db.Integer, default=0)
    resolution = db.Column(db.Text)
    resolved_by = db.Column(UUID(as_uuid=True))
    resolved_at = db.Column(db.DateTime(timezone=True))
    reason = db.Column(db.Text)
    txn_type = db.Column(db.Text)
    txn_type_label = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "client_id": str(self.client_id),
            "source_a_id": str(self.source_a_id) if self.source_a_id else None,
            "source_a_date": self.source_a_date.isoformat() if self.source_a_date else None,
            "source_a_desc": self.source_a_desc,
            "source_a_amount": float(self.source_a_amount) if self.source_a_amount is not None else None,
            "source_b_id": str(self.source_b_id) if self.source_b_id else None,
            "source_b_date": self.source_b_date.isoformat() if self.source_b_date else None,
            "source_b_desc": self.source_b_desc,
            "source_b_amount": float(self.source_b_amount) if self.source_b_amount is not None else None,
            "status": self.status,
            "match_quality": self.match_quality,
            "flag_type": self.flag_type,
            "difference": float(self.difference) if self.difference is not None else 0,
            "days_diff": self.days_diff,
            "resolution": self.resolution,
            "resolved_by": str(self.resolved_by) if self.resolved_by else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "reason": self.reason,
            "txn_type": self.txn_type,
            "txn_type_label": self.txn_type_label,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class MatchingRule(db.Model):
    __tablename__ = "v2_matching_rules"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    recon_type = db.Column(db.Text, nullable=False, default="bank")
    priority = db.Column(db.Integer, nullable=False, default=100)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    match_by_amount = db.Column(db.Boolean, nullable=False, default=True)
    match_by_date = db.Column(db.Boolean, nullable=False, default=True)
    match_by_description = db.Column(db.Boolean, nullable=False, default=False)
    match_sign = db.Column(db.Boolean, nullable=False, default=True)
    amount_tolerance_type = db.Column(db.Text, nullable=False, default="exact")
    amount_tolerance_value = db.Column(db.Numeric(10, 4), default=0)
    date_tolerance_days = db.Column(db.Integer, nullable=False, default=3)
    auto_match = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "name": self.name,
            "description": self.description,
            "recon_type": self.recon_type,
            "priority": self.priority,
            "is_active": self.is_active,
            "match_by_amount": self.match_by_amount,
            "match_by_date": self.match_by_date,
            "match_by_description": self.match_by_description,
            "match_sign": self.match_sign,
            "amount_tolerance_type": self.amount_tolerance_type,
            "amount_tolerance_value": float(self.amount_tolerance_value) if self.amount_tolerance_value is not None else 0,
            "date_tolerance_days": self.date_tolerance_days,
            "auto_match": self.auto_match,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
