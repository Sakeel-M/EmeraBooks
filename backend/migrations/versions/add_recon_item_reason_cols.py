"""Add reason, txn_type, txn_type_label to reconciliation items

Revision ID: b7f3a2c1d456
Revises: 4893a96e6423
Create Date: 2026-03-06
"""
from alembic import op
import sqlalchemy as sa

revision = 'b7f3a2c1d456'
down_revision = '4893a96e6423'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('v2_reconciliation_items', sa.Column('reason', sa.Text(), nullable=True))
    op.add_column('v2_reconciliation_items', sa.Column('txn_type', sa.Text(), nullable=True))
    op.add_column('v2_reconciliation_items', sa.Column('txn_type_label', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('v2_reconciliation_items', 'txn_type_label')
    op.drop_column('v2_reconciliation_items', 'txn_type')
    op.drop_column('v2_reconciliation_items', 'reason')
