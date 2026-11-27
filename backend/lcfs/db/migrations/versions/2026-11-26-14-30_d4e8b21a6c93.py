"""Add representative agreement fields to organization.

Revision ID: d4e8b21a6c93
Revises: c3a7e91d5f48
Create Date: 2026-11-26 14:30:00
"""

import sqlalchemy as sa
from alembic import op

revision = "d4e8b21a6c93"
down_revision = "c3a7e91d5f48"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organization",
        sa.Column(
            "has_representative_agreement",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Whether the organization has authorized a third party to report on its behalf",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "representative_organization_name",
            sa.String(length=500),
            nullable=True,
            comment="Name of the third-party organization that reports on behalf of this organization",
        ),
    )


def downgrade() -> None:
    op.drop_column("organization", "representative_organization_name")
    op.drop_column("organization", "has_representative_agreement")
