"""Billing / Stripe subscription model — keyed by Organization."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID
from models.base import db


class OrgSubscription(db.Model):
    __tablename__ = "org_subscriptions"

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = db.Column(UUID(as_uuid=True), db.ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    billing_email = db.Column(db.Text, nullable=False)
    stripe_customer_id = db.Column(db.Text, unique=True, index=True)
    stripe_subscription_id = db.Column(db.Text, unique=True, index=True)
    plan_tier = db.Column(db.Text)
    status = db.Column(db.Text, nullable=False, default="incomplete")
    current_period_end = db.Column(db.DateTime(timezone=True), nullable=True)
    cancel_at_period_end = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "org_id": str(self.org_id),
            "billing_email": self.billing_email,
            "stripe_customer_id": self.stripe_customer_id,
            "stripe_subscription_id": self.stripe_subscription_id,
            "plan_tier": self.plan_tier,
            "status": self.status,
            "current_period_end": self.current_period_end.isoformat() if self.current_period_end else None,
            "cancel_at_period_end": self.cancel_at_period_end,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
