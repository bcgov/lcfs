"""Add Organization to FSE

Revision ID: 9206124a098b
Revises: aeaa26f5cdd5
Create Date: 2024-12-04 09:59:22.876386

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9206124a098b'
down_revision = '8491890dd688'
branch_labels = None
depends_on = None


def upgrade():
    # Add the column 'organization' to 'final_supply_equipment' table
    op.add_column("final_supply_equipment", sa.Column("organization", sa.String(), nullable=True))


def downgrade():
    # Remove the column 'organization' from 'final_supply_equipment' table
    op.drop_column("final_supply_equipment", "organization")