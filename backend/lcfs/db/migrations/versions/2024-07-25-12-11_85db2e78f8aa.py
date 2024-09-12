"""Add supplemental reports with version tracking

Revision ID: 85db2e78f8aa
Revises: 123456789abc
Create Date: 2024-07-31 16:11:57.309853

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "85db2e78f8aa"
down_revision = "13b4b52bfc3a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sa.Enum("SUPPLEMENTAL", "REASSESSMENT", name="supplementalreporttype").create(
        op.get_bind()
    )
    sa.Enum("Q1", "Q2", "Q3", "Q4", name="quarter").create(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reporttype").create(op.get_bind())
    op.create_table(
        "supplemental_report",
        sa.Column(
            "supplemental_report_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the supplemental report",
        ),
        sa.Column(
            "original_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the original compliance report",
        ),
        sa.Column(
            "previous_report_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the previous supplemental report",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Version number of the supplemental report",
        ),
        sa.Column(
            "report_type",
            postgresql.ENUM(
                "SUPPLEMENTAL",
                "REASSESSMENT",
                name="supplementalreporttype",
                create_type=False,
            ),
            nullable=False,
            server_default="SUPPLEMENTAL",
            comment="Type of supplemental report",
        ),
        sa.Column(
            "current_status_id",
            sa.Integer(),
            nullable=False,
            comment="Identifier for the compliance report status",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.ForeignKeyConstraint(
            ["original_report_id"],
            ["compliance_report.compliance_report_id"],
        ),
        sa.ForeignKeyConstraint(
            ["previous_report_id"],
            ["supplemental_report.supplemental_report_id"],
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["compliance_report_status.compliance_report_status_id"],
        ),
        sa.PrimaryKeyConstraint("supplemental_report_id"),
        comment="Tracks supplemental reports and reassessments for compliance reports",
    )
    op.drop_table("compliance_report_snapshot")
    op.add_column(
        "compliance_report",
        sa.Column(
            "current_status_id",
            sa.Integer(),
            nullable=True,
            comment="Identifier for the current compliance report status",
        ),
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "report_type",
            postgresql.ENUM(
                "ANNUAL", "QUARTERLY", name="reporttype", create_type=False
            ),
            nullable=False,
            server_default="ANNUAL",
        ),
    )
    op.drop_constraint(
        "compliance_report_summary_id_fkey", "compliance_report", type_="foreignkey"
    )
    op.drop_constraint(
        "compliance_report_status_id_fkey", "compliance_report", type_="foreignkey"
    )
    op.create_foreign_key(
        None,
        "compliance_report",
        "compliance_report_status",
        ["current_status_id"],
        ["compliance_report_status_id"],
    )
    op.drop_column("compliance_report", "summary_id")
    op.drop_column("compliance_report", "status_id")
    op.add_column(
        "compliance_report_summary",
        sa.Column("compliance_report_id", sa.Integer(), nullable=False),
    )
    op.add_column(
        "compliance_report_summary", sa.Column("quarter", sa.Integer(), nullable=True)
    )
    op.add_column(
        "compliance_report_summary", sa.Column("version", sa.Integer(), nullable=False)
    )
    op.add_column(
        "compliance_report_summary", sa.Column("is_locked", sa.Boolean(), nullable=True)
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
    )
    op.alter_column(
        "compliance_report_summary",
        "summary_id",
        existing_type=sa.INTEGER(),
        comment=None,
        existing_comment="Unique identifier for the compliance report summary",
        existing_nullable=False,
        autoincrement=True,
    )
    op.create_foreign_key(
        None,
        "compliance_report_summary",
        "compliance_report",
        ["compliance_report_id"],
        ["compliance_report_id"],
    )
    op.drop_column("compliance_report_summary", "diesel_category_deferred")
    op.drop_column("compliance_report_summary", "gasoline_category_deferred")
    op.drop_column("compliance_report_summary", "gasoline_category_retained")
    op.drop_column("compliance_report_summary", "diesel_category_obligation")
    op.drop_column("compliance_report_summary", "diesel_category_retained")
    op.drop_column("compliance_report_summary", "diesel_category_previously_retained")
    op.drop_column("compliance_report_summary", "gasoline_category_previously_retained")
    op.drop_column("compliance_report_summary", "gasoline_category_obligation")

    op.add_column(
        "fuel_supply",
        sa.Column(
            "supplemental_report_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the supplemental report",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "previous_fuel_supply_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the previous fuel supply record",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "quarter",
            postgresql.ENUM("Q1", "Q2", "Q3", "Q4", name="quarter", create_type=False),
            nullable=True,
            comment="Quarter for quarterly reports",
        ),
    )
    op.create_foreign_key(
        None,
        "fuel_supply",
        "supplemental_report",
        ["supplemental_report_id"],
        ["supplemental_report_id"],
    )
    op.create_foreign_key(
        None,
        "fuel_supply",
        "fuel_supply",
        ["previous_fuel_supply_id"],
        ["fuel_supply_id"],
    )
    op.create_table_comment(
        "fuel_supply",
        "Records the supply of fuel for compliance purposes, including changes in supplemental reports",
        existing_comment="Records the supply of fuel for compliance purposes.",
        schema=None,
    )
    op.drop_index("ix_organization_organization_code", table_name="organization")
    op.create_unique_constraint(
        "uq_organization_code", "organization", ["organization_code"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_organization_code", "organization", type_="unique")
    op.create_index(
        "ix_organization_organization_code",
        "organization",
        ["organization_code"],
        unique=True,
    )
    op.create_table_comment(
        "fuel_supply",
        "Records the supply of fuel for compliance purposes.",
        existing_comment="Records the supply of fuel for compliance purposes, including changes in supplemental reports",
        schema=None,
    )
    op.drop_constraint(None, "fuel_supply", type_="foreignkey")
    op.drop_constraint(None, "fuel_supply", type_="foreignkey")
    op.drop_column("fuel_supply", "quarter")
    op.drop_column("fuel_supply", "previous_fuel_supply_id")
    op.drop_column("fuel_supply", "supplemental_report_id")
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "gasoline_category_obligation",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Obligation for the gasoline category",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "gasoline_category_previously_retained",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Previously retained gasoline category units",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "diesel_category_previously_retained",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Previously retained diesel category units",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "diesel_category_retained",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Retained diesel category units",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "diesel_category_obligation",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Obligation for the diesel category",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "gasoline_category_retained",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Retained gasoline category units",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "gasoline_category_deferred",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Deferred gasoline category units",
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "diesel_category_deferred",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Deferred diesel category units",
        ),
    )
    op.drop_constraint(None, "compliance_report_summary", type_="foreignkey")
    op.alter_column(
        "compliance_report_summary",
        "summary_id",
        existing_type=sa.INTEGER(),
        comment="Unique identifier for the compliance report summary",
        existing_nullable=False,
        autoincrement=True,
    )
    op.drop_column("compliance_report_summary", "update_user")
    op.drop_column("compliance_report_summary", "create_user")
    op.drop_column("compliance_report_summary", "is_locked")
    op.drop_column("compliance_report_summary", "version")
    op.drop_column("compliance_report_summary", "quarter")
    op.drop_column("compliance_report_summary", "compliance_report_id")
    op.add_column(
        "compliance_report",
        sa.Column(
            "status_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Identifier for the compliance report status",
        ),
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "summary_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Identifier for the compliance report summary",
        ),
    )
    op.drop_constraint(None, "compliance_report", type_="foreignkey")
    op.create_foreign_key(
        "compliance_report_status_id_fkey",
        "compliance_report",
        "compliance_report_status",
        ["status_id"],
        ["compliance_report_status_id"],
    )
    op.create_foreign_key(
        "compliance_report_summary_id_fkey",
        "compliance_report",
        "compliance_report_summary",
        ["summary_id"],
        ["summary_id"],
    )
    op.drop_column("compliance_report", "report_type")
    op.drop_column("compliance_report", "current_status_id")
    op.create_table(
        "compliance_report_snapshot",
        sa.Column(
            "compliance_report_snapshot_id",
            sa.INTEGER(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the compliance report snapshot",
        ),
        sa.Column(
            "compliance_report_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Foreign key to the compliance report",
        ),
        sa.Column(
            "snapshot",
            postgresql.JSON(astext_type=sa.Text()),
            autoincrement=False,
            nullable=False,
            comment="JSON representation of the compliance report snapshot",
        ),
        sa.Column(
            "create_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name="compliance_report_snapshot_compliance_report_id_fkey",
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_snapshot_id", name="compliance_report_snapshot_pkey"
        ),
        comment="Stores snapshots of compliance reports at important status changes like recommended, approval, or cancellation",
    )
    op.drop_table("supplemental_report")
    sa.Enum("ANNUAL", "QUARTERLY", name="reporttype").drop(op.get_bind())
    sa.Enum("Q1", "Q2", "Q3", "Q4", name="quarter").drop(op.get_bind())
    sa.Enum("SUPPLEMENTAL", "REASSESSMENT", name="supplementalreporttype").drop(
        op.get_bind()
    )
