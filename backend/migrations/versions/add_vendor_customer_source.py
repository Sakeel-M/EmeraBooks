"""Add source and source_ref columns to vendors and customers

Revision ID: c8d4e5f6a789
Revises: b7f3a2c1d456
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'c8d4e5f6a789'
down_revision = 'b7f3a2c1d456'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('v2_vendors', sa.Column('source', sa.Text(), nullable=True))
    op.add_column('v2_vendors', sa.Column('source_ref', sa.Text(), nullable=True))
    op.add_column('v2_customers', sa.Column('source', sa.Text(), nullable=True))
    op.add_column('v2_customers', sa.Column('source_ref', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('v2_customers', 'source_ref')
    op.drop_column('v2_customers', 'source')
    op.drop_column('v2_vendors', 'source_ref')
    op.drop_column('v2_vendors', 'source')
