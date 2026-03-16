"""Tier 2: Core Financial Data models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID, JSONB
from models.base import db

DATA_SOURCES = ("bank_upload", "bank_api", "erp", "pos", "crm", "manual", "inventory")


class Transaction(db.Model):
    __tablename__ = "v2_transactions"
    __table_args__ = (
        db.Index("idx_v2_txn_client_date", "client_id", "transaction_date"),
        db.Index("idx_v2_txn_client_source", "client_id", "source"),
        db.Index("idx_v2_txn_counterparty", "client_id", "counterparty_name"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    bank_account_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_bank_accounts.id", ondelete="SET NULL"))
    source = db.Column(db.Text, nullable=False)
    source_ref = db.Column(db.Text)
    connection_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_connections.id", ondelete="SET NULL"))
    file_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_uploaded_files.id", ondelete="SET NULL"))
    transaction_date = db.Column(db.Date, nullable=False)
    posted_date = db.Column(db.Date)
    description = db.Column(db.Text, nullable=False, default="")
    memo = db.Column(db.Text)
    amount = db.Column(db.Numeric(18, 2), nullable=False)
    currency = db.Column(db.Text, nullable=False, default="AED")
    category = db.Column(db.Text)
    subcategory = db.Column(db.Text)
    counterparty_name = db.Column(db.Text)
    counterparty_id = db.Column(UUID(as_uuid=True))
    is_transfer = db.Column(db.Boolean, default=False)
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "bank_account_id": str(self.bank_account_id) if self.bank_account_id else None,
            "source": self.source,
            "source_ref": self.source_ref,
            "connection_id": str(self.connection_id) if self.connection_id else None,
            "file_id": str(self.file_id) if self.file_id else None,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "posted_date": self.posted_date.isoformat() if self.posted_date else None,
            "description": self.description,
            "memo": self.memo,
            "amount": float(self.amount) if self.amount is not None else 0,
            "currency": self.currency,
            "category": self.category,
            "subcategory": self.subcategory,
            "counterparty_name": self.counterparty_name,
            "counterparty_id": str(self.counterparty_id) if self.counterparty_id else None,
            "is_transfer": self.is_transfer,
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Account(db.Model):
    __tablename__ = "v2_accounts"
    __table_args__ = (db.UniqueConstraint("client_id", "code"),)

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    code = db.Column(db.Text, nullable=False)
    name = db.Column(db.Text, nullable=False)
    type = db.Column(db.Text, nullable=False)
    parent_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_accounts.id"))
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "code": self.code,
            "name": self.name,
            "type": self.type,
            "parent_id": str(self.parent_id) if self.parent_id else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Vendor(db.Model):
    __tablename__ = "v2_vendors"
    __table_args__ = (db.UniqueConstraint("client_id", "name"),)

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text)
    phone = db.Column(db.Text)
    trn = db.Column(db.Text)
    category = db.Column(db.Text)
    source = db.Column(db.Text)
    source_ref = db.Column(db.Text)
    payment_terms = db.Column(db.Integer, default=30)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "trn": self.trn,
            "category": self.category,
            "source": self.source,
            "source_ref": self.source_ref,
            "payment_terms": self.payment_terms,
            "is_active": self.is_active,
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Customer(db.Model):
    __tablename__ = "v2_customers"
    __table_args__ = (db.UniqueConstraint("client_id", "name"),)

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.Text, nullable=False)
    email = db.Column(db.Text)
    phone = db.Column(db.Text)
    trn = db.Column(db.Text)
    category = db.Column(db.Text)
    source = db.Column(db.Text)
    source_ref = db.Column(db.Text)
    payment_terms = db.Column(db.Integer, default=30)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "trn": self.trn,
            "category": self.category,
            "source": self.source,
            "source_ref": self.source_ref,
            "payment_terms": self.payment_terms,
            "is_active": self.is_active,
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Bill(db.Model):
    __tablename__ = "v2_bills"
    __table_args__ = (
        db.Index("idx_v2_bills_client_status", "client_id", "status"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    vendor_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_vendors.id", ondelete="SET NULL"))
    source = db.Column(db.Text, nullable=False, default="manual")
    source_ref = db.Column(db.Text)
    bill_number = db.Column(db.Text)
    bill_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(18, 2), nullable=False)
    tax_amount = db.Column(db.Numeric(18, 2), default=0)
    total = db.Column(db.Numeric(18, 2), nullable=False)
    currency = db.Column(db.Text, nullable=False, default="AED")
    status = db.Column(db.Text, nullable=False, default="open")
    category = db.Column(db.Text)
    account_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_accounts.id"))
    notes = db.Column(db.Text)
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    vendor = db.relationship("Vendor", backref="bills")

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "vendor_id": str(self.vendor_id) if self.vendor_id else None,
            "vendor_name": self.vendor.name if self.vendor else None,
            "source": self.source,
            "source_ref": self.source_ref,
            "bill_number": self.bill_number,
            "bill_date": self.bill_date.isoformat() if self.bill_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "subtotal": float(self.subtotal) if self.subtotal is not None else 0,
            "tax_amount": float(self.tax_amount) if self.tax_amount is not None else 0,
            "total": float(self.total) if self.total is not None else 0,
            "currency": self.currency,
            "status": self.status,
            "category": self.category,
            "account_id": str(self.account_id) if self.account_id else None,
            "notes": self.notes,
            "metadata": self.metadata_,
            "v2_vendors": {"name": self.vendor.name} if self.vendor else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Invoice(db.Model):
    __tablename__ = "v2_invoices"
    __table_args__ = (
        db.Index("idx_v2_invoices_client_status", "client_id", "status"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    customer_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_customers.id", ondelete="SET NULL"))
    source = db.Column(db.Text, nullable=False, default="manual")
    source_ref = db.Column(db.Text)
    invoice_number = db.Column(db.Text)
    invoice_date = db.Column(db.Date, nullable=False)
    due_date = db.Column(db.Date)
    subtotal = db.Column(db.Numeric(18, 2), nullable=False)
    tax_amount = db.Column(db.Numeric(18, 2), default=0)
    total = db.Column(db.Numeric(18, 2), nullable=False)
    currency = db.Column(db.Text, nullable=False, default="AED")
    status = db.Column(db.Text, nullable=False, default="draft")
    category = db.Column(db.Text)
    description = db.Column(db.Text)
    line_items = db.Column(JSONB, default=[])
    account_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_accounts.id"))
    notes = db.Column(db.Text)
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    customer = db.relationship("Customer", backref="invoices")

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "customer_id": str(self.customer_id) if self.customer_id else None,
            "customer_name": self.customer.name if self.customer else None,
            "source": self.source,
            "source_ref": self.source_ref,
            "invoice_number": self.invoice_number,
            "invoice_date": self.invoice_date.isoformat() if self.invoice_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "subtotal": float(self.subtotal) if self.subtotal is not None else 0,
            "tax_amount": float(self.tax_amount) if self.tax_amount is not None else 0,
            "total": float(self.total) if self.total is not None else 0,
            "currency": self.currency,
            "status": self.status,
            "category": self.category,
            "description": self.description,
            "line_items": self.line_items,
            "account_id": str(self.account_id) if self.account_id else None,
            "notes": self.notes,
            "metadata": self.metadata_,
            "v2_customers": {"name": self.customer.name} if self.customer else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PaymentAllocation(db.Model):
    __tablename__ = "v2_payment_allocations"
    __table_args__ = (
        db.CheckConstraint("bill_id IS NOT NULL OR invoice_id IS NOT NULL"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    transaction_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_transactions.id", ondelete="CASCADE"), nullable=False)
    bill_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_bills.id", ondelete="CASCADE"))
    invoice_id = db.Column(UUID(as_uuid=True), db.ForeignKey("v2_invoices.id", ondelete="CASCADE"))
    amount = db.Column(db.Numeric(18, 2), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "transaction_id": str(self.transaction_id),
            "bill_id": str(self.bill_id) if self.bill_id else None,
            "invoice_id": str(self.invoice_id) if self.invoice_id else None,
            "amount": float(self.amount) if self.amount is not None else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
