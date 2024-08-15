"""supplemental updates

Revision ID: 2f1e766ef118
Revises: a536df4c26e9
Create Date: 2024-08-14 14:21:03.924644

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2f1e766ef118"
down_revision = "a536df4c26e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "supplemental_report",
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance period",
        ),
    )
    op.add_column(
        "supplemental_report",
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Identifier for the organization",
        ),
    )
    op.create_foreign_key(
        "fk_supplemental_report_compliance_period",
        "supplemental_report",
        "compliance_period",
        ["compliance_period_id"],
        ["compliance_period_id"],
    )
    op.create_foreign_key(
        "fk_supplemental_report_organization",
        "supplemental_report",
        "organization",
        ["organization_id"],
        ["organization_id"],
    )
    op.alter_column(
        "compliance_report_summary",
        "line_11_non_compliance_penalty_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        nullable=True,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_11_non_compliance_penalty_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        nullable=True,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_11_non_compliance_penalty_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "compliance_report_summary",
        "line_11_non_compliance_penalty_jet_fuel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_11_non_compliance_penalty_diesel",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        nullable=False,
    )
    op.alter_column(
        "compliance_report_summary",
        "line_11_non_compliance_penalty_gasoline",
        existing_type=sa.DOUBLE_PRECISION(precision=53),
        nullable=False,
    )
    op.drop_constraint("fk_supplemental_report_organization", "supplemental_report", type_="foreignkey")
    op.drop_constraint("fk_supplemental_report_compliance_period", "supplemental_report", type_="foreignkey")
    op.drop_column("supplemental_report", "organization_id")
    op.drop_column("supplemental_report", "compliance_period_id")