"""Create lookup tables for fuel data management

Revision ID: a1c6c67c49c6
Revises: d781da2e8de1
Create Date: 2024-04-22 20:09:21.770589

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1c6c67c49c6"
down_revision = "d781da2e8de1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('fuel_type',
                    sa.Column('fuel_type_id', sa.Integer(), primary_key=True),
                    sa.Column('code', sa.String(50), nullable=False),
                    sa.Column('fossil_derived', sa.Boolean(), nullable=True))

    op.create_table('transport_mode_type',
                    sa.Column('transport_mode_type_id',
                              sa.Integer(), primary_key=True),
                    sa.Column('mode', sa.String(50), nullable=False))

    op.create_table('transport_mode_fuel_code',
                    sa.Column('transport_mode_fuel_code_id', sa.Integer(), sa.ForeignKey(
                        'transport_mode_type.transport_mode_type_id'), primary_key=True),
                    sa.Column('fuel_code_id', sa.Integer(), sa.ForeignKey('fuel_type.fuel_type_id'), primary_key=True))

    op.create_table('fuel_code_prefix',
                    sa.Column('fuel_code_prefix_id',
                              sa.Integer(), primary_key=True),
                    sa.Column('prefix', sa.String(50), nullable=False))


def downgrade() -> None:
    op.drop_table('fuel_code_prefix')
    op.drop_table('transport_mode_fuel_code')
    op.drop_table('transport_mode_type')
    op.drop_table('fuel_type')
