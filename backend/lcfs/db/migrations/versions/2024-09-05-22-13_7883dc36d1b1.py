"""Rename CI Limit to Target CI

Revision ID: 7883dc36d1b1
Revises: 9d93dc700752
Create Date: 2024-09-05 22:13:48.756295

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "7883dc36d1b1"
down_revision = "9d93dc700752"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('fuel_supply', 'ci_limit',
                    new_column_name='target_ci')


def downgrade() -> None:
    op.alter_column('fuel_supply', 'target_ci',
                    new_column_name='ci_limit')
