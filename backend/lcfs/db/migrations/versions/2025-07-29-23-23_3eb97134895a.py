"""Add is_non_assessment field to compliance_report table

Revision ID: 3eb97134895a
Revises: 33ec14737b15
Create Date: 2025-07-29 23:23:47.891496

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "3eb97134895a"
down_revision = "33ec14737b15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if the column already exists before adding it
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('compliance_report')]
    
    if 'is_non_assessment' not in columns:
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
    else:
        print("Column 'is_non_assessment' already exists in compliance_report table, skipping...")


def downgrade() -> None:
    # Check if the column exists before dropping it
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('compliance_report')]
    
    if 'is_non_assessment' in columns:
        op.drop_column("compliance_report", "is_non_assessment")
    else:
        print("Column 'is_non_assessment' does not exist in compliance_report table, skipping...")
