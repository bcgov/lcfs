"""Track initialization of supplemental renewable summary values.

Revision ID: c8e21f6a4d90
Revises: b7a04f59fdf3
"""

from alembic import op
import sqlalchemy as sa

revision = "c8e21f6a4d90"
down_revision = "b7a04f59fdf3"
branch_labels = None
depends_on = None


def upgrade():
    # Existing zero values may be intentional, so do not reseed existing reports.
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "supplemental_renewable_initialized",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.alter_column(
        "compliance_report_summary",
        "supplemental_renewable_initialized",
        server_default=sa.false(),
    )


def downgrade():
    op.drop_column("compliance_report_summary", "supplemental_renewable_initialized")
