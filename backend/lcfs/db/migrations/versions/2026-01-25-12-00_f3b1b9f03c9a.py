"""Create report_opening configuration table

Revision ID: f3b1b9f03c9a
Revises: a1b2c3d4e5f1
Create Date: 2026-01-25 12:00:00.000000

"""

from datetime import datetime

import sqlalchemy as sa
from enum import Enum
from alembic import op

# revision identifiers, used by Alembic.
revision = "f3b1b9f03c9a"
down_revision = "a1b2c3d4e5f1"
branch_labels = None
depends_on = None


class SupplementalReportAccessRoleEnum(str, Enum):
    BCeID = "BCeID"
    IDIR = "IDIR"


enum_for_column = sa.Enum(
    SupplementalReportAccessRoleEnum,
    name="supplemental_report_access_role_enum",
    create_type=False,
)


def upgrade() -> None:
    op.execute("DROP TYPE IF EXISTS supplemental_report_access_role_enum")

    op.create_table(
        "report_opening",
        sa.Column(
            "report_opening_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the report opening row",
        ),
        sa.Column(
            "compliance_year",
            sa.Integer(),
            nullable=False,
            comment="Compliance year that this configuration applies to",
        ),
        sa.Column(
            "compliance_reporting_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="If TRUE, suppliers can create compliance reports for this year",
        ),
        sa.Column(
            "early_issuance_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Indicates whether early issuance is enabled for this year",
        ),
        sa.Column(
            "supplemental_report_role",
            enum_for_column,
            nullable=False,
            server_default=sa.text("'BCeID'"),
            comment="Which role may create supplemental reports for the year",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date/time when the record was created",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date/time when the record was last updated",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="User who created the record",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="User who last updated the record",
        ),
        sa.PrimaryKeyConstraint(
            "report_opening_id",
            name=op.f("pk_report_opening"),
        ),
        sa.UniqueConstraint(
            "compliance_year",
            name="uq_report_opening_compliance_year",
        ),
        comment="Stores per-year configuration for compliance reporting availability and permissions.",
    )
    op.execute('commit;')
    report_opening_table = sa.table(
        "report_opening",
        sa.column("compliance_year", sa.Integer()),
        sa.column("compliance_reporting_enabled", sa.Boolean()),
        sa.column("early_issuance_enabled", sa.Boolean()),
        sa.column("supplemental_report_role", enum_for_column),
    )

    current_year = datetime.utcnow().year
    op.bulk_insert(
        report_opening_table,
        [
            {
                "compliance_year": year,
                "compliance_reporting_enabled": year == 2025,
                "early_issuance_enabled": False,
                "supplemental_report_role": SupplementalReportAccessRoleEnum.BCeID if year >= current_year else SupplementalReportAccessRoleEnum.IDIR,
            }
            for year in range(2019, 2031)
        ],
    )


def downgrade() -> None:
    op.drop_table("report_opening")
    op.execute("DROP TYPE IF EXISTS supplemental_report_access_role_enum")
