"""Remove legacy credits_offset_a/b/c from compliance_report_summary."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c4d5e6f7a8b9"
down_revision = "b71c1d2e3f45"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop views that depend on compliance_report_summary first.
    # They will be auto-recreated on startup from metabase.sql.
    op.execute("DROP VIEW IF EXISTS vw_compliance_report_base CASCADE")
    op.execute("DROP VIEW IF EXISTS vw_compliance_report_fuel_volume_history CASCADE")

    # Drop legacy TFRS offset columns; they are no longer used by views or models.
    op.drop_column("compliance_report_summary", "credits_offset_a")
    op.drop_column("compliance_report_summary", "credits_offset_b")
    op.drop_column("compliance_report_summary", "credits_offset_c")


def downgrade() -> None:
    # Restore legacy columns with nullable integers.
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_a", sa.Integer(), nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_b", sa.Integer(), nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_c", sa.Integer(), nullable=True),
    )
