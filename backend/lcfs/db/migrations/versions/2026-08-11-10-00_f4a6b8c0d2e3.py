"""Add design data flag to CI pathways.

Revision ID: f4a6b8c0d2e3
Revises: 9b5d3c7e1f0a
Create Date: 2026-08-11 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "f4a6b8c0d2e3"
down_revision = "9b5d3c7e1f0a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pathway",
        sa.Column(
            "design_data",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Whether the pathway is based on design data instead of operational data",
        ),
    )
    op.alter_column("pathway", "operating_data_from", nullable=True)
    op.alter_column("pathway", "operating_data_to", nullable=True)


def downgrade() -> None:
    op.execute(
        """
        UPDATE pathway
        SET
            operating_data_from = COALESCE(operating_data_from, DATE '1970-01-01'),
            operating_data_to = COALESCE(operating_data_to, DATE '1970-01-01')
        WHERE operating_data_from IS NULL OR operating_data_to IS NULL;
        """
    )
    op.alter_column("pathway", "operating_data_to", nullable=False)
    op.alter_column("pathway", "operating_data_from", nullable=False)
    op.drop_column("pathway", "design_data")
