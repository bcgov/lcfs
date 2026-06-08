"""Add generated fuel codes storage to CI applications.

Revision ID: a4b5c6d7e8f9
Revises: d3e4f5a6b7c8
Create Date: 2026-05-29 09:30:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "a4b5c6d7e8f9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_application",
        sa.Column(
            "generated_fuel_codes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Draft fuel code rows generated from CI pathways for internal review.",
        ),
    )


def downgrade() -> None:
    op.drop_column("ci_application", "generated_fuel_codes")
