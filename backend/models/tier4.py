"""Tier 4: Risk Monitoring & Audit models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from models.base import db


class RiskAlert(db.Model):
    __tablename__ = "v2_risk_alerts"
    __table_args__ = (
        db.Index("idx_v2_alerts_client_status", "client_id", "status"),
    )

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    alert_type = db.Column(db.Text, nullable=False)
    severity = db.Column(db.Text, nullable=False, default="medium")
    title = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    entity_type = db.Column(db.Text)
    entity_id = db.Column(UUID(as_uuid=True))
    amount = db.Column(db.Numeric(18, 2))
    status = db.Column(db.Text, nullable=False, default="open")
    resolved_by = db.Column(UUID(as_uuid=True))
    resolved_at = db.Column(db.DateTime(timezone=True))
    metadata_ = db.Column("metadata", JSONB, default={})
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "alert_type": self.alert_type,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id) if self.entity_id else None,
            "amount": float(self.amount) if self.amount is not None else None,
            "status": self.status,
            "resolved_by": str(self.resolved_by) if self.resolved_by else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class VarianceBaseline(db.Model):
    __tablename__ = "v2_variance_baselines"
    __table_args__ = (db.UniqueConstraint("client_id", "metric_name", "period_type"),)

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    metric_name = db.Column(db.Text, nullable=False)
    period_type = db.Column(db.Text, nullable=False, default="monthly")
    baseline_value = db.Column(db.Numeric(18, 2), nullable=False)
    std_deviation = db.Column(db.Numeric(18, 2))
    sample_count = db.Column(db.Integer, default=0)
    last_calculated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "metric_name": self.metric_name,
            "period_type": self.period_type,
            "baseline_value": float(self.baseline_value) if self.baseline_value is not None else 0,
            "std_deviation": float(self.std_deviation) if self.std_deviation is not None else None,
            "sample_count": self.sample_count,
            "last_calculated_at": self.last_calculated_at.isoformat() if self.last_calculated_at else None,
        }


class ControlSetting(db.Model):
    __tablename__ = "v2_control_settings"
    __table_args__ = (db.UniqueConstraint("client_id", "setting_key"),)

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    setting_key = db.Column(db.Text, nullable=False)
    setting_value = db.Column(JSONB, nullable=False, default={})
    updated_by = db.Column(UUID(as_uuid=True))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": str(self.id),
            "client_id": str(self.client_id),
            "setting_key": self.setting_key,
            "setting_value": self.setting_value,
            "updated_by": str(self.updated_by) if self.updated_by else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AuditLog(db.Model):
    __tablename__ = "v2_audit_logs"
    __table_args__ = (
        db.Index("idx_v2_audit_org_time", "org_id", db.desc("created_at")),
    )

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    org_id = db.Column(UUID(as_uuid=True), db.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    client_id = db.Column(UUID(as_uuid=True), db.ForeignKey("clients.id", ondelete="SET NULL"))
    user_id = db.Column(UUID(as_uuid=True), nullable=False)
    action = db.Column(db.Text, nullable=False)
    entity_type = db.Column(db.Text)
    entity_id = db.Column(UUID(as_uuid=True))
    old_values = db.Column(JSONB)
    new_values = db.Column(JSONB)
    ip_address = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "org_id": str(self.org_id),
            "client_id": str(self.client_id) if self.client_id else None,
            "user_id": str(self.user_id),
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id) if self.entity_id else None,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
