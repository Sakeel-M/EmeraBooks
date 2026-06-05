"""Add v2_inventory_items

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "f3a4b5c6d7e8"
down_revision = "e2f3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "v2_inventory_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sku", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("unit", sa.Text(), nullable=True, server_default="each"),
        sa.Column("unit_price", sa.Numeric(18, 2), nullable=True, server_default="0"),
        sa.Column("cost_price", sa.Numeric(18, 2), nullable=True, server_default="0"),
        sa.Column("tax_rate", sa.Numeric(5, 2), nullable=True, server_default="5"),
        sa.Column("quantity_on_hand", sa.Numeric(18, 2), nullable=True, server_default="0"),
        sa.Column("reorder_level", sa.Numeric(18, 2), nullable=True, server_default="0"),
        sa.Column("currency", sa.Text(), nullable=False, server_default="AED"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("metadata", JSONB(), nullable=True, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_v2_inv_client_active", "v2_inventory_items", ["client_id", "is_active"])
    op.create_unique_constraint("uq_v2_inv_client_sku", "v2_inventory_items", ["client_id", "sku"])


def downgrade():
    op.drop_constraint("uq_v2_inv_client_sku", "v2_inventory_items", type_="unique")
    op.drop_index("idx_v2_inv_client_active", table_name="v2_inventory_items")
    op.drop_table("v2_inventory_items")
