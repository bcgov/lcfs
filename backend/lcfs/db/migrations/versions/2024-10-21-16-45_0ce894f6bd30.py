"""supplemental report revisions

Revision ID: 0ce894f6bd30
Revises: 4f25f8811872
Create Date: 2024-10-21 16:45:30.473763

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0ce894f6bd30"
down_revision = "4f25f8811872"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    sa.Enum("ANNUAL", "QUARTERLY", name="reportingfrequency").create(op.get_bind())
    sa.Enum(
        "SUPPLIER_INITIATED_SUPPLEMENTAL",
        "GOVERNMENT_INITIATED_REASSESSMENT",
        name="supplementalinitiatortype",
    ).create(op.get_bind())

    op.drop_constraint(
        "fk_compliance_report_summary_supplemental_report_id_sup_038a",
        "compliance_report_summary",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_fuel_export_supplemental_report_id_supplemental_report",
        "fuel_export",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_fuel_supply_supplemental_report_id_supplemental_report",
        "fuel_supply",
        type_="foreignkey",
    )

    op.drop_table("supplemental_report")
    op.alter_column(
        "additional_carbon_intensity",
        "intensity",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_nullable=False,
    )
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

    op.add_column(
        "compliance_report",
        sa.Column(
            "original_report_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the original compliance report",
        ),
    )

    # Step 1: Add the chain_index column as nullable initially
    op.add_column(
        "compliance_report",
        sa.Column(
            "chain_index",
            sa.Integer(),
            nullable=True,
            server_default="0",  # Set database-level default
            comment="Position of the report in the chain of related reports",
        ),
    )

    # Step 2: Update any existing records to have chain_index = 0 if they're null
    op.execute("UPDATE compliance_report SET chain_index = 0 WHERE chain_index IS NULL")

    # Step 3: Alter the chain_index column to set it as NOT NULL
    op.alter_column(
        "compliance_report",
        "chain_index",
        existing_type=sa.Integer(),
        nullable=False,
        server_default="0",  # Maintain the default value
    )

    op.add_column(
        "compliance_report",
        sa.Column(
            "previous_report_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the previous compliance report",
        ),
    )

    op.add_column(
        "compliance_report",
        sa.Column(
            "supplemental_initiator",
            postgresql.ENUM(
                "SUPPLIER_INITIATED_SUPPLEMENTAL",
                "GOVERNMENT_INITIATED_REASSESSMENT",
                name="supplementalinitiatortype",
                create_type=False,
            ),
            nullable=True,
            comment="Whether supplier or gov initiated the supplemental.",
        ),
    )
    op.add_column(
        "compliance_report",
        sa.Column(
            "reporting_frequency",
            postgresql.ENUM(
                "ANNUAL", "QUARTERLY", name="reportingfrequency", create_type=False
            ),
            nullable=False,
            server_default="ANNUAL",
        ),
    )
    op.create_foreign_key(
        op.f("fk_compliance_report_previous_report_id_compliance_report"),
        "compliance_report",
        "compliance_report",
        ["previous_report_id"],
        ["compliance_report_id"],
    )
    op.create_foreign_key(
        op.f("fk_compliance_report_original_report_id_compliance_report"),
        "compliance_report",
        "compliance_report",
        ["original_report_id"],
        ["compliance_report_id"],
    )
    op.drop_column("compliance_report", "report_type")

    op.create_table_comment(
        "compliance_report_summary",
        "Summary of all compliance calculations displaying the compliance units over a compliance period",
        existing_comment="Summary of all compliance calculations displaying the compliance units credits or debits over a compliance period",
        schema=None,
    )
    op.drop_column("compliance_report_summary", "supplemental_report_id")
    op.drop_column("compliance_report_summary", "version")
    op.alter_column(
        "custom_fuel_type",
        "energy_density",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_comment="Energy density of the fuel",
        existing_nullable=False,
    )
    op.create_unique_constraint(
        op.f("uq_document_document_id"), "document", ["document_id"]
    )
    op.alter_column(
        "energy_density",
        "density",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_nullable=False,
    )
    op.alter_column(
        "energy_effectiveness_ratio",
        "ratio",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=3, asdecimal=2),
        existing_comment="Energy effectiveness ratio constant",
        existing_nullable=False,
    )

    op.drop_column("fuel_export", "supplemental_report_id")

    op.drop_column("fuel_supply", "supplemental_report_id")
    op.alter_column(
        "fuel_type",
        "default_carbon_intensity",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_comment="Carbon intensities: default & prescribed (gCO2e/MJ)",
        existing_nullable=True,
    )
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
    op.create_unique_constraint(
        op.f("uq_transfer_transfer_id"), "transfer", ["transfer_id"]
    )
    op.create_unique_constraint(
        op.f("uq_transfer_category_transfer_category_id"),
        "transfer_category",
        ["transfer_category_id"],
    )
    sa.Enum("SUPPLEMENTAL", "REASSESSMENT", name="supplementalreporttype").drop(
        op.get_bind()
    )
    sa.Enum("ANNUAL", "QUARTERLY", name="reporttype").drop(op.get_bind())
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    sa.Enum("ANNUAL", "QUARTERLY", name="reporttype").create(op.get_bind())
    sa.Enum("SUPPLEMENTAL", "REASSESSMENT", name="supplementalreporttype").create(
        op.get_bind()
    )
    op.drop_constraint(
        op.f("uq_transfer_category_transfer_category_id"),
        "transfer_category",
        type_="unique",
    )
    op.drop_constraint(op.f("uq_transfer_transfer_id"), "transfer", type_="unique")
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
    op.alter_column(
        "fuel_type",
        "default_carbon_intensity",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_comment="Carbon intensities: default & prescribed (gCO2e/MJ)",
        existing_nullable=True,
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
    op.create_foreign_key(
        "fk_fuel_supply_supplemental_report_id_supplemental_report",
        "fuel_supply",
        "supplemental_report",
        ["supplemental_report_id"],
        ["supplemental_report_id"],
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
    op.alter_column(
        "energy_effectiveness_ratio",
        "ratio",
        existing_type=sa.Float(precision=3, asdecimal=2),
        type_=sa.REAL(),
        existing_comment="Energy effectiveness ratio constant",
        existing_nullable=False,
    )
    op.alter_column(
        "energy_density",
        "density",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_nullable=False,
    )
    op.drop_constraint(op.f("uq_document_document_id"), "document", type_="unique")
    op.alter_column(
        "custom_fuel_type",
        "energy_density",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_comment="Energy density of the fuel",
        existing_nullable=False,
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("version", sa.INTEGER(), autoincrement=False, nullable=False),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "supplemental_report_id", sa.INTEGER(), autoincrement=False, nullable=True
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
            autoincrement=False,
            nullable=False,
        ),
    )
    op.drop_constraint(
        op.f("fk_compliance_report_original_report_id_compliance_report"),
        "compliance_report",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_compliance_report_previous_report_id_compliance_report"),
        "compliance_report",
        type_="foreignkey",
    )
    op.drop_column("compliance_report", "reporting_frequency")
    op.drop_column("compliance_report", "supplemental_initiator")
    op.drop_column("compliance_report", "chain_index")
    op.drop_column("compliance_report", "previous_report_id")
    op.drop_column("compliance_report", "original_report_id")
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
    op.alter_column(
        "additional_carbon_intensity",
        "intensity",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_nullable=False,
    )
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
            nullable=True,
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
    sa.Enum(
        "SUPPLIER_INITIATED_SUPPLEMENTAL",
        "GOVERNMENT_INITIATED_REASSESSMENT",
        name="supplementalinitiatortype",
    ).drop(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reportingfrequency").drop(op.get_bind())
    # ### end Alembic commands ###
