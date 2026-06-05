"""Add iban, swift_code and branch columns to v2_bank_accounts

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("v2_bank_accounts", sa.Column("iban", sa.Text(), nullable=True))
    op.add_column("v2_bank_accounts", sa.Column("swift_code", sa.Text(), nullable=True))
    op.add_column("v2_bank_accounts", sa.Column("branch", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("v2_bank_accounts", "branch")
    op.drop_column("v2_bank_accounts", "swift_code")
    op.drop_column("v2_bank_accounts", "iban")
