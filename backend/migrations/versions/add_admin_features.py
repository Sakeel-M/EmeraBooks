"""Add locked_features to organizations and user_email to org_members

Revision ID: e0f1a2b3c4d5
Revises: d9e5f6a7b890
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'e0f1a2b3c4d5'
down_revision = 'd9e5f6a7b890'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('organizations', sa.Column('locked_features', JSONB(), server_default='[]', nullable=False))
    op.add_column('org_members', sa.Column('user_email', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('org_members', 'user_email')
    op.drop_column('organizations', 'locked_features')
