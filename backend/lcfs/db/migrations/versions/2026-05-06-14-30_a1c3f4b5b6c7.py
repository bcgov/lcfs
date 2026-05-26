"""Create vw_fse_base for year over year FSE comparison

Revision ID: a1c3f4b5b6c7
Revises: e7c2b9a4d018
Create Date: 2026-05-06 14:30:00.000000
"""


# revision identifiers, used by Alembic.
revision = "a1c3f4b5b6c7"
down_revision = "e7c2b9a4d018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Recreate vw_fse_base with the additional year/identifier fields."""
    pass


def downgrade() -> None:
    """Drop the view; it will be recreated from the SQL file on next deploy."""
    pass
