"""Add contact name to organizations

Revision ID: b6c7d8e9f0a1
Revises: f9a0b1c2d3e5
Create Date: 2026-08-14 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "b6c7d8e9f0a1"
down_revision = "f9a0b1c2d3e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organization",
        sa.Column(
            "contact_name",
            sa.String(length=500),
            nullable=True,
            comment="Organization's contact name",
        ),
    )
    op.add_column(
        "compliance_report_organization_snapshot",
        sa.Column(
            "contact_name",
            sa.String(length=500),
            nullable=True,
            comment="Organization's contact name",
        ),
    )


def downgrade() -> None:
    op.drop_column("compliance_report_organization_snapshot", "contact_name")
    op.drop_column("organization", "contact_name")
