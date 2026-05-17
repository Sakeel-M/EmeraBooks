"""Manual journal entries — double-entry bookkeeping."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID, JSONB
from models.base import db


class JournalEntry(db.Model):
    __tablename__ = "v2_journal_entries"
    __table_args__ = (
        db.Index("idx_v2_journal_entries_client_date", "client_id", "entry_date"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    entry_date = db.Column(db.Date, nullable=False)
    description = db.Column(db.Text)
    reference = db.Column(db.Text)
    currency = db.Column(db.Text, nullable=False, default="AED")
    source = db.Column(db.Text, nullable=False, default="manual")
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    lines = db.relationship("JournalEntryLine", backref="entry", cascade="all, delete-orphan", order_by="JournalEntryLine.line_order")

    def to_dict(self):
        line_dicts = [l.to_dict() for l in self.lines]
        total_debit = sum(l.get("debit", 0) for l in line_dicts)
        total_credit = sum(l.get("credit", 0) for l in line_dicts)
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "entry_date": self.entry_date.isoformat() if self.entry_date else None,
            "description": self.description,
            "reference": self.reference,
            "currency": self.currency,
            "source": self.source,
            "metadata": self.metadata_ or {},
            "lines": line_dicts,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class JournalEntryLine(db.Model):
    __tablename__ = "v2_journal_entry_lines"
    __table_args__ = (
        db.Index("idx_v2_journal_lines_entry", "journal_entry_id"),
        db.Index("idx_v2_journal_lines_account", "account_id"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    journal_entry_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_accounts.id", ondelete="RESTRICT"), nullable=False)
    debit = db.Column(db.Numeric(18, 2), nullable=False, default=0)
    credit = db.Column(db.Numeric(18, 2), nullable=False, default=0)
    description = db.Column(db.Text)
    line_order = db.Column(db.Integer, nullable=False, default=0)

    account = db.relationship("Account")

    def to_dict(self):
        acct = self.account
        return {
            "id": str(self.id),
            "account_id": str(self.account_id),
            "account_code": acct.code if acct else None,
            "account_name": acct.name if acct else None,
            "account_type": acct.type if acct else None,
            "debit": float(self.debit) if self.debit is not None else 0,
            "credit": float(self.credit) if self.credit is not None else 0,
            "description": self.description,
            "line_order": self.line_order,
        }
