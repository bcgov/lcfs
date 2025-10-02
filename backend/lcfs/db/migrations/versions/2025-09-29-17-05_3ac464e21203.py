"""Add company overview fields to organization

Revision ID: 3ac464e21203
Revises: bbd3a73fa80f
Create Date: 2025-09-29 17:05:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "3ac464e21203"
down_revision = "bbd3a73fa80f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add company overview fields to organization table
    op.add_column(
        "organization",
        sa.Column(
            "company_details",
            sa.String(),
            nullable=True,
            comment="Free-form text field for company details",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "company_representation_agreements",
            sa.String(),
            nullable=True,
            comment="Free-form text field for company representation agreements or affiliated organizations",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "company_acting_as_aggregator",
            sa.String(),
            nullable=True,
            comment="Free-form text field for acting as an aggregator information",
        ),
    )
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
