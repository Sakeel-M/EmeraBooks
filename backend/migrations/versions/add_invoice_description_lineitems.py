"""Add description and line_items columns to invoices

Revision ID: d9e5f6a7b890
Revises: c8d4e5f6a789
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'd9e5f6a7b890'
down_revision = 'c8d4e5f6a789'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('v2_invoices', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('v2_invoices', sa.Column('line_items', JSONB(), nullable=True))


def downgrade():
    op.drop_column('v2_invoices', 'line_items')
    op.drop_column('v2_invoices', 'description')
