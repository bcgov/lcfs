"""Add transaction_action column to transaction table

Revision ID: 3c9a518adbea
Revises: df41556bd1ee
Create Date: 2024-02-27 20:20:52.190963

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

# Revision identifiers, used by Alembic.
revision = '3c9a518adbea'
down_revision = 'df41556bd1ee'
branch_labels = None
depends_on = None

def upgrade():
    # Create an ENUM type for transaction_action
    transaction_action_enum = ENUM('Adjustment', 'Reserved', 'Released',
        name='transaction_action_enum',
        metadata=sa.MetaData()
    )

    # Check first if the ENUM type already exists before creating it
    transaction_action_enum.create(op.get_bind(), checkfirst=True)

    # Add transaction_action column to the transaction table
    op.add_column('transaction', sa.Column(
        'transaction_action',
        transaction_action_enum,
        nullable=False,
        comment='Action type for the transaction, e.g., Adjustment, Reserved, or Released.'
    ))


def downgrade():
    # Drop the transaction_action column
    op.drop_column('transaction', 'transaction_action')

    # Drop the ENUM type only if it exists to avoid errors
    op.execute('DROP TYPE IF EXISTS transaction_action_enum')
