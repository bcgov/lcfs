"""merge develop migration head with EOC responses

Revision ID: 283d957a31ef
Revises: 5454e0c00002, b7a04f59fdf3
Create Date: 2026-11-23 09:57:25.488023

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "283d957a31ef"
down_revision = ("5454e0c00002", "b7a04f59fdf3")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
