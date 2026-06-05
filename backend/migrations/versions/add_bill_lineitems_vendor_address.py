"""Add line_items to v2_bills and address to v2_vendors

Revision ID: d1e2f3a4b5c6
Revises: c9d0e1f2a3b4
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "d1e2f3a4b5c6"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "v2_bills",
        sa.Column("line_items", JSONB(), nullable=True, server_default="[]"),
    )
    op.add_column(
        "v2_vendors",
        sa.Column("address", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("v2_vendors", "address")
    op.drop_column("v2_bills", "line_items")
