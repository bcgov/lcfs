"""Store EOC responses for each evidence requirement.

Revision ID: 5454e0c00002
Revises: b7a04f59fdf3
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "5454e0c00002"
down_revision = "b7a04f59fdf3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "da_eoc_submission",
        sa.Column("evidence_responses", postgresql.JSONB(), nullable=True),
    )


def downgrade():
    op.drop_column("da_eoc_submission", "evidence_responses")
