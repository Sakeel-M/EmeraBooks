"""Add manual journal entries (double-entry posting)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'c9d0e1f2a3b4'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'v2_journal_entries',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('client_id', UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('reference', sa.Text()),
        sa.Column('currency', sa.Text(), nullable=False, server_default='AED'),
        sa.Column('source', sa.Text(), nullable=False, server_default='manual'),
        sa.Column('metadata', JSONB(), server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('idx_v2_journal_entries_client_date', 'v2_journal_entries', ['client_id', 'entry_date'])

    op.create_table(
        'v2_journal_entry_lines',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('journal_entry_id', UUID(as_uuid=True), sa.ForeignKey('v2_journal_entries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', UUID(as_uuid=True), sa.ForeignKey('v2_accounts.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('debit', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('credit', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('description', sa.Text()),
        sa.Column('line_order', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('idx_v2_journal_lines_entry', 'v2_journal_entry_lines', ['journal_entry_id'])
    op.create_index('idx_v2_journal_lines_account', 'v2_journal_entry_lines', ['account_id'])


def downgrade():
    op.drop_index('idx_v2_journal_lines_account', table_name='v2_journal_entry_lines')
    op.drop_index('idx_v2_journal_lines_entry', table_name='v2_journal_entry_lines')
    op.drop_table('v2_journal_entry_lines')
    op.drop_index('idx_v2_journal_entries_client_date', table_name='v2_journal_entries')
    op.drop_table('v2_journal_entries')
