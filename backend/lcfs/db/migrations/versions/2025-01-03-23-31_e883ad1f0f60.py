"""Rename Reassessed

Revision ID: e883ad1f0f60
Revises: 9329e38396e1
Create Date: 2025-01-03 23:31:19.098618

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference

# revision identifiers, used by Alembic.
revision = "e883ad1f0f60"
down_revision = "9329e38396e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.sync_enum_values(
        "public",
        "compliancereportstatusenum",
        [
            "Draft",
            "Submitted",
            "Recommended_by_analyst",
            "Recommended_by_manager",
            "Assessed",
            "Reassessed",
        ],
        [
            TableReference(
                table_schema="public",
                table_name="compliance_report_status",
                column_name="status",
            )
        ],
        enum_values_to_rename=[("ReAssessed", "Reassessed")],
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.sync_enum_values(
        "public",
        "compliancereportstatusenum",
        [
            "Draft",
            "Submitted",
            "Recommended_by_analyst",
            "Recommended_by_manager",
            "Assessed",
            "ReAssessed",
        ],
        [
            TableReference(
                table_schema="public",
                table_name="compliance_report_status",
                column_name="status",
            )
        ],
        enum_values_to_rename=[("Reassessed", "ReAssessed")],
    )
    # ### end Alembic commands ###
