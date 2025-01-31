"""Allow null values for provision_of_the_act_id and ci_of_fuel in other_uses table - TFRS migration

Revision ID: e50534b604f2
Revises: 0d8e7ee6a6e0
Create Date: 2025-01-30 09:44:16.180111

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e50534b604f2"
down_revision = "0d8e7ee6a6e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Modify provision_of_the_act_id to allow nulls
    op.alter_column('other_uses', 'provision_of_the_act_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_comment="Foreign key to the provision of the act"
    )
    
    # Modify ci_of_fuel to allow nulls  
    op.alter_column('other_uses', 'ci_of_fuel',
        existing_type=sa.Numeric(10,2),
        nullable=True,
        existing_comment="The Carbon intensity of fuel"
    )


def downgrade() -> None:
    # Revert changes if needed
    op.alter_column('other_uses', 'provision_of_the_act_id',
        existing_type=sa.Integer(),
        nullable=False
    )
    
    op.alter_column('other_uses', 'ci_of_fuel',
        existing_type=sa.Numeric(10,2),
        nullable=False
    )
