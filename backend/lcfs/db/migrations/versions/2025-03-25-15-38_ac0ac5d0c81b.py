"""Create Location table

Revision ID: ac0ac5d0c81b
Revises: 278193278eff
Create Date: 2025-03-25 15:38:31.943374

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ac0ac5d0c81b"
down_revision = "278193278eff"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'location',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('city', sa.String(1000), nullable=True),
        sa.Column('province_state', sa.String(1000), nullable=True),
        sa.Column('country', sa.String(1000), nullable=True),
        sa.Column('latitude', sa.Numeric(10, 6), nullable=True),
        sa.Column('longitude', sa.Numeric(10, 6), nullable=True),
        sa.UniqueConstraint('city', 'province_state', 'country', name='uniq_location')
    )

def downgrade():
    op.drop_table('location')
