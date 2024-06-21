"""fuel code last updated default

Revision ID: b29b8130f17e
Revises: 01f6ad70d9a8
Create Date: 2024-06-19 12:41:13.878301

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b29b8130f17e"
down_revision = "01f6ad70d9a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'fuel_code',
        'last_updated',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        existing_comment="Date at which the record was last updated."
    )


def downgrade() -> None:
    op.alter_column(
        'fuel_code',
        'last_updated',
        existing_type=sa.DateTime(timezone=True),
        nullable=False,
        server_default=None,
        existing_comment="Date at which the record was last updated."
    )