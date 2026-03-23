"""Tier 0: Organization & Multi-tenancy models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID, JSONB
from models.base import db


class Organization(db.Model):
    __tablename__ = "organizations"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.Text, nullable=False)
    slug = db.Column(db.Text, unique=True, nullable=False)
    logo_url = db.Column(db.Text)
    default_currency = db.Column(db.Text, nullable=False, default="USD")
    fiscal_year_start = db.Column(db.Integer, nullable=False, default=1)
    country = db.Column(db.Text, nullable=False, default="AE")
    vat_rate = db.Column(db.Numeric(5, 2), default=5.00)
    locked_features = db.Column(JSONB, nullable=False, default=list, server_default='[]')
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    members = db.relationship("OrgMember", backref="organization", cascade="all, delete-orphan")
    clients = db.relationship("Client", backref="organization", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "logo_url": self.logo_url,
            "default_currency": self.default_currency,
            "fiscal_year_start": self.fiscal_year_start,
            "country": self.country,
            "vat_rate": float(self.vat_rate) if self.vat_rate else None,
            "locked_features": self.locked_features or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OrgMember(db.Model):
    __tablename__ = "org_members"
    __table_args__ = (db.UniqueConstraint("org_id", "user_id"),)

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = db.Column(UUID(as_uuid=True), db.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(UUID(as_uuid=True), nullable=False)
    role = db.Column(db.Text, nullable=False, default="member")
    user_email = db.Column(db.Text)
    invited_email = db.Column(db.Text)
    accepted_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "org_id": str(self.org_id),
            "user_id": str(self.user_id),
            "role": self.role,
            "user_email": self.user_email,
            "invited_email": self.invited_email,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Client(db.Model):
    __tablename__ = "clients"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = db.Column(UUID(as_uuid=True), db.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.Text, nullable=False)
    trade_license = db.Column(db.Text)
    trn = db.Column(db.Text)
    currency = db.Column(db.Text, nullable=False, default="AED")
    country = db.Column(db.Text, nullable=False, default="AE")
    industry = db.Column(db.Text)
    fiscal_year_start = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.Text, nullable=False, default="active")
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "org_id": str(self.org_id),
            "name": self.name,
            "trade_license": self.trade_license,
            "trn": self.trn,
            "currency": self.currency,
            "country": self.country,
            "industry": self.industry,
            "fiscal_year_start": self.fiscal_year_start,
            "status": self.status,
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserActiveClient(db.Model):
    __tablename__ = "user_active_client"

    user_id = db.Column(UUID(as_uuid=True), primary_key=True)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    client = db.relationship("Client")

    def to_dict(self):
        return {
            "user_id": str(self.user_id),
            "client_id": str(self.client_id),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserRole(db.Model):
    __tablename__ = "user_roles"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), nullable=False)
    role = db.Column(db.Text, nullable=False, default="member")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "role": self.role,
        }


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = db.Column(UUID(as_uuid=True), nullable=False)
    name = db.Column(db.Text, nullable=False)
    type = db.Column(db.Text, nullable=False, default="all")
    is_system = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "type": self.type,
            "is_system": self.is_system,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
