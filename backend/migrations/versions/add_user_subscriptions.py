"""Add user_subscriptions table for Stripe billing

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'a7b8c9d0e1f2'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
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
    op.create_index('ix_user_subscriptions_user_id', 'user_subscriptions', ['user_id'])
    op.create_index('ix_user_subscriptions_stripe_customer_id', 'user_subscriptions', ['stripe_customer_id'])
    op.create_index('ix_user_subscriptions_stripe_subscription_id', 'user_subscriptions', ['stripe_subscription_id'])


def downgrade():
    op.drop_index('ix_user_subscriptions_stripe_subscription_id', 'user_subscriptions')
    op.drop_index('ix_user_subscriptions_stripe_customer_id', 'user_subscriptions')
    op.drop_index('ix_user_subscriptions_user_id', 'user_subscriptions')
    op.drop_table('user_subscriptions')
