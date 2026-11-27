"""Allow repeated status events in compliance report history.

Revision ID: b61e4928c113
Revises: 8b3e6a1c5d90
"""

from alembic import op
import sqlalchemy as sa

revision = "b61e4928c113"
down_revision = "c3a7e91d5f48"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_report_history",
        sa.Column("is_return", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.drop_constraint(
        "uq_compliance_report_id_status_id", "compliance_report_history", type_="unique"
    )


def downgrade() -> None:
    # PostgreSQL rejects this if repeated events exist; never discard history.
    op.create_unique_constraint(
        "uq_compliance_report_id_status_id",
        "compliance_report_history",
        ["compliance_report_id", "status_id"],
    )
    op.drop_column("compliance_report_history", "is_return")
