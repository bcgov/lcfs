"""Update Administrator role description to mention comment edit override.

Revision ID: b1d4e7a2c8f9
Revises: b1c2d3e4f5a6
Create Date: 2026-06-30 15:00:00.000000
"""

from alembic import op

revision = "b1d4e7a2c8f9"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


NEW_DESCRIPTION = (
    "Can add/edit IDIR users and assign roles, add/edit organizations, "
    "BCeID users, and assign roles; can also edit any comments"
)
OLD_DESCRIPTION = (
    "Can add/edit IDIR users and assign roles, add/edit organizations, "
    "BCeID users, and assign roles"
)


def upgrade() -> None:
    op.execute(
        f"UPDATE role SET description = '{NEW_DESCRIPTION}' WHERE name = 'ADMINISTRATOR';"
    )


def downgrade() -> None:
    op.execute(
        f"UPDATE role SET description = '{OLD_DESCRIPTION}' WHERE name = 'ADMINISTRATOR';"
    )
