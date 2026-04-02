"""Add parent_id to clients for parent-child account hierarchy

Revision ID: f1a2b3c4d5e6
Revises: e0f1a2b3c4d5
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'f1a2b3c4d5e6'
down_revision = 'e0f1a2b3c4d5'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clients', sa.Column('parent_id', UUID(), sa.ForeignKey('clients.id', ondelete='SET NULL'), nullable=True))


def downgrade():
    op.drop_column('clients', 'parent_id')
