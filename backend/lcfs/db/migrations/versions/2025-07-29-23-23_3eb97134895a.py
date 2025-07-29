"""Add is_non_assessment field to compliance_report table

Revision ID: 3eb97134895a
Revises: 33ec14737b15
Create Date: 2025-07-29 23:23:47.891496

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "3eb97134895a"
down_revision = "33ec14737b15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report",
        sa.Column(
            "is_non_assessment",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Flag indicating if report is not subject to assessment under the Low Carbon Fuels Act",
        ),
    )


def downgrade() -> None:
    op.drop_column("compliance_report", "is_non_assessment")
