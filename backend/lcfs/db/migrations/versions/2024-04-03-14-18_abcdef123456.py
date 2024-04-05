"""Add visibility control columns to transfer_status table

Revision ID: abcdef123456
Revises: df41556bd1ee
Create Date: 2024-04-03 14:18:25.430681

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "abcdef123456"
down_revision = "df41556bd1ee"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('transfer_status',
                  sa.Column('visible_to_transferor',
                            sa.Boolean(),
                            nullable=True,
                            server_default=sa.text('FALSE'),
                            comment='Visibility for transferor entities'))
    op.add_column('transfer_status',
                  sa.Column('visible_to_transferee',
                            sa.Boolean(),
                            nullable=True,
                            server_default=sa.text('FALSE'),
                            comment='Visibility for transferee entities'))
    op.add_column('transfer_status',
                  sa.Column('visible_to_government',
                            sa.Boolean(),
                            nullable=True,
                            server_default=sa.text('FALSE'),
                            comment='Visibility for government entities'))

def downgrade() -> None:
    op.drop_column('transfer_status', 'visible_to_transferor')
    op.drop_column('transfer_status', 'visible_to_transferee')
    op.drop_column('transfer_status', 'visible_to_government')
