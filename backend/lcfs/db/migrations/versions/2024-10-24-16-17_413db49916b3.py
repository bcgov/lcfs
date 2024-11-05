"""supplemental reports and versioning

Revision ID: 413db49916b3
Revises: 1b4d0dcf70a8
Create Date: 2024-10-24 16:17:13.498002

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = "413db49916b3"
down_revision = "1b4d0dcf70a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sa.Enum("CREATE", "UPDATE", "DELETE", name="actiontypeenum").create(op.get_bind())
    sa.Enum("SUPPLIER", "GOVERNMENT", name="usertypeenum").create(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reportingfrequency").create(op.get_bind())
    sa.Enum(
        "SUPPLIER_SUPPLEMENTAL",
        "GOVERNMENT_REASSESSMENT",
        name="supplementalinitiatortype",
    ).create(op.get_bind())
    op.create_unique_constraint(
        op.f("uq_admin_adjustment_admin_adjustment_id"),
        "admin_adjustment",
        ["admin_adjustment_id"],
    )
    op.create_unique_constraint(
        op.f("uq_admin_adjustment_history_admin_adjustment_history_id"),
        "admin_adjustment_history",
        ["admin_adjustment_history_id"],
    )

    # Step 1: Add the columns as nullable
    op.add_column(
        "compliance_report",
        sa.Column(
            "compliance_report_group_uuid",
            sa.String(length=36),
            nullable=True,
            comment="UUID that groups all versions of a compliance report",
        ),
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "group_uuid",
            sa.String(length=36),
            nullable=True,
            comment="UUID that groups all versions of a record series",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "group_uuid",
            sa.String(length=36),
            nullable=True,
            comment="UUID that groups all versions of a record series",
        ),
    )

    # Step 2: Update existing records with generated UUIDs
    connection = op.get_bind()

    # Update compliance_report table
    compliance_reports = connection.execute(
        sa.text(
            "SELECT compliance_report_id FROM compliance_report WHERE compliance_report_group_uuid IS NULL"
        )
    ).fetchall()
    for report in compliance_reports:
        report_id = report[0]
        connection.execute(
            sa.text(
                "UPDATE compliance_report SET compliance_report_group_uuid = :uuid WHERE compliance_report_id = :report_id"
            ),
            {"uuid": str(uuid.uuid4()), "report_id": report_id},
        )

    # Update fuel_export table
    fuel_exports = connection.execute(
        sa.text("SELECT fuel_export_id FROM fuel_export WHERE group_uuid IS NULL")
    ).fetchall()
    for export in fuel_exports:
        export_id = export[0]
        connection.execute(
            sa.text(
                "UPDATE fuel_export SET group_uuid = :uuid WHERE fuel_export_id = :export_id"
            ),
            {"uuid": str(uuid.uuid4()), "export_id": export_id},
        )

    # Update fuel_supply table
    fuel_supplies = connection.execute(
        sa.text("SELECT fuel_supply_id FROM fuel_supply WHERE group_uuid IS NULL")
    ).fetchall()
    for supply in fuel_supplies:
        supply_id = supply[0]
        connection.execute(
            sa.text(
                "UPDATE fuel_supply SET group_uuid = :uuid WHERE fuel_supply_id = :supply_id"
            ),
            {"uuid": str(uuid.uuid4()), "supply_id": supply_id},
        )

    # Step 3: Alter the columns to be non-nullable
    op.alter_column(
        "compliance_report",
        "compliance_report_group_uuid",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.alter_column(
        "fuel_export",
        "group_uuid",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.alter_column(
        "fuel_supply",
        "group_uuid",
        existing_type=sa.String(length=36),
        nullable=False,
    )

    op.add_column(
        "compliance_report",
        sa.Column(
            "version",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Version number of the compliance report",
        ),
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "supplemental_initiator",
            postgresql.ENUM(
                "SUPPLIER_SUPPLEMENTAL",
                "GOVERNMENT_REASSESSMENT",
                name="supplementalinitiatortype",
                create_type=False,
            ),
            nullable=True,
            comment="Indicates whether supplier or government initiated the supplemental",
        ),
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "reporting_frequency",
            postgresql.ENUM(
                "ANNUAL", "QUARTERLY", name="reportingfrequency", create_type=False
            ),
            server_default=sa.text("'ANNUAL'"),
            nullable=False,
            comment="Reporting frequency",
        ),
    )
    op.alter_column(
        "compliance_report",
        "compliance_report_id",
        existing_type=sa.INTEGER(),
        comment="Unique identifier for the compliance report version",
        existing_comment="Unique identifier for the compliance report",
        existing_nullable=False,
        autoincrement=True,
        existing_server_default=sa.text(
            "nextval('compliance_report_compliance_report_id_seq'::regclass)"
        ),
    )
    op.create_table_comment(
        "compliance_report",
        "Main tracking table for all the sub-tables associated with a supplier's compliance report",
        existing_comment="Main tracking table for all the sub-tables associated with a supplier's annual compliance report",
        schema=None,
    )
    op.drop_column("compliance_report", "report_type")
    op.drop_constraint(
        "fk_compliance_report_summary_supplemental_report_id_sup_038a",
        "compliance_report_summary",
        type_="foreignkey",
    )
    op.create_table_comment(
        "compliance_report_summary",
        "Summary of all compliance calculations displaying the compliance units over a compliance period",
        existing_comment="Summary of all compliance calculations displaying the compliance units credits or debits over a compliance period",
        schema=None,
    )
    op.drop_column("compliance_report_summary", "version")
    op.drop_column("compliance_report_summary", "supplemental_report_id")
    op.create_unique_constraint(
        op.f("uq_document_document_id"), "document", ["document_id"]
    )
    op.alter_column(
        "energy_effectiveness_ratio",
        "ratio",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=3, decimal_return_scale=2),
        existing_comment="Energy effectiveness ratio constant",
        existing_nullable=False,
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "version",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Version number of the record",
        ),
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            nullable=False,
            server_default=sa.text("'SUPPLIER'"),
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
    )
    op.drop_constraint(
        "fk_fuel_export_previous_fuel_export_id_fuel_export",
        "fuel_export",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_fuel_export_supplemental_report_id_supplemental_report",
        "fuel_export",
        type_="foreignkey",
    )
    op.drop_column("fuel_export", "supplemental_report_id")
    op.drop_column("fuel_export", "change_type")
    op.drop_column("fuel_export", "previous_fuel_export_id")
    op.add_column(
        "fuel_supply",
        sa.Column(
            "version",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="Version number of the record",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            server_default=sa.text("'SUPPLIER'"),
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
    )
    op.alter_column(
        "fuel_supply",
        "fuel_supply_id",
        existing_type=sa.INTEGER(),
        comment="Unique identifier for the fuel supply version",
        existing_comment="Unique identifier for the fuel supply",
        existing_nullable=False,
        autoincrement=True,
    )
    op.alter_column(
        "fuel_supply",
        "compliance_units",
        existing_type=sa.INTEGER(),
        comment="Compliance units",
        existing_comment="Compliance units for the fuel supply",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "target_ci",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Target Carbon Intensity",
        existing_comment="Target CI for the fuel supply",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "ci_of_fuel",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="CI of the fuel",
        existing_comment="CI of fuel for the fuel supply",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "energy_density",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Energy density",
        existing_comment="Energy density of the fuel supplied",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "eer",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Energy Effectiveness Ratio",
        existing_comment="Energy effectiveness ratio of the fuel supplied",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "energy",
        existing_type=sa.INTEGER(),
        comment="Energy content",
        existing_comment="Energy content of the fuel supplied",
        existing_nullable=True,
    )
    op.drop_constraint(
        "fk_fuel_supply_supplemental_report_id_supplemental_report",
        "fuel_supply",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_fuel_supply_previous_fuel_supply_id_fuel_supply",
        "fuel_supply",
        type_="foreignkey",
    )
    op.drop_column("fuel_supply", "quarter")
    op.drop_column("fuel_supply", "previous_fuel_supply_id")
    op.drop_column("fuel_supply", "change_type")
    op.drop_column("fuel_supply", "supplemental_report_id")
    op.create_unique_constraint(
        op.f("uq_initiative_agreement_initiative_agreement_id"),
        "initiative_agreement",
        ["initiative_agreement_id"],
    )
    op.create_unique_constraint(
        op.f("uq_initiative_agreement_history_initiative_agreement_history_id"),
        "initiative_agreement_history",
        ["initiative_agreement_history_id"],
    )
    op.create_unique_constraint(
        op.f("uq_internal_comment_internal_comment_id"),
        "internal_comment",
        ["internal_comment_id"],
    )
    op.create_unique_constraint(
        op.f("uq_transaction_transaction_id"), "transaction", ["transaction_id"]
    )
    op.alter_column(
        "transfer",
        "price_per_unit",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Price per unit with two decimal places",
        existing_comment="Price per unit with two decimal precision",
        existing_nullable=True,
    )
    op.create_unique_constraint(
        op.f("uq_transfer_transfer_id"), "transfer", ["transfer_id"]
    )
    op.create_unique_constraint(
        op.f("uq_transfer_category_transfer_category_id"),
        "transfer_category",
        ["transfer_category_id"],
    )
    op.drop_table("supplemental_report")
    sa.Enum("ANNUAL", "QUARTERLY", name="reporttype").drop(op.get_bind())
    sa.Enum("CREATE", "UPDATE", "DELETE", name="changetype").drop(op.get_bind())
    sa.Enum("SUPPLEMENTAL", "REASSESSMENT", name="supplementalreporttype").drop(
        op.get_bind()
    )


def downgrade() -> None:
    sa.Enum("SUPPLEMENTAL", "REASSESSMENT", name="supplementalreporttype").create(
        op.get_bind()
    )
    sa.Enum("CREATE", "UPDATE", "DELETE", name="changetype").create(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reporttype").create(op.get_bind())
    op.create_table(
        "supplemental_report",
        sa.Column(
            "supplemental_report_id",
            sa.INTEGER(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the supplemental report",
        ),
        sa.Column(
            "original_report_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Foreign key to the original compliance report",
        ),
        sa.Column(
            "previous_report_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Foreign key to the previous supplemental report",
        ),
        sa.Column(
            "compliance_period_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Foreign key to the compliance period",
        ),
        sa.Column(
            "organization_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Identifier for the organization",
        ),
        sa.Column(
            "current_status_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=False,
            comment="Identifier for the compliance report status",
        ),
        sa.Column(
            "version",
            sa.INTEGER(),
            autoincrement=False,
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
            autoincrement=False,
            nullable=False,
            comment="Type of supplemental report",
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
        sa.Column(
            "create_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name="fk_supplemental_report_compliance_period_id_compliance_period",
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["compliance_report_status.compliance_report_status_id"],
            name="fk_supplemental_report_current_status_id_compliance_rep_dfe9",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name="fk_supplemental_report_organization_id_organization",
        ),
        sa.ForeignKeyConstraint(
            ["original_report_id"],
            ["compliance_report.compliance_report_id"],
            name="fk_supplemental_report_original_report_id_compliance_report",
        ),
        sa.ForeignKeyConstraint(
            ["previous_report_id"],
            ["supplemental_report.supplemental_report_id"],
            name="fk_supplemental_report_previous_report_id_supplemental_report",
        ),
        sa.PrimaryKeyConstraint(
            "supplemental_report_id", name="pk_supplemental_report"
        ),
        comment="Tracks supplemental reports and reassessments for compliance reports",
    )
    op.drop_constraint(
        op.f("uq_transfer_category_transfer_category_id"),
        "transfer_category",
        type_="unique",
    )
    op.drop_constraint(op.f("uq_transfer_transfer_id"), "transfer", type_="unique")
    op.alter_column(
        "transfer",
        "price_per_unit",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Price per unit with two decimal precision",
        existing_comment="Price per unit with two decimal places",
        existing_nullable=True,
    )
    op.drop_constraint(
        op.f("uq_transaction_transaction_id"), "transaction", type_="unique"
    )
    op.drop_constraint(
        op.f("uq_internal_comment_internal_comment_id"),
        "internal_comment",
        type_="unique",
    )
    op.drop_constraint(
        op.f("uq_initiative_agreement_history_initiative_agreement_history_id"),
        "initiative_agreement_history",
        type_="unique",
    )
    op.drop_constraint(
        op.f("uq_initiative_agreement_initiative_agreement_id"),
        "initiative_agreement",
        type_="unique",
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "supplemental_report_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Foreign key to the supplemental report",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "change_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="changetype", create_type=False
            ),
            server_default=sa.text("'CREATE'::changetype"),
            autoincrement=False,
            nullable=False,
            comment="Action type for this record",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "previous_fuel_supply_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Foreign key to the previous fuel supply record",
        ),
    )
    op.add_column(
        "fuel_supply",
        sa.Column(
            "quarter",
            postgresql.ENUM("Q1", "Q2", "Q3", "Q4", name="quarter", create_type=False),
            autoincrement=False,
            nullable=True,
            comment="Quarter for quarterly reports",
        ),
    )
    op.create_foreign_key(
        "fk_fuel_supply_previous_fuel_supply_id_fuel_supply",
        "fuel_supply",
        "fuel_supply",
        ["previous_fuel_supply_id"],
        ["fuel_supply_id"],
    )
    op.create_foreign_key(
        "fk_fuel_supply_supplemental_report_id_supplemental_report",
        "fuel_supply",
        "supplemental_report",
        ["supplemental_report_id"],
        ["supplemental_report_id"],
    )
    op.alter_column(
        "fuel_supply",
        "energy",
        existing_type=sa.INTEGER(),
        comment="Energy content of the fuel supplied",
        existing_comment="Energy content",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "eer",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Energy effectiveness ratio of the fuel supplied",
        existing_comment="Energy Effectiveness Ratio",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "energy_density",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Energy density of the fuel supplied",
        existing_comment="Energy density",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "ci_of_fuel",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="CI of fuel for the fuel supply",
        existing_comment="CI of the fuel",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "target_ci",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        comment="Target CI for the fuel supply",
        existing_comment="Target Carbon Intensity",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "compliance_units",
        existing_type=sa.INTEGER(),
        comment="Compliance units for the fuel supply",
        existing_comment="Compliance units",
        existing_nullable=True,
    )
    op.alter_column(
        "fuel_supply",
        "fuel_supply_id",
        existing_type=sa.INTEGER(),
        comment="Unique identifier for the fuel supply",
        existing_comment="Unique identifier for the fuel supply version",
        existing_nullable=False,
        autoincrement=True,
    )
    op.drop_column("fuel_supply", "action_type")
    op.drop_column("fuel_supply", "user_type")
    op.drop_column("fuel_supply", "version")
    op.drop_column("fuel_supply", "group_uuid")
    op.add_column(
        "fuel_export",
        sa.Column(
            "previous_fuel_export_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Foreign key to the previous fuel supply record",
        ),
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "change_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="changetype", create_type=False
            ),
            server_default=sa.text("'CREATE'::changetype"),
            autoincrement=False,
            nullable=False,
            comment="Action type for this record",
        ),
    )
    op.add_column(
        "fuel_export",
        sa.Column(
            "supplemental_report_id",
            sa.INTEGER(),
            autoincrement=False,
            nullable=True,
            comment="Foreign key to the supplemental report",
        ),
    )
    op.create_foreign_key(
        "fk_fuel_export_supplemental_report_id_supplemental_report",
        "fuel_export",
        "supplemental_report",
        ["supplemental_report_id"],
        ["supplemental_report_id"],
    )
    op.create_foreign_key(
        "fk_fuel_export_previous_fuel_export_id_fuel_export",
        "fuel_export",
        "fuel_export",
        ["previous_fuel_export_id"],
        ["fuel_export_id"],
    )
    op.drop_column("fuel_export", "action_type")
    op.drop_column("fuel_export", "user_type")
    op.drop_column("fuel_export", "version")
    op.drop_column("fuel_export", "group_uuid")
    op.alter_column(
        "energy_effectiveness_ratio",
        "ratio",
        existing_type=sa.Float(precision=3, decimal_return_scale=2),
        type_=sa.REAL(),
        existing_comment="Energy effectiveness ratio constant",
        existing_nullable=False,
    )
    op.drop_constraint(op.f("uq_document_document_id"), "document", type_="unique")
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "supplemental_report_id", sa.INTEGER(), autoincrement=False, nullable=True
        ),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "version",
            sa.INTEGER(),
            server_default=sa.text("1"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.create_table_comment(
        "compliance_report_summary",
        "Summary of all compliance calculations displaying the compliance units credits or debits over a compliance period",
        existing_comment="Summary of all compliance calculations displaying the compliance units over a compliance period",
        schema=None,
    )
    op.create_foreign_key(
        "fk_compliance_report_summary_supplemental_report_id_sup_038a",
        "compliance_report_summary",
        "supplemental_report",
        ["supplemental_report_id"],
        ["supplemental_report_id"],
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "report_type",
            postgresql.ENUM(
                "ANNUAL", "QUARTERLY", name="reporttype", create_type=False
            ),
            server_default=sa.text("'ANNUAL'::reporttype"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.create_table_comment(
        "compliance_report",
        "Main tracking table for all the sub-tables associated with a supplier's annual compliance report",
        existing_comment="Main tracking table for all the sub-tables associated with a supplier's compliance report",
        schema=None,
    )
    op.alter_column(
        "compliance_report",
        "compliance_report_id",
        existing_type=sa.INTEGER(),
        comment="Unique identifier for the compliance report",
        existing_comment="Unique identifier for the compliance report version",
        existing_nullable=False,
        autoincrement=True,
        existing_server_default=sa.text(
            "nextval('compliance_report_compliance_report_id_seq'::regclass)"
        ),
    )
    op.drop_column("compliance_report", "reporting_frequency")
    op.drop_column("compliance_report", "supplemental_initiator")
    op.drop_column("compliance_report", "version")
    op.drop_column("compliance_report", "compliance_report_group_uuid")
    op.drop_constraint(
        op.f("uq_admin_adjustment_history_admin_adjustment_history_id"),
        "admin_adjustment_history",
        type_="unique",
    )
    op.drop_constraint(
        op.f("uq_admin_adjustment_admin_adjustment_id"),
        "admin_adjustment",
        type_="unique",
    )
    sa.Enum(
        "SUPPLIER_SUPPLEMENTAL",
        "GOVERNMENT_REASSESSMENT",
        name="supplementalinitiatortype",
    ).drop(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reportingfrequency").drop(op.get_bind())
    sa.Enum("SUPPLIER", "GOVERNMENT", name="usertypeenum").drop(op.get_bind())
    sa.Enum("CREATE", "UPDATE", "DELETE", name="actiontypeenum").drop(op.get_bind())
