"""Add active flag to compliance report charging equipment

Revision ID: b1234567890c
Revises: a1b2c3d4e5f9
Create Date: 2026-03-01 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1234567890c"
down_revision = "a1b2c3d4e5f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report_charging_equipment",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            comment="Indicates whether the reporting row is active for compliance",
        ),
    )

    op.execute(
        """
        UPDATE compliance_report_charging_equipment
        SET is_active = TRUE
        WHERE is_active IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("compliance_report_charging_equipment", "is_active")
