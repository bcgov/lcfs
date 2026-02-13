"""Add company overview fields to organization

Revision ID: 3ac464e21203
Revises: 13529e573c05
Create Date: 2025-09-29 17:05:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "3ac464e21203"
down_revision = "13529e573c05"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    # Add company overview fields to organization table (with existence checks)
    if not column_exists("organization", "company_details"):
        op.add_column(
            "organization",
            sa.Column(
                "company_details",
                sa.String(),
                nullable=True,
                comment="Free-form text field for company details",
            ),
        )
    if not column_exists("organization", "company_representation_agreements"):
        op.add_column(
            "organization",
            sa.Column(
                "company_representation_agreements",
                sa.String(),
                nullable=True,
                comment="Free-form text field for company representation agreements or affiliated organizations",
            ),
        )
    if not column_exists("organization", "company_acting_as_aggregator"):
        op.add_column(
            "organization",
            sa.Column(
                "company_acting_as_aggregator",
                sa.String(),
                nullable=True,
                comment="Free-form text field for acting as an aggregator information",
            ),
        )
    if not column_exists("organization", "company_additional_notes"):
        op.add_column(
            "organization",
            sa.Column(
                "company_additional_notes",
                sa.String(),
                nullable=True,
                comment="Free-form text field for additional company notes",
            ),
        )


def downgrade() -> None:
    # Remove company overview fields from organization table
    op.drop_column("organization", "company_additional_notes")
    op.drop_column("organization", "company_acting_as_aggregator")
    op.drop_column("organization", "company_representation_agreements")
    op.drop_column("organization", "company_details")
