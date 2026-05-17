"""Switch billing from per-user to per-org

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the per-user table — test mode data only, no production users yet
    op.drop_table('user_subscriptions')

    op.create_table(
        'org_subscriptions',
        sa.Column('id', UUID(), primary_key=True),
        sa.Column('org_id', UUID(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('billing_email', sa.Text(), nullable=False),
        sa.Column('stripe_customer_id', sa.Text(), unique=True),
        sa.Column('stripe_subscription_id', sa.Text(), unique=True),
        sa.Column('plan_tier', sa.Text()),
        sa.Column('status', sa.Text(), nullable=False, server_default='incomplete'),
        sa.Column('current_period_end', sa.DateTime(timezone=True)),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_org_subscriptions_org_id', 'org_subscriptions', ['org_id'])
    op.create_index('ix_org_subscriptions_stripe_customer_id', 'org_subscriptions', ['stripe_customer_id'])
    op.create_index('ix_org_subscriptions_stripe_subscription_id', 'org_subscriptions', ['stripe_subscription_id'])


def downgrade():
    op.drop_index('ix_org_subscriptions_stripe_subscription_id', 'org_subscriptions')
    op.drop_index('ix_org_subscriptions_stripe_customer_id', 'org_subscriptions')
    op.drop_index('ix_org_subscriptions_org_id', 'org_subscriptions')
    op.drop_table('org_subscriptions')

    op.create_table(
        'user_subscriptions',
        sa.Column('id', UUID(), primary_key=True),
        sa.Column('user_id', UUID(), nullable=False, unique=True),
        sa.Column('user_email', sa.Text(), nullable=False),
        sa.Column('stripe_customer_id', sa.Text(), unique=True),
        sa.Column('stripe_subscription_id', sa.Text(), unique=True),
        sa.Column('plan_tier', sa.Text()),
        sa.Column('status', sa.Text(), nullable=False, server_default='incomplete'),
        sa.Column('current_period_end', sa.DateTime(timezone=True)),
        sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
