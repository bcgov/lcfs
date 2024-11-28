"""initial migration

Revision ID: 2c69188b9d1c
Revises: 
Create Date: 2024-11-27 17:15:51.387625

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2c69188b9d1c"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    sa.Enum(
        "GOVERNMENT",
        "ADMINISTRATOR",
        "ANALYST",
        "COMPLIANCE_MANAGER",
        "DIRECTOR",
        "SUPPLIER",
        "MANAGE_USERS",
        "TRANSFER",
        "COMPLIANCE_REPORTING",
        "SIGNING_AUTHORITY",
        "READ_ONLY",
        name="role_enum",
    ).create(op.get_bind())
    sa.Enum(
        "Draft",
        "Deleted",
        "Sent",
        "Submitted",
        "Recommended",
        "Recorded",
        "Refused",
        "Declined",
        "Rescinded",
        name="transfer_type_enum",
    ).create(op.get_bind())
    sa.Enum("A", "B", "C", "D", name="transfercategoryenum").create(op.get_bind())
    sa.Enum("Record", "Refuse", name="transfer_recommendation_enum").create(
        op.get_bind()
    )
    sa.Enum(
        "Adjustment", "Reserved", "Released", name="transaction_action_enum"
    ).create(op.get_bind())
    sa.Enum(
        "TRANSFER_PARTNER_UPDATE",
        "TRANSFER_DIRECTOR_REVIEW",
        "INITIATIVE_APPROVED",
        "INITIATIVE_DA_REQUEST",
        "SUPPLEMENTAL_REQUESTED",
        "DIRECTOR_ASSESSMENT",
        name="notification_type_enum",
    ).create(op.get_bind())
    sa.Enum(
        "fuel_supplier",
        "electricity_supplier",
        "broker",
        "utilities",
        name="org_type_enum",
    ).create(op.get_bind())
    sa.Enum(
        "Unregistered", "Registered", "Suspended", "Canceled", name="org_status_enum"
    ).create(op.get_bind())
    sa.Enum("EMAIL", "IN_APP", name="channel_enum").create(op.get_bind())
    sa.Enum(
        "Draft",
        "Recommended",
        "Approved",
        "Deleted",
        name="initiative_agreement_type_enum",
    ).create(op.get_bind())
    sa.Enum("Draft", "Approved", "Deleted", name="fuel_code_status_enum").create(
        op.get_bind()
    )
    sa.Enum("Gasoline", "Diesel", "Jet fuel", name="fuel_category_enum").create(
        op.get_bind()
    )
    sa.Enum("Received", "Transferred", name="receivedortransferredenum").create(
        op.get_bind()
    )
    sa.Enum("Q1", "Q2", "Q3", "Q4", name="quarter").create(op.get_bind())
    sa.Enum("CREATE", "UPDATE", "DELETE", name="actiontypeenum").create(op.get_bind())
    sa.Enum("SUPPLIER", "GOVERNMENT", name="usertypeenum").create(op.get_bind())
    sa.Enum(
        "Litres", "Kilograms", "Kilowatt_hour", "Cubic_metres", name="quantityunitsenum"
    ).create(op.get_bind())
    sa.Enum("Single port", "Dual port", name="ports_enum").create(op.get_bind())
    sa.Enum(
        "Draft",
        "Submitted",
        "Recommended_by_analyst",
        "Recommended_by_manager",
        "Assessed",
        "ReAssessed",
        name="compliancereportstatusenum",
    ).create(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reportingfrequency").create(op.get_bind())
    sa.Enum(
        "SUPPLIER_SUPPLEMENTAL",
        "GOVERNMENT_REASSESSMENT",
        name="supplementalinitiatortype",
    ).create(op.get_bind())
    sa.Enum("Director", "Analyst", "Compliance Manager", name="audience_scope").create(
        op.get_bind()
    )
    sa.Enum(
        "Draft", "Recommended", "Approved", "Deleted", name="admin_adjustment_type_enum"
    ).create(op.get_bind())
    op.create_table(
        "admin_adjustment_status",
        sa.Column(
            "admin_adjustment_status_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "Draft",
                "Recommended",
                "Approved",
                "Deleted",
                name="admin_adjustment_type_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Admin Adjustment Status",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "admin_adjustment_status_id", name=op.f("pk_admin_adjustment_status")
        ),
        comment="Represents a Admin Adjustment Status",
    )
    op.create_table(
        "allocation_transaction_type",
        sa.Column(
            "allocation_transaction_type_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the allocation transaction type",
        ),
        sa.Column(
            "type",
            sa.String(),
            nullable=False,
            comment="Type of the allocation transaction",
        ),
        sa.Column(
            "description",
            sa.String(),
            nullable=True,
            comment="Description of the allocation transaction type",
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
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "allocation_transaction_type_id",
            name=op.f("pk_allocation_transaction_type"),
        ),
        comment="Lookup table for allocation transaction types.",
    )
    op.create_table(
        "audit_log",
        sa.Column(
            "audit_log_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for each audit log entry.",
        ),
        sa.Column(
            "table_name",
            sa.Text(),
            nullable=False,
            comment="Name of the table where the action occurred.",
        ),
        sa.Column(
            "operation",
            sa.Text(),
            nullable=False,
            comment="Type of operation: 'INSERT', 'UPDATE', or 'DELETE'.",
        ),
        sa.Column(
            "row_id",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment="Primary key of the affected row, stored as JSONB to support composite keys.",
        ),
        sa.Column(
            "old_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Previous values before the operation.",
        ),
        sa.Column(
            "new_values",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="New values after the operation.",
        ),
        sa.Column(
            "delta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="JSONB delta of the changes.",
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
        sa.PrimaryKeyConstraint("audit_log_id", name=op.f("pk_audit_log")),
        comment="Track changes in defined tables.",
    )
    op.create_index(
        "idx_audit_log_create_date", "audit_log", ["create_date"], unique=False
    )
    op.create_index(
        "idx_audit_log_create_user", "audit_log", ["create_user"], unique=False
    )
    op.create_index(
        "idx_audit_log_delta",
        "audit_log",
        ["delta"],
        unique=False,
        postgresql_using="gin",
    )
    op.create_index("idx_audit_log_operation", "audit_log", ["operation"], unique=False)
    op.create_table(
        "compliance_period",
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the compliance period",
        ),
        sa.Column(
            "description",
            sa.String(),
            nullable=False,
            comment="Year description for the compliance period",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Display order for the compliance period",
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
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "compliance_period_id", name=op.f("pk_compliance_period")
        ),
        comment="The compliance year associated with compliance reports and other related tables. The description field should be the year.",
    )
    op.create_table(
        "compliance_report_status",
        sa.Column(
            "compliance_report_status_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the compliance report status",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Display order for the compliance report status",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "Draft",
                "Submitted",
                "Recommended_by_analyst",
                "Recommended_by_manager",
                "Assessed",
                "ReAssessed",
                name="compliancereportstatusenum",
                create_type=False,
            ),
            nullable=False,
            comment="Status of the compliance report",
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
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_status_id", name=op.f("pk_compliance_report_status")
        ),
        comment="Lookup table for compliance reports status",
    )
    op.create_table(
        "document",
        sa.Column(
            "document_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the document",
        ),
        sa.Column("file_key", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=False),
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
        sa.PrimaryKeyConstraint("document_id", name=op.f("pk_document")),
        sa.UniqueConstraint("document_id", name=op.f("uq_document_document_id")),
        comment="Main document table for storing base document information",
    )
    op.create_table(
        "end_use_type",
        sa.Column("end_use_type_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("sub_type", sa.Text(), nullable=True),
        sa.Column("intended_use", sa.Boolean(), nullable=False),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("end_use_type_id", name=op.f("pk_end_use_type")),
        comment="Represents a end use types for various fuel types and categories",
    )
    op.create_table(
        "end_user_type",
        sa.Column(
            "end_user_type_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="The unique identifier for the end user type.",
        ),
        sa.Column(
            "type_name",
            sa.String(),
            nullable=False,
            comment="The name of the end user type.",
        ),
        sa.Column("intended_use", sa.Boolean(), nullable=False),
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
        sa.PrimaryKeyConstraint("end_user_type_id", name=op.f("pk_end_user_type")),
        sa.UniqueConstraint("type_name", name=op.f("uq_end_user_type_type_name")),
        comment="Types of intended users for supply equipment",
    )
    op.create_table(
        "expected_use_type",
        sa.Column(
            "expected_use_type_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the expected use type",
        ),
        sa.Column(
            "name", sa.Text(), nullable=False, comment="Name of the expected use type"
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Description of the expected use type",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "expected_use_type_id", name=op.f("pk_expected_use_type")
        ),
        comment="Represents an expected use type for other fuels",
    )
    op.create_table(
        "final_supply_equipment_reg_number",
        sa.Column(
            "organization_code",
            sa.String(),
            nullable=False,
            comment="The organization code for the final supply equipment.",
        ),
        sa.Column(
            "postal_code",
            sa.String(),
            nullable=False,
            comment="The postal code for the final supply equipment.",
        ),
        sa.Column(
            "current_sequence_number",
            sa.Integer(),
            nullable=False,
            comment="Current sequence number used for the postal code.",
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
        sa.PrimaryKeyConstraint(
            "organization_code",
            "postal_code",
            name=op.f("pk_final_supply_equipment_reg_number"),
        ),
        comment="Tracks the highest sequence numbers for final supply equipment registration numbers by postal code and organization code.",
    )
    op.create_table(
        "fuel_category",
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel category",
        ),
        sa.Column(
            "category",
            postgresql.ENUM(
                "Gasoline",
                "Diesel",
                "Jet fuel",
                name="fuel_category_enum",
                create_type=False,
            ),
            nullable=False,
            comment="Name of the fuel category",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Description of the fuel categor",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint("fuel_category_id", name=op.f("pk_fuel_category")),
        comment="Represents a static table for fuel categories",
    )
    op.create_table(
        "fuel_code_prefix",
        sa.Column(
            "fuel_code_prefix_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("prefix", sa.Text(), nullable=False),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "fuel_code_prefix_id", name=op.f("pk_fuel_code_prefix")
        ),
        comment="Represents a Fuel code prefix",
    )
    op.create_table(
        "fuel_code_status",
        sa.Column(
            "fuel_code_status_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "Draft",
                "Approved",
                "Deleted",
                name="fuel_code_status_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Fuel code status",
        ),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment="Organization description",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "fuel_code_status_id", name=op.f("pk_fuel_code_status")
        ),
        comment="Represents fuel code status",
    )
    op.create_table(
        "fuel_measurement_type",
        sa.Column(
            "fuel_measurement_type_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel measurement type",
        ),
        sa.Column(
            "type",
            sa.String(),
            nullable=False,
            comment="Name of the fuel measurement type",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Description of the fuel measurement type",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "fuel_measurement_type_id", name=op.f("pk_fuel_measurement_type")
        ),
        comment="Fuel measurement type",
    )
    op.create_table(
        "initiative_agreement_status",
        sa.Column(
            "initiative_agreement_status_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "Draft",
                "Recommended",
                "Approved",
                "Deleted",
                name="initiative_agreement_type_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Initiative Agreement Status",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "initiative_agreement_status_id",
            name=op.f("pk_initiative_agreement_status"),
        ),
        comment="Represents a InitiativeAgreement Status",
    )
    op.create_table(
        "internal_comment",
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Primary key, unique identifier for each internal comment.",
        ),
        sa.Column("comment", sa.Text(), nullable=True, comment="Text of the comment."),
        sa.Column(
            "audience_scope",
            postgresql.ENUM(
                "Director",
                "Analyst",
                "Compliance Manager",
                name="audience_scope",
                create_type=False,
            ),
            nullable=False,
            comment="Defines the audience scope for the comment, e.g., Director, Analyst, Compliance Manager",
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
        sa.PrimaryKeyConstraint(
            "internal_comment_id", name=op.f("pk_internal_comment")
        ),
        sa.UniqueConstraint(
            "internal_comment_id", name=op.f("uq_internal_comment_internal_comment_id")
        ),
        comment="Stores internal comments with scope and related metadata.",
    )
    op.create_table(
        "level_of_equipment",
        sa.Column(
            "level_of_equipment_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("name", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "level_of_equipment_id", name=op.f("pk_level_of_equipment")
        ),
        comment="Represents a level of equipment for fuel supply equipments",
    )
    op.create_table(
        "notification_channel",
        sa.Column(
            "notification_channel_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column(
            "channel_name",
            postgresql.ENUM("EMAIL", "IN_APP", name="channel_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("enabled", sa.Boolean(), nullable=True),
        sa.Column("subscribe_by_default", sa.Boolean(), nullable=True),
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
        sa.PrimaryKeyConstraint(
            "notification_channel_id", name=op.f("pk_notification_channel")
        ),
        comment="Tracks the state and defaults for communication channels",
    )
    op.create_table(
        "notification_type",
        sa.Column(
            "notification_type_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column(
            "name",
            postgresql.ENUM(
                "TRANSFER_PARTNER_UPDATE",
                "TRANSFER_DIRECTOR_REVIEW",
                "INITIATIVE_APPROVED",
                "INITIATIVE_DA_REQUEST",
                "SUPPLEMENTAL_REQUESTED",
                "DIRECTOR_ASSESSMENT",
                name="notification_type_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("email_content", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint(
            "notification_type_id", name=op.f("pk_notification_type")
        ),
        comment="Represents a Notification type",
    )
    op.create_table(
        "organization_address",
        sa.Column(
            "organization_address_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column(
            "name", sa.String(length=500), nullable=True, comment="Organization name"
        ),
        sa.Column("street_address", sa.String(length=500), nullable=True),
        sa.Column("address_other", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("province_state", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("postalCode_zipCode", sa.String(length=10), nullable=True),
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "organization_address_id", name=op.f("pk_organization_address")
        ),
        comment="Represents an organization's address.",
    )
    op.create_table(
        "organization_attorney_address",
        sa.Column(
            "organization_attorney_address_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=500),
            nullable=True,
            comment="Attorney's Organization name",
        ),
        sa.Column("street_address", sa.String(length=500), nullable=True),
        sa.Column("address_other", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("province_state", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("postalCode_zipCode", sa.String(length=10), nullable=True),
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "organization_attorney_address_id",
            name=op.f("pk_organization_attorney_address"),
        ),
        comment="Represents an organization attorney's address.",
    )
    op.create_table(
        "organization_status",
        sa.Column(
            "organization_status_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the organization",
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "Unregistered",
                "Registered",
                "Suspended",
                "Canceled",
                name="org_status_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Organization's status",
        ),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment="Organization description",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "organization_status_id", name=op.f("pk_organization_status")
        ),
        comment="Contains list of organization type",
    )
    op.create_table(
        "organization_type",
        sa.Column(
            "organization_type_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the organization_type",
        ),
        sa.Column(
            "org_type",
            postgresql.ENUM(
                "fuel_supplier",
                "electricity_supplier",
                "broker",
                "utilities",
                name="org_type_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Organization's Types",
        ),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment="Organization Types",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint(
            "organization_type_id", name=op.f("pk_organization_type")
        ),
        comment="Represents a Organization types",
    )
    op.create_table(
        "provision_of_the_act",
        sa.Column(
            "provision_of_the_act_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the provision of the act",
        ),
        sa.Column(
            "name",
            sa.String(length=100),
            nullable=False,
            comment="Name of the Provision. e.g. Section 19 (a)",
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=False,
            comment="Description of the provision. This is the displayed name. e.g. Prescribed Carbon Intensity, Approved Fuel Code.",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "provision_of_the_act_id", name=op.f("pk_provision_of_the_act")
        ),
        sa.UniqueConstraint("name", name=op.f("uq_provision_of_the_act_name")),
        comment="List of provisions within Greenhouse Gas Reduction\n         (Renewable and Low Carbon Fuel Requirement) Act. e.g. Section 19 (a).\n         Used in determining carbon intensity needed for for compliance reporting calculation.",
    )
    op.create_table(
        "role",
        sa.Column("role_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "name",
            postgresql.ENUM(
                "GOVERNMENT",
                "ADMINISTRATOR",
                "ANALYST",
                "COMPLIANCE_MANAGER",
                "DIRECTOR",
                "SUPPLIER",
                "MANAGE_USERS",
                "TRANSFER",
                "COMPLIANCE_REPORTING",
                "SIGNING_AUTHORITY",
                "READ_ONLY",
                name="role_enum",
                create_type=False,
            ),
            nullable=False,
            comment="Role code. Natural key. Used internally. eg Admin, GovUser, GovDirector, etc",
        ),
        sa.Column(
            "description",
            sa.String(length=1000),
            nullable=True,
            comment="Descriptive text explaining this role. This is what's shown to the user.",
        ),
        sa.Column(
            "is_government_role",
            sa.Boolean(),
            nullable=True,
            comment="Flag. True if this is a government role (eg. Analyst, Administrator)",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
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
        sa.PrimaryKeyConstraint("role_id", name=op.f("pk_role")),
        sa.UniqueConstraint("name", name=op.f("uq_role_name")),
        sa.UniqueConstraint("name", name=op.f("uq_role_name")),
        comment="To hold all the available roles and  their descriptions.",
    )
    op.create_table(
        "transfer_category",
        sa.Column(
            "transfer_category_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the transfer category",
        ),
        sa.Column(
            "category",
            postgresql.ENUM(
                "A", "B", "C", "D", name="transfercategoryenum", create_type=False
            ),
            nullable=True,
            comment="Transfer category",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint(
            "transfer_category_id", name=op.f("pk_transfer_category")
        ),
        sa.UniqueConstraint(
            "transfer_category_id",
            name=op.f("uq_transfer_category_transfer_category_id"),
        ),
        comment="Transfer Category",
    )
    op.create_table(
        "transfer_status",
        sa.Column(
            "transfer_status_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "Draft",
                "Deleted",
                "Sent",
                "Submitted",
                "Recommended",
                "Recorded",
                "Refused",
                "Declined",
                "Rescinded",
                name="transfer_type_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Transfer Status",
        ),
        sa.Column(
            "visible_to_transferor",
            sa.Boolean(),
            nullable=True,
            comment="Visibility for transferor entities",
        ),
        sa.Column(
            "visible_to_transferee",
            sa.Boolean(),
            nullable=True,
            comment="Visibility for transferee entities",
        ),
        sa.Column(
            "visible_to_government",
            sa.Boolean(),
            nullable=True,
            comment="Visibility for government entities",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("transfer_status_id", name=op.f("pk_transfer_status")),
        comment="Represents a Transfer Status",
    )
    op.create_table(
        "transport_mode",
        sa.Column(
            "transport_mode_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("transport_mode", sa.Text(), nullable=False),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("transport_mode_id", name=op.f("pk_transport_mode")),
        comment="Represents a Transport Mode Type",
    )
    op.create_table(
        "unit_of_measure",
        sa.Column("uom_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("uom_id", name=op.f("pk_unit_of_measure")),
        comment="Units used to measure energy densities",
    )
    op.create_table(
        "user_login_history",
        sa.Column("user_login_history_id", sa.Integer(), nullable=False),
        sa.Column(
            "keycloak_email",
            sa.String(),
            nullable=False,
            comment="Keycloak email address to associate on first login.",
        ),
        sa.Column(
            "external_username",
            sa.String(length=150),
            nullable=True,
            comment="BCeID or IDIR username",
        ),
        sa.Column(
            "keycloak_user_id",
            sa.String(length=150),
            nullable=True,
            comment="This is the unique id returned from Keycloak and is the main mapping key between the LCFS user and the Keycloak user. The identity provider type will be appended as a suffix after an @ symbol. For ex. asdf1234@bceidbasic or asdf1234@idir",
        ),
        sa.Column(
            "is_login_successful",
            sa.Boolean(),
            nullable=True,
            comment="True if this login attempt was successful, false on failure.",
        ),
        sa.Column(
            "login_error_message",
            sa.String(length=500),
            nullable=True,
            comment="Error text on unsuccessful login attempt.",
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
        sa.PrimaryKeyConstraint(
            "user_login_history_id", name=op.f("pk_user_login_history")
        ),
        comment="Keeps track of all user login attempts",
    )
    op.create_table(
        "fuel_type",
        sa.Column("fuel_type_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fuel_type", sa.Text(), nullable=False),
        sa.Column(
            "fossil_derived",
            sa.Boolean(),
            nullable=True,
            comment="Indicates whether the fuel is fossil-derived",
        ),
        sa.Column(
            "other_uses_fossil_derived",
            sa.Boolean(),
            nullable=True,
            comment="Indicates whether the fuel is fossil-derived for other uses",
        ),
        sa.Column("provision_1_id", sa.Integer(), nullable=True),
        sa.Column("provision_2_id", sa.Integer(), nullable=True),
        sa.Column(
            "default_carbon_intensity",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Carbon intensities: default & prescribed (gCO2e/MJ)",
        ),
        sa.Column(
            "units",
            postgresql.ENUM(
                "Litres",
                "Kilograms",
                "Kilowatt_hour",
                "Cubic_metres",
                name="quantityunitsenum",
                create_type=False,
            ),
            nullable=False,
            comment="Units of fuel quantity",
        ),
        sa.Column(
            "unrecognized",
            sa.Boolean(),
            nullable=False,
            comment="Indicates if the fuel type is unrecognized",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.ForeignKeyConstraint(
            ["provision_1_id"],
            ["provision_of_the_act.provision_of_the_act_id"],
            name=op.f("fk_fuel_type_provision_1_id_provision_of_the_act"),
        ),
        sa.ForeignKeyConstraint(
            ["provision_2_id"],
            ["provision_of_the_act.provision_of_the_act_id"],
            name=op.f("fk_fuel_type_provision_2_id_provision_of_the_act"),
        ),
        sa.PrimaryKeyConstraint("fuel_type_id", name=op.f("pk_fuel_type")),
        comment="Represents a Fuel Type",
    )
    op.create_table(
        "organization",
        sa.Column(
            "organization_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the organization",
        ),
        sa.Column(
            "organization_code",
            sa.String(length=4),
            nullable=False,
            comment="Unique 4-character alphanumeric ID",
        ),
        sa.Column(
            "name",
            sa.String(length=500),
            nullable=True,
            comment="Organization's legal name",
        ),
        sa.Column(
            "operating_name",
            sa.String(length=500),
            nullable=True,
            comment="Organization's Operating name",
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
            comment="Organization's email address",
        ),
        sa.Column(
            "phone",
            sa.String(length=50),
            nullable=True,
            comment="Organization's phone number",
        ),
        sa.Column(
            "edrms_record",
            sa.String(length=100),
            nullable=True,
            comment="Organization's EDRMS record number",
        ),
        sa.Column(
            "total_balance",
            sa.BigInteger(),
            server_default="0",
            nullable=False,
            comment="The total balance of compliance units for the specified organization.",
        ),
        sa.Column(
            "reserved_balance",
            sa.BigInteger(),
            server_default="0",
            nullable=False,
            comment="The reserved balance of compliance units for the specified organization.",
        ),
        sa.Column(
            "count_transfers_in_progress",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="The count of transfers in progress for the specified organization.",
        ),
        sa.Column("organization_status_id", sa.Integer(), nullable=True),
        sa.Column(
            "organization_type_id",
            sa.Integer(),
            nullable=True,
            comment="Organization's type",
        ),
        sa.Column("organization_address_id", sa.Integer(), nullable=True),
        sa.Column("organization_attorney_address_id", sa.Integer(), nullable=True),
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["organization_address_id"],
            ["organization_address.organization_address_id"],
            name=op.f("fk_organization_organization_address_id_organization_address"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_attorney_address_id"],
            ["organization_attorney_address.organization_attorney_address_id"],
            name=op.f(
                "fk_organization_organization_attorney_address_id_organization_attorney_address"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["organization_status_id"],
            ["organization_status.organization_status_id"],
            name=op.f("fk_organization_organization_status_id_organization_status"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_type_id"],
            ["organization_type.organization_type_id"],
            name=op.f("fk_organization_organization_type_id_organization_type"),
        ),
        sa.PrimaryKeyConstraint("organization_id", name=op.f("pk_organization")),
        sa.UniqueConstraint(
            "organization_code", name=op.f("uq_organization_organization_code")
        ),
        comment="Contains a list of all of the recognized Part 3 fuel suppliers, both past and present, as well as an entry for the government which is also considered an organization.",
    )
    op.create_table(
        "target_carbon_intensity",
        sa.Column(
            "target_carbon_intensity_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            nullable=False,
            comment="Compliance period ID",
        ),
        sa.Column(
            "fuel_category_id", sa.Integer(), nullable=False, comment="Fuel category ID"
        ),
        sa.Column(
            "target_carbon_intensity",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            comment="Target Carbon Intensity (gCO2e/MJ)",
        ),
        sa.Column(
            "reduction_target_percentage",
            sa.Float(),
            nullable=False,
            comment="Reduction target percentage",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name=op.f(
                "fk_target_carbon_intensity_compliance_period_id_compliance_period"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_target_carbon_intensity_fuel_category_id_fuel_category"),
        ),
        sa.PrimaryKeyConstraint(
            "target_carbon_intensity_id", name=op.f("pk_target_carbon_intensity")
        ),
        comment="Target carbon intensity values for various fuel categories",
    )
    op.create_table(
        "additional_carbon_intensity",
        sa.Column(
            "additional_uci_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=True),
        sa.Column("end_use_type_id", sa.Integer(), nullable=True),
        sa.Column("uom_id", sa.Integer(), nullable=False),
        sa.Column("intensity", sa.Numeric(precision=10, scale=2), nullable=False),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.ForeignKeyConstraint(
            ["end_use_type_id"],
            ["end_use_type.end_use_type_id"],
            name=op.f("fk_additional_carbon_intensity_end_use_type_id_end_use_type"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_additional_carbon_intensity_fuel_type_id_fuel_type"),
        ),
        sa.ForeignKeyConstraint(
            ["uom_id"],
            ["unit_of_measure.uom_id"],
            name=op.f("fk_additional_carbon_intensity_uom_id_unit_of_measure"),
        ),
        sa.PrimaryKeyConstraint(
            "additional_uci_id", name=op.f("pk_additional_carbon_intensity")
        ),
        comment="Additional carbon intensity attributable to the use of fuel. UCIs are added to the recorded carbon intensity of the fuel to account for additional carbon intensity attributed to the use of the fuel.",
    )
    op.create_table(
        "energy_density",
        sa.Column(
            "energy_density_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=False),
        sa.Column("density", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("uom_id", sa.Integer(), nullable=False),
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_energy_density_fuel_type_id_fuel_type"),
        ),
        sa.ForeignKeyConstraint(
            ["uom_id"],
            ["unit_of_measure.uom_id"],
            name=op.f("fk_energy_density_uom_id_unit_of_measure"),
        ),
        sa.PrimaryKeyConstraint("energy_density_id", name=op.f("pk_energy_density")),
        comment="Represents Energy Density data table",
    )
    op.create_table(
        "energy_effectiveness_ratio",
        sa.Column("eer_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "fuel_category_id", sa.Integer(), nullable=False, comment="Fuel category"
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=True, comment="Fuel type"),
        sa.Column(
            "end_use_type_id", sa.Integer(), nullable=True, comment="End use type"
        ),
        sa.Column(
            "ratio",
            sa.Float(precision=3, decimal_return_scale=2),
            nullable=False,
            comment="Energy effectiveness ratio constant",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["end_use_type_id"],
            ["end_use_type.end_use_type_id"],
            name=op.f("fk_energy_effectiveness_ratio_end_use_type_id_end_use_type"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_energy_effectiveness_ratio_fuel_category_id_fuel_category"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_energy_effectiveness_ratio_fuel_type_id_fuel_type"),
        ),
        sa.PrimaryKeyConstraint("eer_id", name=op.f("pk_energy_effectiveness_ratio")),
        comment="Energy effectiveness ratio (EERs)",
    )
    op.create_table(
        "fuel_code",
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel code",
        ),
        sa.Column(
            "fuel_status_id", sa.Integer(), nullable=True, comment="Fuel code status"
        ),
        sa.Column("prefix_id", sa.Integer(), nullable=False, comment="Prefix ID"),
        sa.Column(
            "fuel_suffix", sa.String(length=20), nullable=False, comment="Fuel suffix"
        ),
        sa.Column(
            "company", sa.String(length=500), nullable=False, comment="Company name"
        ),
        sa.Column(
            "contact_name", sa.String(length=500), nullable=True, comment="Contact name"
        ),
        sa.Column(
            "contact_email",
            sa.String(length=500),
            nullable=True,
            comment="Contact email",
        ),
        sa.Column(
            "carbon_intensity", sa.Numeric(precision=10, scale=2), nullable=False
        ),
        sa.Column("edrms", sa.String(length=255), nullable=False, comment="EDRMS #"),
        sa.Column(
            "last_updated",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="Date at which the record was last updated.",
        ),
        sa.Column(
            "application_date",
            sa.Date(),
            nullable=False,
            comment="application recorded date.",
        ),
        sa.Column(
            "approval_date",
            sa.Date(),
            nullable=True,
            comment="Date at which the record was approved.",
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=False, comment="Fuel type ID"),
        sa.Column(
            "feedstock", sa.String(length=255), nullable=False, comment="Feedstock"
        ),
        sa.Column(
            "feedstock_location",
            sa.String(length=1000),
            nullable=False,
            comment="Feedstock location",
        ),
        sa.Column(
            "feedstock_misc",
            sa.String(length=500),
            nullable=True,
            comment="Feedstock misc",
        ),
        sa.Column(
            "fuel_production_facility_city",
            sa.String(length=1000),
            nullable=True,
            comment="City of the fuel production",
        ),
        sa.Column(
            "fuel_production_facility_province_state",
            sa.String(length=1000),
            nullable=True,
            comment="Province or state of the fuel production",
        ),
        sa.Column(
            "fuel_production_facility_country",
            sa.String(length=1000),
            nullable=True,
            comment="Country of the fuel production",
        ),
        sa.Column(
            "facility_nameplate_capacity",
            sa.Integer(),
            nullable=True,
            comment="Nameplate capacity",
        ),
        sa.Column(
            "facility_nameplate_capacity_unit",
            postgresql.ENUM(
                "Litres",
                "Kilograms",
                "Kilowatt_hour",
                "Cubic_metres",
                name="quantityunitsenum",
                create_type=False,
            ),
            nullable=True,
            comment="Units of fuel quantity",
        ),
        sa.Column(
            "former_company",
            sa.String(length=500),
            nullable=True,
            comment="Former company",
        ),
        sa.Column("notes", sa.String(length=1000), nullable=True, comment="Notes"),
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_status_id"],
            ["fuel_code_status.fuel_code_status_id"],
            name=op.f("fk_fuel_code_fuel_status_id_fuel_code_status"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_fuel_code_fuel_type_id_fuel_type"),
        ),
        sa.ForeignKeyConstraint(
            ["prefix_id"],
            ["fuel_code_prefix.fuel_code_prefix_id"],
            name=op.f("fk_fuel_code_prefix_id_fuel_code_prefix"),
        ),
        sa.PrimaryKeyConstraint("fuel_code_id", name=op.f("pk_fuel_code")),
        comment="Contains a list of all of fuel codes",
    )
    op.create_table(
        "fuel_instance",
        sa.Column("fuel_instance_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "fuel_type_id", sa.Integer(), nullable=False, comment="ID of the fuel type"
        ),
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            nullable=False,
            comment="ID of the fuel category",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="User who created this record in the database",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="User who last updated this record in the database",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was created",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was last updated",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_fuel_instance_fuel_category_id_fuel_category"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_fuel_instance_fuel_type_id_fuel_type"),
        ),
        sa.PrimaryKeyConstraint("fuel_instance_id", name=op.f("pk_fuel_instance")),
        comment="Table linking fuel types and fuel categories",
    )
    op.create_table(
        "transaction",
        sa.Column(
            "transaction_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the transactions",
        ),
        sa.Column(
            "compliance_units",
            sa.BigInteger(),
            nullable=True,
            comment="Compliance Units",
        ),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column(
            "transaction_action",
            postgresql.ENUM(
                "Adjustment",
                "Reserved",
                "Released",
                name="transaction_action_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Action type for the transaction, e.g., Adjustment, Reserved, or Released.",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_transaction_organization_id_organization"),
        ),
        sa.PrimaryKeyConstraint("transaction_id", name=op.f("pk_transaction")),
        sa.UniqueConstraint(
            "transaction_id", name=op.f("uq_transaction_transaction_id")
        ),
        comment="Contains a list of all of the government to organization and Organization to Organization transaction.",
    )
    op.create_table(
        "user_profile",
        sa.Column("user_profile_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "keycloak_user_id",
            sa.String(length=150),
            nullable=True,
            comment="Unique id returned from Keycloak",
        ),
        sa.Column(
            "keycloak_email",
            sa.String(length=255),
            nullable=True,
            comment="keycloak email address",
        ),
        sa.Column(
            "keycloak_username",
            sa.String(length=150),
            nullable=False,
            comment="keycloak Username",
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
            comment="Primary email address",
        ),
        sa.Column(
            "title", sa.String(length=100), nullable=True, comment="Professional Title"
        ),
        sa.Column(
            "phone", sa.String(length=50), nullable=True, comment="Primary phone number"
        ),
        sa.Column(
            "mobile_phone",
            sa.String(length=50),
            nullable=True,
            comment="Mobile phone number",
        ),
        sa.Column(
            "first_name", sa.String(length=100), nullable=True, comment="First name"
        ),
        sa.Column(
            "last_name", sa.String(length=100), nullable=True, comment="Last name"
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, comment="Is the user active?"
        ),
        sa.Column("organization_id", sa.Integer(), nullable=True),
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
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_user_profile_organization_id_organization"),
        ),
        sa.PrimaryKeyConstraint("user_profile_id", name=op.f("pk_user_profile")),
        sa.UniqueConstraint(
            "keycloak_username", name=op.f("uq_user_profile_keycloak_username")
        ),
        sa.UniqueConstraint(
            "keycloak_username", name=op.f("uq_user_profile_keycloak_username")
        ),
        comment="Users who may access the application",
    )
    op.create_table(
        "admin_adjustment",
        sa.Column(
            "admin_adjustment_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the admin_adjustment",
        ),
        sa.Column(
            "compliance_units",
            sa.BigInteger(),
            nullable=True,
            comment="Compliance Units",
        ),
        sa.Column(
            "transaction_effective_date",
            sa.DateTime(),
            nullable=True,
            comment="Transaction effective date",
        ),
        sa.Column(
            "gov_comment",
            sa.String(length=1500),
            nullable=True,
            comment="Comment from the government to organization",
        ),
        sa.Column("to_organization_id", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.Integer(), nullable=True),
        sa.Column("current_status_id", sa.Integer(), nullable=True),
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["admin_adjustment_status.admin_adjustment_status_id"],
            name=op.f("fk_admin_adjustment_current_status_id_admin_adjustment_status"),
        ),
        sa.ForeignKeyConstraint(
            ["to_organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_admin_adjustment_to_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transaction.transaction_id"],
            name=op.f("fk_admin_adjustment_transaction_id_transaction"),
        ),
        sa.PrimaryKeyConstraint(
            "admin_adjustment_id", name=op.f("pk_admin_adjustment")
        ),
        sa.UniqueConstraint(
            "admin_adjustment_id", name=op.f("uq_admin_adjustment_admin_adjustment_id")
        ),
        comment="Goverment to organization compliance units admin_adjustment",
    )
    op.create_table(
        "compliance_report",
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the compliance report version",
        ),
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance period",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Identifier for the organization",
        ),
        sa.Column(
            "current_status_id",
            sa.Integer(),
            nullable=True,
            comment="Identifier for the current compliance report status",
        ),
        sa.Column(
            "transaction_id",
            sa.Integer(),
            nullable=True,
            comment="Identifier for the transaction",
        ),
        sa.Column(
            "compliance_report_group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="UUID that groups all versions of a compliance report",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Version number of the compliance report",
        ),
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
        sa.Column(
            "reporting_frequency",
            postgresql.ENUM(
                "ANNUAL", "QUARTERLY", name="reportingfrequency", create_type=False
            ),
            nullable=False,
            comment="Reporting frequency",
        ),
        sa.Column(
            "nickname",
            sa.String(),
            nullable=True,
            comment="Nickname for the compliance report",
        ),
        sa.Column(
            "supplemental_note",
            sa.String(),
            nullable=True,
            comment="Supplemental note for the compliance report",
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
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name=op.f("fk_compliance_report_compliance_period_id_compliance_period"),
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["compliance_report_status.compliance_report_status_id"],
            name=op.f(
                "fk_compliance_report_current_status_id_compliance_report_status"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_compliance_report_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transaction.transaction_id"],
            name=op.f("fk_compliance_report_transaction_id_transaction"),
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_id", name=op.f("pk_compliance_report")
        ),
        comment="Main tracking table for all the sub-tables associated with a supplier's compliance report",
    )
    op.create_table(
        "feedstock_fuel_transport_mode",
        sa.Column(
            "feedstock_fuel_transport_mode_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier",
        ),
        sa.Column(
            "fuel_code_id", sa.Integer(), nullable=True, comment="Fuel code identifier"
        ),
        sa.Column(
            "transport_mode_id",
            sa.Integer(),
            nullable=True,
            comment="Transport mode identifier",
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
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_feedstock_fuel_transport_mode_fuel_code_id_fuel_code"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["transport_mode_id"],
            ["transport_mode.transport_mode_id"],
            name=op.f(
                "fk_feedstock_fuel_transport_mode_transport_mode_id_transport_mode"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "feedstock_fuel_transport_mode_id",
            name=op.f("pk_feedstock_fuel_transport_mode"),
        ),
        sa.UniqueConstraint(
            "fuel_code_id",
            "transport_mode_id",
            name=op.f("uq_feedstock_fuel_transport_mode_fuel_code_id"),
        ),
        comment="Contains a list of transport modes associated with feedstock fuel",
    )
    op.create_table(
        "finished_fuel_transport_mode",
        sa.Column(
            "finished_fuel_transport_mode_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier",
        ),
        sa.Column(
            "fuel_code_id", sa.Integer(), nullable=True, comment="Fuel code identifier"
        ),
        sa.Column(
            "transport_mode_id",
            sa.Integer(),
            nullable=True,
            comment="Transport mode identifier",
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
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_finished_fuel_transport_mode_fuel_code_id_fuel_code"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["transport_mode_id"],
            ["transport_mode.transport_mode_id"],
            name=op.f(
                "fk_finished_fuel_transport_mode_transport_mode_id_transport_mode"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "finished_fuel_transport_mode_id",
            name=op.f("pk_finished_fuel_transport_mode"),
        ),
        sa.UniqueConstraint(
            "fuel_code_id",
            "transport_mode_id",
            name=op.f("uq_finished_fuel_transport_mode_fuel_code_id"),
        ),
        comment="Contains a list of transport modes associated with finished fuel",
    )
    op.create_table(
        "initiative_agreement",
        sa.Column(
            "initiative_agreement_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the initiative_agreement",
        ),
        sa.Column(
            "compliance_units",
            sa.BigInteger(),
            nullable=True,
            comment="Compliance Units",
        ),
        sa.Column(
            "transaction_effective_date",
            sa.DateTime(),
            nullable=True,
            comment="Transaction effective date",
        ),
        sa.Column(
            "gov_comment",
            sa.String(length=1500),
            nullable=True,
            comment="Comment from the government to organization",
        ),
        sa.Column("to_organization_id", sa.Integer(), nullable=True),
        sa.Column("transaction_id", sa.Integer(), nullable=True),
        sa.Column("current_status_id", sa.Integer(), nullable=True),
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["initiative_agreement_status.initiative_agreement_status_id"],
            name=op.f(
                "fk_initiative_agreement_current_status_id_initiative_agreement_status"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["to_organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_initiative_agreement_to_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transaction.transaction_id"],
            name=op.f("fk_initiative_agreement_transaction_id_transaction"),
        ),
        sa.PrimaryKeyConstraint(
            "initiative_agreement_id", name=op.f("pk_initiative_agreement")
        ),
        sa.UniqueConstraint(
            "initiative_agreement_id",
            name=op.f("uq_initiative_agreement_initiative_agreement_id"),
        ),
        comment="Goverment to organization compliance units initiative agreement",
    )
    op.create_table(
        "notification_channel_subscription",
        sa.Column(
            "notification_channel_subscription_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("is_enabled", sa.Boolean(), nullable=True),
        sa.Column("user_profile_id", sa.Integer(), nullable=True),
        sa.Column("notification_type_id", sa.Integer(), nullable=True),
        sa.Column("notification_channel_id", sa.Integer(), nullable=True),
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
            ["notification_channel_id"],
            ["notification_channel.notification_channel_id"],
            name=op.f(
                "fk_notification_channel_subscription_notification_channel_id_notification_channel"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["notification_type_id"],
            ["notification_type.notification_type_id"],
            name=op.f(
                "fk_notification_channel_subscription_notification_type_id_notification_type"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f(
                "fk_notification_channel_subscription_user_profile_id_user_profile"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "notification_channel_subscription_id",
            name=op.f("pk_notification_channel_subscription"),
        ),
        sa.UniqueConstraint(
            "user_profile_id",
            "notification_channel_id",
            "notification_type_id",
            name="uq_user_channel_type",
        ),
        comment="Represents a user's subscription to notification events",
    )
    op.create_table(
        "notification_message",
        sa.Column(
            "notification_message_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("is_read", sa.Boolean(), nullable=True),
        sa.Column("is_warning", sa.Boolean(), nullable=True),
        sa.Column("is_error", sa.Boolean(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("related_organization_id", sa.Integer(), nullable=True),
        sa.Column("origin_user_profile_id", sa.Integer(), nullable=True),
        sa.Column("related_user_profile_id", sa.Integer(), nullable=True),
        sa.Column("notification_type_id", sa.Integer(), nullable=True),
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
            ["notification_type_id"],
            ["notification_type.notification_type_id"],
            name=op.f("fk_notification_message_notification_type_id_notification_type"),
        ),
        sa.ForeignKeyConstraint(
            ["origin_user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_notification_message_origin_user_profile_id_user_profile"),
        ),
        sa.ForeignKeyConstraint(
            ["related_organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_notification_message_related_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["related_user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_notification_message_related_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "notification_message_id", name=op.f("pk_notification_message")
        ),
        comment="Represents a notification message sent to an application user",
    )
    op.create_table(
        "transfer",
        sa.Column(
            "transfer_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the org to org transfer record",
        ),
        sa.Column("from_organization_id", sa.Integer(), nullable=True),
        sa.Column("to_organization_id", sa.Integer(), nullable=True),
        sa.Column("from_transaction_id", sa.Integer(), nullable=True),
        sa.Column("to_transaction_id", sa.Integer(), nullable=True),
        sa.Column(
            "agreement_date",
            sa.DateTime(),
            nullable=True,
            comment="Agreement date of the transfer",
        ),
        sa.Column(
            "transaction_effective_date",
            sa.DateTime(),
            nullable=True,
            comment="transaction effective date",
        ),
        sa.Column(
            "price_per_unit",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Price per unit with two decimal places",
        ),
        sa.Column("quantity", sa.Integer(), nullable=True, comment="Quantity of units"),
        sa.Column(
            "from_org_comment",
            sa.String(length=1000),
            nullable=True,
            comment="Comment from the from-organization",
        ),
        sa.Column(
            "to_org_comment",
            sa.String(length=1000),
            nullable=True,
            comment="Comment from the to-organization",
        ),
        sa.Column(
            "gov_comment",
            sa.String(length=1500),
            nullable=True,
            comment="Comment from the government to organizations",
        ),
        sa.Column("transfer_category_id", sa.Integer(), nullable=True),
        sa.Column("current_status_id", sa.Integer(), nullable=True),
        sa.Column(
            "recommendation",
            postgresql.ENUM(
                "Record",
                "Refuse",
                name="transfer_recommendation_enum",
                create_type=False,
            ),
            nullable=True,
            comment="Analyst recommendation for the transfer.",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["transfer_status.transfer_status_id"],
            name=op.f("fk_transfer_current_status_id_transfer_status"),
        ),
        sa.ForeignKeyConstraint(
            ["from_organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_transfer_from_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["from_transaction_id"],
            ["transaction.transaction_id"],
            name=op.f("fk_transfer_from_transaction_id_transaction"),
        ),
        sa.ForeignKeyConstraint(
            ["to_organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_transfer_to_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["to_transaction_id"],
            ["transaction.transaction_id"],
            name=op.f("fk_transfer_to_transaction_id_transaction"),
        ),
        sa.ForeignKeyConstraint(
            ["transfer_category_id"],
            ["transfer_category.transfer_category_id"],
            name=op.f("fk_transfer_transfer_category_id_transfer_category"),
        ),
        sa.PrimaryKeyConstraint("transfer_id", name=op.f("pk_transfer")),
        sa.UniqueConstraint("transfer_id", name=op.f("uq_transfer_transfer_id")),
        comment="Records of tranfer from Organization to Organization",
    )
    op.create_table(
        "user_role",
        sa.Column(
            "user_role_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique ID for the user role",
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
        sa.Column(
            "role_id", sa.Integer(), nullable=True, comment="Foreign key to role"
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
            ["role_id"], ["role.role_id"], name=op.f("fk_user_role_role_id_role")
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_user_role_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint("user_role_id", name=op.f("pk_user_role")),
        sa.UniqueConstraint(
            "user_profile_id", "role_id", name="user_role_unique_constraint"
        ),
        comment="Contains the user and role relationships",
    )
    op.create_table(
        "admin_adjustment_history",
        sa.Column(
            "admin_adjustment_history_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the admin_adjustment history record",
        ),
        sa.Column("admin_adjustment_id", sa.Integer(), nullable=True),
        sa.Column("admin_adjustment_status_id", sa.Integer(), nullable=True),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["admin_adjustment_id"],
            ["admin_adjustment.admin_adjustment_id"],
            name=op.f(
                "fk_admin_adjustment_history_admin_adjustment_id_admin_adjustment"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["admin_adjustment_status_id"],
            ["admin_adjustment_status.admin_adjustment_status_id"],
            name=op.f(
                "fk_admin_adjustment_history_admin_adjustment_status_id_admin_adjustment_status"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_admin_adjustment_history_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "admin_adjustment_history_id", name=op.f("pk_admin_adjustment_history")
        ),
        sa.UniqueConstraint(
            "admin_adjustment_history_id",
            name=op.f("uq_admin_adjustment_history_admin_adjustment_history_id"),
        ),
        comment="History record for admin_adjustment status change.",
    )
    op.create_table(
        "admin_adjustment_internal_comment",
        sa.Column(
            "admin_adjustment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to admin_adjustment, part of the composite primary key.",
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to internal_comment, part of the composite primary key.",
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
        sa.ForeignKeyConstraint(
            ["admin_adjustment_id"],
            ["admin_adjustment.admin_adjustment_id"],
            name=op.f(
                "fk_admin_adjustment_internal_comment_admin_adjustment_id_admin_adjustment"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f(
                "fk_admin_adjustment_internal_comment_internal_comment_id_internal_comment"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "admin_adjustment_id",
            "internal_comment_id",
            name=op.f("pk_admin_adjustment_internal_comment"),
        ),
        comment="Associates internal comments with admin adjustments.",
    )
    op.create_table(
        "allocation_agreement",
        sa.Column(
            "allocation_agreement_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the allocation agreement",
        ),
        sa.Column(
            "transaction_partner",
            sa.String(),
            nullable=False,
            comment="Partner involved in the transaction",
        ),
        sa.Column(
            "postal_address",
            sa.String(),
            nullable=False,
            comment="Postal address of the transaction partner",
        ),
        sa.Column(
            "transaction_partner_email",
            sa.String(),
            nullable=False,
            comment="Transaction Partner email",
        ),
        sa.Column(
            "transaction_partner_phone",
            sa.String(),
            nullable=False,
            comment="Transaction Partner phone number",
        ),
        sa.Column(
            "ci_of_fuel",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            comment="The Carbon intesity of fuel",
        ),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            comment="Quantity of fuel involved in the transaction",
        ),
        sa.Column(
            "units",
            sa.String(),
            nullable=False,
            comment="Units of the fuel quantity. Auto-selected, locked field.",
        ),
        sa.Column(
            "fuel_type_other",
            sa.String(length=1000),
            nullable=True,
            comment="Other fuel type if one provided",
        ),
        sa.Column(
            "allocation_transaction_type_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the transaction type",
        ),
        sa.Column(
            "fuel_type_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel type",
        ),
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel category",
        ),
        sa.Column(
            "provision_of_the_act_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the provision of the act",
        ),
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the fuel code",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report",
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
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.ForeignKeyConstraint(
            ["allocation_transaction_type_id"],
            ["allocation_transaction_type.allocation_transaction_type_id"],
            name=op.f(
                "fk_allocation_agreement_allocation_transaction_type_id_allocation_transaction_type"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_allocation_agreement_compliance_report_id_compliance_report"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_allocation_agreement_fuel_category_id_fuel_category"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_allocation_agreement_fuel_code_id_fuel_code"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_allocation_agreement_fuel_type_id_fuel_type"),
        ),
        sa.ForeignKeyConstraint(
            ["provision_of_the_act_id"],
            ["provision_of_the_act.provision_of_the_act_id"],
            name=op.f(
                "fk_allocation_agreement_provision_of_the_act_id_provision_of_the_act"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "allocation_agreement_id", name=op.f("pk_allocation_agreement")
        ),
        comment="Records allocation agreements where the reporting obligation is passed from one party to another. Each party must report their end of the transaction.",
    )
    op.create_table(
        "compliance_report_document_association",
        sa.Column("compliance_report_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_compliance_report_document_association_compliance_report_id_compliance_report"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            name=op.f("fk_compliance_report_document_association_document_id_document"),
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_id",
            "document_id",
            name=op.f("pk_compliance_report_document_association"),
        ),
    )
    op.create_table(
        "compliance_report_history",
        sa.Column(
            "compliance_report_history_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the compliance report history",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report",
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report status",
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Identifier for the user associated with the status change",
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
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_compliance_report_history_compliance_report_id_compliance_report"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["status_id"],
            ["compliance_report_status.compliance_report_status_id"],
            name=op.f(
                "fk_compliance_report_history_status_id_compliance_report_status"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_compliance_report_history_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_history_id", name=op.f("pk_compliance_report_history")
        ),
        comment="Tracks status changes of compliance reports",
    )
    op.create_table(
        "compliance_report_internal_comment",
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to compliance_report, part of the composite primary key.",
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to internal_comment, part of the composite primary key.",
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
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_compliance_report_internal_comment_compliance_report_id_compliance_report"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f(
                "fk_compliance_report_internal_comment_internal_comment_id_internal_comment"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_id",
            "internal_comment_id",
            name=op.f("pk_compliance_report_internal_comment"),
        ),
        comment="Associates internal comments with compliance report.",
    )
    op.create_table(
        "compliance_report_summary",
        sa.Column("summary_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("compliance_report_id", sa.Integer(), nullable=True),
        sa.Column("quarter", sa.Integer(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), nullable=True),
        sa.Column(
            "line_1_fossil_derived_base_fuel_gasoline", sa.Float(), nullable=False
        ),
        sa.Column("line_1_fossil_derived_base_fuel_diesel", sa.Float(), nullable=False),
        sa.Column(
            "line_1_fossil_derived_base_fuel_jet_fuel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_2_eligible_renewable_fuel_supplied_gasoline",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "line_2_eligible_renewable_fuel_supplied_diesel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_2_eligible_renewable_fuel_supplied_jet_fuel",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "line_3_total_tracked_fuel_supplied_gasoline", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_3_total_tracked_fuel_supplied_diesel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_3_total_tracked_fuel_supplied_jet_fuel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_4_eligible_renewable_fuel_required_gasoline",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "line_4_eligible_renewable_fuel_required_diesel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_4_eligible_renewable_fuel_required_jet_fuel",
            sa.Float(),
            nullable=False,
        ),
        sa.Column(
            "line_5_net_notionally_transferred_gasoline", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_5_net_notionally_transferred_diesel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_5_net_notionally_transferred_jet_fuel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_6_renewable_fuel_retained_gasoline", sa.Float(), nullable=False
        ),
        sa.Column("line_6_renewable_fuel_retained_diesel", sa.Float(), nullable=False),
        sa.Column(
            "line_6_renewable_fuel_retained_jet_fuel", sa.Float(), nullable=False
        ),
        sa.Column("line_7_previously_retained_gasoline", sa.Float(), nullable=False),
        sa.Column("line_7_previously_retained_diesel", sa.Float(), nullable=False),
        sa.Column("line_7_previously_retained_jet_fuel", sa.Float(), nullable=False),
        sa.Column("line_8_obligation_deferred_gasoline", sa.Float(), nullable=False),
        sa.Column("line_8_obligation_deferred_diesel", sa.Float(), nullable=False),
        sa.Column("line_8_obligation_deferred_jet_fuel", sa.Float(), nullable=False),
        sa.Column("line_9_obligation_added_gasoline", sa.Float(), nullable=False),
        sa.Column("line_9_obligation_added_diesel", sa.Float(), nullable=False),
        sa.Column("line_9_obligation_added_jet_fuel", sa.Float(), nullable=False),
        sa.Column(
            "line_10_net_renewable_fuel_supplied_gasoline", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_10_net_renewable_fuel_supplied_diesel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_10_net_renewable_fuel_supplied_jet_fuel", sa.Float(), nullable=False
        ),
        sa.Column("line_11_non_compliance_penalty_gasoline", sa.Float(), nullable=True),
        sa.Column("line_11_non_compliance_penalty_diesel", sa.Float(), nullable=True),
        sa.Column("line_11_non_compliance_penalty_jet_fuel", sa.Float(), nullable=True),
        sa.Column("line_12_low_carbon_fuel_required", sa.Float(), nullable=False),
        sa.Column("line_13_low_carbon_fuel_supplied", sa.Float(), nullable=False),
        sa.Column("line_14_low_carbon_fuel_surplus", sa.Float(), nullable=False),
        sa.Column("line_15_banked_units_used", sa.Float(), nullable=False),
        sa.Column("line_16_banked_units_remaining", sa.Float(), nullable=False),
        sa.Column("line_17_non_banked_units_used", sa.Float(), nullable=False),
        sa.Column("line_18_units_to_be_banked", sa.Float(), nullable=False),
        sa.Column("line_19_units_to_be_exported", sa.Float(), nullable=False),
        sa.Column("line_20_surplus_deficit_units", sa.Float(), nullable=False),
        sa.Column("line_21_surplus_deficit_ratio", sa.Float(), nullable=False),
        sa.Column("line_22_compliance_units_issued", sa.Float(), nullable=False),
        sa.Column(
            "line_11_fossil_derived_base_fuel_gasoline", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_11_fossil_derived_base_fuel_diesel", sa.Float(), nullable=False
        ),
        sa.Column(
            "line_11_fossil_derived_base_fuel_jet_fuel", sa.Float(), nullable=False
        ),
        sa.Column("line_11_fossil_derived_base_fuel_total", sa.Float(), nullable=False),
        sa.Column("line_21_non_compliance_penalty_payable", sa.Float(), nullable=False),
        sa.Column("total_non_compliance_penalty_payable", sa.Float(), nullable=False),
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
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_compliance_report_summary_compliance_report_id_compliance_report"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "summary_id", name=op.f("pk_compliance_report_summary")
        ),
        comment="Summary of all compliance calculations displaying the compliance units over a compliance period",
    )
    op.create_table(
        "final_supply_equipment",
        sa.Column(
            "final_supply_equipment_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="The unique identifier for the final supply equipment.",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="The foreign key referencing the compliance report.",
        ),
        sa.Column(
            "supply_from_date",
            sa.Date(),
            nullable=False,
            comment="The date from which the equipment is supplied.",
        ),
        sa.Column(
            "supply_to_date",
            sa.Date(),
            nullable=False,
            comment="The date until which the equipment is supplied.",
        ),
        sa.Column(
            "kwh_usage",
            sa.Double(precision=2),
            nullable=True,
            comment="Optional kWh usage with up to 2 decimal places.",
        ),
        sa.Column(
            "registration_nbr",
            sa.String(),
            nullable=True,
            comment="Unique registration number in format ORGCODE-POSTAL-SEQ (e.g., AB55-V3B0G2-001)",
        ),
        sa.Column(
            "serial_nbr",
            sa.String(),
            nullable=False,
            comment="The serial number of the equipment.",
        ),
        sa.Column(
            "manufacturer",
            sa.String(),
            nullable=False,
            comment="The manufacturer of the equipment.",
        ),
        sa.Column(
            "model",
            sa.String(),
            nullable=True,
            comment="Optional model of the equipment, following 'Make' field.",
        ),
        sa.Column(
            "level_of_equipment_id",
            sa.Integer(),
            nullable=False,
            comment="The foreign key referencing the level of equipment.",
        ),
        sa.Column(
            "ports",
            postgresql.ENUM(
                "Single port", "Dual port", name="ports_enum", create_type=False
            ),
            nullable=True,
            comment="Port type with options 'Single port' and 'Dual port.'",
        ),
        sa.Column(
            "fuel_measurement_type_id",
            sa.Integer(),
            nullable=False,
            comment="The foreign key referencing the fuel measurement type.",
        ),
        sa.Column(
            "street_address",
            sa.String(),
            nullable=False,
            comment="The street address of the equipment location.",
        ),
        sa.Column(
            "city",
            sa.String(),
            nullable=False,
            comment="The city of the equipment location.",
        ),
        sa.Column(
            "postal_code",
            sa.String(),
            nullable=False,
            comment="The postcode of the equipment location.",
        ),
        sa.Column(
            "latitude",
            sa.Double(),
            nullable=False,
            comment="The latitude of the equipment location.",
        ),
        sa.Column(
            "longitude",
            sa.Double(),
            nullable=False,
            comment="The longitude of the equipment location.",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
            comment="Any additional notes related to the equipment.",
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
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_final_supply_equipment_compliance_report_id_compliance_report"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_measurement_type_id"],
            ["fuel_measurement_type.fuel_measurement_type_id"],
            name=op.f(
                "fk_final_supply_equipment_fuel_measurement_type_id_fuel_measurement_type"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["level_of_equipment_id"],
            ["level_of_equipment.level_of_equipment_id"],
            name=op.f(
                "fk_final_supply_equipment_level_of_equipment_id_level_of_equipment"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "final_supply_equipment_id", name=op.f("pk_final_supply_equipment")
        ),
        comment="Final Supply Equipment",
    )
    op.create_index(
        op.f("ix_final_supply_equipment_compliance_report_id"),
        "final_supply_equipment",
        ["compliance_report_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_final_supply_equipment_fuel_measurement_type_id"),
        "final_supply_equipment",
        ["fuel_measurement_type_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_final_supply_equipment_level_of_equipment_id"),
        "final_supply_equipment",
        ["level_of_equipment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_final_supply_equipment_registration_nbr"),
        "final_supply_equipment",
        ["registration_nbr"],
        unique=False,
    )
    op.create_table(
        "fuel_export",
        sa.Column(
            "fuel_export_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel supply",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report",
        ),
        sa.Column(
            "export_date", sa.Date(), nullable=False, comment="Date of fuel supply"
        ),
        sa.Column(
            "quarter",
            postgresql.ENUM("Q1", "Q2", "Q3", "Q4", name="quarter", create_type=False),
            nullable=True,
            comment="Quarter for quarterly reports",
        ),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            comment="Quantity of fuel supplied",
        ),
        sa.Column(
            "units",
            postgresql.ENUM(
                "Litres",
                "Kilograms",
                "Kilowatt_hour",
                "Cubic_metres",
                name="quantityunitsenum",
                create_type=False,
            ),
            nullable=False,
            comment="Units of fuel quantity",
        ),
        sa.Column(
            "compliance_units",
            sa.Integer(),
            nullable=True,
            comment="Compliance units for the fuel supply",
        ),
        sa.Column(
            "target_ci",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="CI limit for the fuel supply",
        ),
        sa.Column(
            "ci_of_fuel",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="CI of fuel for the fuel supply",
        ),
        sa.Column(
            "energy_density",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Energy density of the fuel supplied",
        ),
        sa.Column(
            "eer",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Energy effectiveness ratio of the fuel supplied",
        ),
        sa.Column(
            "energy",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Energy content of the fuel supplied",
        ),
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel category",
        ),
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the fuel code",
        ),
        sa.Column(
            "fuel_type_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel type",
        ),
        sa.Column(
            "provision_of_the_act_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the provision of the act",
        ),
        sa.Column(
            "end_use_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the end use type",
        ),
        sa.Column(
            "fuel_type_other",
            sa.String(length=1000),
            nullable=True,
            comment="Other fuel type if one provided",
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
        sa.Column(
            "group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="UUID that groups all versions of a record series",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Version number of the record",
        ),
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_fuel_export_compliance_report_id_compliance_report"),
        ),
        sa.ForeignKeyConstraint(
            ["end_use_id"],
            ["end_use_type.end_use_type_id"],
            name=op.f("fk_fuel_export_end_use_id_end_use_type"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_fuel_export_fuel_category_id_fuel_category"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_fuel_export_fuel_code_id_fuel_code"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_fuel_export_fuel_type_id_fuel_type"),
        ),
        sa.ForeignKeyConstraint(
            ["provision_of_the_act_id"],
            ["provision_of_the_act.provision_of_the_act_id"],
            name=op.f("fk_fuel_export_provision_of_the_act_id_provision_of_the_act"),
        ),
        sa.PrimaryKeyConstraint("fuel_export_id", name=op.f("pk_fuel_export")),
        comment="Records the supply of fuel for compliance purposes, including changes in supplemental reports",
    )
    op.create_table(
        "fuel_supply",
        sa.Column(
            "fuel_supply_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel supply version",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report",
        ),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            comment="Quantity of fuel supplied",
        ),
        sa.Column(
            "units",
            postgresql.ENUM(
                "Litres",
                "Kilograms",
                "Kilowatt_hour",
                "Cubic_metres",
                name="quantityunitsenum",
                create_type=False,
            ),
            nullable=False,
            comment="Units of fuel quantity",
        ),
        sa.Column(
            "compliance_units", sa.Integer(), nullable=True, comment="Compliance units"
        ),
        sa.Column(
            "target_ci",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Target Carbon Intensity",
        ),
        sa.Column(
            "ci_of_fuel",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="CI of the fuel",
        ),
        sa.Column(
            "energy_density",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Energy density",
        ),
        sa.Column(
            "eer",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Energy Effectiveness Ratio",
        ),
        sa.Column("energy", sa.BigInteger(), nullable=True, comment="Energy content"),
        sa.Column(
            "fuel_type_other",
            sa.String(length=1000),
            nullable=True,
            comment="Other fuel type if one provided",
        ),
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel category",
        ),
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the fuel code",
        ),
        sa.Column(
            "fuel_type_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel type",
        ),
        sa.Column(
            "provision_of_the_act_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the provision of the act",
        ),
        sa.Column(
            "end_use_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to the end use type",
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
        sa.Column(
            "group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="UUID that groups all versions of a record series",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Version number of the record",
        ),
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_fuel_supply_compliance_report_id_compliance_report"),
        ),
        sa.ForeignKeyConstraint(
            ["end_use_id"],
            ["end_use_type.end_use_type_id"],
            name=op.f("fk_fuel_supply_end_use_id_end_use_type"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_fuel_supply_fuel_category_id_fuel_category"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_fuel_supply_fuel_code_id_fuel_code"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_fuel_supply_fuel_type_id_fuel_type"),
        ),
        sa.ForeignKeyConstraint(
            ["provision_of_the_act_id"],
            ["provision_of_the_act.provision_of_the_act_id"],
            name=op.f("fk_fuel_supply_provision_of_the_act_id_provision_of_the_act"),
        ),
        sa.PrimaryKeyConstraint("fuel_supply_id", name=op.f("pk_fuel_supply")),
        comment="Records the supply of fuel for compliance purposes, including changes in supplemental reports",
    )
    op.create_table(
        "initiative_agreement_history",
        sa.Column(
            "initiative_agreement_history_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the initiative agreement history record",
        ),
        sa.Column("initiative_agreement_id", sa.Integer(), nullable=True),
        sa.Column("initiative_agreement_status_id", sa.Integer(), nullable=True),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["initiative_agreement_id"],
            ["initiative_agreement.initiative_agreement_id"],
            name=op.f(
                "fk_initiative_agreement_history_initiative_agreement_id_initiative_agreement"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["initiative_agreement_status_id"],
            ["initiative_agreement_status.initiative_agreement_status_id"],
            name=op.f(
                "fk_initiative_agreement_history_initiative_agreement_status_id_initiative_agreement_status"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_initiative_agreement_history_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "initiative_agreement_history_id",
            name=op.f("pk_initiative_agreement_history"),
        ),
        sa.UniqueConstraint(
            "initiative_agreement_history_id",
            name=op.f(
                "uq_initiative_agreement_history_initiative_agreement_history_id"
            ),
        ),
        comment="History record for initiative agreement status change.",
    )
    op.create_table(
        "initiative_agreement_internal_comment",
        sa.Column(
            "initiative_agreement_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to initiative_agreement, part of the composite primary key.",
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to internal_comment, part of the composite primary key.",
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
        sa.ForeignKeyConstraint(
            ["initiative_agreement_id"],
            ["initiative_agreement.initiative_agreement_id"],
            name=op.f(
                "fk_initiative_agreement_internal_comment_initiative_agreement_id_initiative_agreement"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f(
                "fk_initiative_agreement_internal_comment_internal_comment_id_internal_comment"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "initiative_agreement_id",
            "internal_comment_id",
            name=op.f("pk_initiative_agreement_internal_comment"),
        ),
        comment="Associates internal comments with initiative agreements.",
    )
    op.create_table(
        "notional_transfer",
        sa.Column(
            "notional_transfer_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the notional transfer",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report",
        ),
        sa.Column(
            "quantity",
            sa.Integer(),
            nullable=False,
            comment="Quantity of fuel being notionally transferred. Cannot be negative.",
        ),
        sa.Column(
            "legal_name",
            sa.String(),
            nullable=False,
            comment="Legal name of the trading partner",
        ),
        sa.Column(
            "address_for_service",
            sa.String(),
            nullable=False,
            comment="Address for service of the trading partner",
        ),
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel category",
        ),
        sa.Column(
            "received_or_transferred",
            postgresql.ENUM(
                "Received",
                "Transferred",
                name="receivedortransferredenum",
                create_type=False,
            ),
            nullable=False,
            comment="Indicates whether the transfer is Received or Transferred",
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
        sa.Column(
            "group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="UUID that groups all versions of a record series",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Version number of the record",
        ),
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_notional_transfer_compliance_report_id_compliance_report"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_notional_transfer_fuel_category_id_fuel_category"),
        ),
        sa.PrimaryKeyConstraint(
            "notional_transfer_id", name=op.f("pk_notional_transfer")
        ),
        comment="Records notional transfers for compliance reports.",
    )
    op.create_table(
        "other_uses",
        sa.Column(
            "other_uses_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the other uses record",
        ),
        sa.Column(
            "compliance_report_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance report",
        ),
        sa.Column(
            "fuel_type_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel type",
        ),
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the fuel category",
        ),
        sa.Column(
            "quantity_supplied",
            sa.Integer(),
            nullable=False,
            comment="Quantity of fuel used. Cannot be negative.",
        ),
        sa.Column(
            "units",
            sa.String(),
            nullable=False,
            comment="Units of the fuel quantity. Auto-selected, locked field.",
        ),
        sa.Column(
            "expected_use_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the expected use type",
        ),
        sa.Column(
            "rationale",
            sa.String(),
            nullable=True,
            comment="Rationale for the use of the fuel, required if 'Other' is selected as expected use",
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
        sa.Column(
            "group_uuid",
            sa.String(length=36),
            nullable=False,
            comment="UUID that groups all versions of a record series",
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment="Version number of the record",
        ),
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            nullable=False,
            comment="Indicates whether the record was created/modified by a supplier or government user",
        ),
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            server_default=sa.text("'CREATE'"),
            nullable=False,
            comment="Action type for this record",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_other_uses_compliance_report_id_compliance_report"),
        ),
        sa.ForeignKeyConstraint(
            ["expected_use_id"],
            ["expected_use_type.expected_use_type_id"],
            name=op.f("fk_other_uses_expected_use_id_expected_use_type"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
            name=op.f("fk_other_uses_fuel_category_id_fuel_category"),
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
            name=op.f("fk_other_uses_fuel_type_id_fuel_type"),
        ),
        sa.PrimaryKeyConstraint("other_uses_id", name=op.f("pk_other_uses")),
        comment="Records other uses of fuels that are subject to renewable requirements but do not earn credits.",
    )
    op.create_table(
        "transfer_history",
        sa.Column(
            "transfer_history_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the transfer history record",
        ),
        sa.Column("transfer_id", sa.Integer(), nullable=True),
        sa.Column("transfer_status_id", sa.Integer(), nullable=True),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["transfer_id"],
            ["transfer.transfer_id"],
            name=op.f("fk_transfer_history_transfer_id_transfer"),
        ),
        sa.ForeignKeyConstraint(
            ["transfer_status_id"],
            ["transfer_status.transfer_status_id"],
            name=op.f("fk_transfer_history_transfer_status_id_transfer_status"),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_transfer_history_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "transfer_history_id", name=op.f("pk_transfer_history")
        ),
        comment="Records the status changes of a transfer.",
    )
    op.create_table(
        "transfer_internal_comment",
        sa.Column(
            "transfer_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to transfer, part of the composite primary key.",
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to internal_comment, part of the composite primary key.",
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
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f(
                "fk_transfer_internal_comment_internal_comment_id_internal_comment"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["transfer_id"],
            ["transfer.transfer_id"],
            name=op.f("fk_transfer_internal_comment_transfer_id_transfer"),
        ),
        sa.PrimaryKeyConstraint(
            "transfer_id",
            "internal_comment_id",
            name=op.f("pk_transfer_internal_comment"),
        ),
        comment="Associates internal comments with transfers.",
    )
    op.create_table(
        "final_supply_intended_use_association",
        sa.Column("final_supply_equipment_id", sa.Integer(), nullable=False),
        sa.Column("end_use_type_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["end_use_type_id"],
            ["end_use_type.end_use_type_id"],
            name=op.f(
                "fk_final_supply_intended_use_association_end_use_type_id_end_use_type"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["final_supply_equipment_id"],
            ["final_supply_equipment.final_supply_equipment_id"],
            name=op.f(
                "fk_final_supply_intended_use_association_final_supply_equipment_id_final_supply_equipment"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "final_supply_equipment_id",
            "end_use_type_id",
            name=op.f("pk_final_supply_intended_use_association"),
        ),
    )
    op.create_table(
        "final_supply_intended_user_association",
        sa.Column("final_supply_equipment_id", sa.Integer(), nullable=False),
        sa.Column("end_user_type_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["end_user_type_id"],
            ["end_user_type.end_user_type_id"],
            name=op.f(
                "fk_final_supply_intended_user_association_end_user_type_id_end_user_type"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["final_supply_equipment_id"],
            ["final_supply_equipment.final_supply_equipment_id"],
            name=op.f(
                "fk_final_supply_intended_user_association_final_supply_equipment_id_final_supply_equipment"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "final_supply_equipment_id",
            "end_user_type_id",
            name=op.f("pk_final_supply_intended_user_association"),
        ),
    )


def downgrade() -> None:
    op.drop_table("final_supply_intended_user_association")
    op.drop_table("final_supply_intended_use_association")
    op.drop_table("transfer_internal_comment")
    op.drop_table("transfer_history")
    op.drop_table("other_uses")
    op.drop_table("notional_transfer")
    op.drop_table("initiative_agreement_internal_comment")
    op.drop_table("initiative_agreement_history")
    op.drop_table("fuel_supply")
    op.drop_table("fuel_export")
    op.drop_index(
        op.f("ix_final_supply_equipment_registration_nbr"),
        table_name="final_supply_equipment",
    )
    op.drop_index(
        op.f("ix_final_supply_equipment_level_of_equipment_id"),
        table_name="final_supply_equipment",
    )
    op.drop_index(
        op.f("ix_final_supply_equipment_fuel_measurement_type_id"),
        table_name="final_supply_equipment",
    )
    op.drop_index(
        op.f("ix_final_supply_equipment_compliance_report_id"),
        table_name="final_supply_equipment",
    )
    op.drop_table("final_supply_equipment")
    op.drop_table("compliance_report_summary")
    op.drop_table("compliance_report_internal_comment")
    op.drop_table("compliance_report_history")
    op.drop_table("compliance_report_document_association")
    op.drop_table("allocation_agreement")
    op.drop_table("admin_adjustment_internal_comment")
    op.drop_table("admin_adjustment_history")
    op.drop_table("user_role")
    op.drop_table("transfer")
    op.drop_table("notification_message")
    op.drop_table("notification_channel_subscription")
    op.drop_table("initiative_agreement")
    op.drop_table("finished_fuel_transport_mode")
    op.drop_table("feedstock_fuel_transport_mode")
    op.drop_table("compliance_report")
    op.drop_table("admin_adjustment")
    op.drop_table("user_profile")
    op.drop_table("transaction")
    op.drop_table("fuel_instance")
    op.drop_table("fuel_code")
    op.drop_table("energy_effectiveness_ratio")
    op.drop_table("energy_density")
    op.drop_table("additional_carbon_intensity")
    op.drop_table("target_carbon_intensity")
    op.drop_table("organization")
    op.drop_table("fuel_type")
    op.drop_table("user_login_history")
    op.drop_table("unit_of_measure")
    op.drop_table("transport_mode")
    op.drop_table("transfer_status")
    op.drop_table("transfer_category")
    op.drop_table("role")
    op.drop_table("provision_of_the_act")
    op.drop_table("organization_type")
    op.drop_table("organization_status")
    op.drop_table("organization_attorney_address")
    op.drop_table("organization_address")
    op.drop_table("notification_type")
    op.drop_table("notification_channel")
    op.drop_table("level_of_equipment")
    op.drop_table("internal_comment")
    op.drop_table("initiative_agreement_status")
    op.drop_table("fuel_measurement_type")
    op.drop_table("fuel_code_status")
    op.drop_table("fuel_code_prefix")
    op.drop_table("fuel_category")
    op.drop_table("final_supply_equipment_reg_number")
    op.drop_table("expected_use_type")
    op.drop_table("end_user_type")
    op.drop_table("end_use_type")
    op.drop_table("document")
    op.drop_table("compliance_report_status")
    op.drop_table("compliance_period")
    op.drop_index("idx_audit_log_operation", table_name="audit_log")
    op.drop_index("idx_audit_log_delta", table_name="audit_log", postgresql_using="gin")
    op.drop_index("idx_audit_log_create_user", table_name="audit_log")
    op.drop_index("idx_audit_log_create_date", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_table("allocation_transaction_type")
    op.drop_table("admin_adjustment_status")
    sa.Enum(
        "Draft", "Recommended", "Approved", "Deleted", name="admin_adjustment_type_enum"
    ).drop(op.get_bind())
    sa.Enum("Director", "Analyst", "Compliance Manager", name="audience_scope").drop(
        op.get_bind()
    )
    sa.Enum(
        "SUPPLIER_SUPPLEMENTAL",
        "GOVERNMENT_REASSESSMENT",
        name="supplementalinitiatortype",
    ).drop(op.get_bind())
    sa.Enum("ANNUAL", "QUARTERLY", name="reportingfrequency").drop(op.get_bind())
    sa.Enum(
        "Draft",
        "Submitted",
        "Recommended_by_analyst",
        "Recommended_by_manager",
        "Assessed",
        "ReAssessed",
        name="compliancereportstatusenum",
    ).drop(op.get_bind())
    sa.Enum("Single port", "Dual port", name="ports_enum").drop(op.get_bind())
    sa.Enum(
        "Litres", "Kilograms", "Kilowatt_hour", "Cubic_metres", name="quantityunitsenum"
    ).drop(op.get_bind())
    sa.Enum("SUPPLIER", "GOVERNMENT", name="usertypeenum").drop(op.get_bind())
    sa.Enum("CREATE", "UPDATE", "DELETE", name="actiontypeenum").drop(op.get_bind())
    sa.Enum("Q1", "Q2", "Q3", "Q4", name="quarter").drop(op.get_bind())
    sa.Enum("Received", "Transferred", name="receivedortransferredenum").drop(
        op.get_bind()
    )
    sa.Enum("Gasoline", "Diesel", "Jet fuel", name="fuel_category_enum").drop(
        op.get_bind()
    )
    sa.Enum("Draft", "Approved", "Deleted", name="fuel_code_status_enum").drop(
        op.get_bind()
    )
    sa.Enum(
        "Draft",
        "Recommended",
        "Approved",
        "Deleted",
        name="initiative_agreement_type_enum",
    ).drop(op.get_bind())
    sa.Enum("EMAIL", "IN_APP", name="channel_enum").drop(op.get_bind())
    sa.Enum(
        "Unregistered", "Registered", "Suspended", "Canceled", name="org_status_enum"
    ).drop(op.get_bind())
    sa.Enum(
        "fuel_supplier",
        "electricity_supplier",
        "broker",
        "utilities",
        name="org_type_enum",
    ).drop(op.get_bind())
    sa.Enum(
        "TRANSFER_PARTNER_UPDATE",
        "TRANSFER_DIRECTOR_REVIEW",
        "INITIATIVE_APPROVED",
        "INITIATIVE_DA_REQUEST",
        "SUPPLEMENTAL_REQUESTED",
        "DIRECTOR_ASSESSMENT",
        name="notification_type_enum",
    ).drop(op.get_bind())
    sa.Enum("Adjustment", "Reserved", "Released", name="transaction_action_enum").drop(
        op.get_bind()
    )
    sa.Enum("Record", "Refuse", name="transfer_recommendation_enum").drop(op.get_bind())
    sa.Enum("A", "B", "C", "D", name="transfercategoryenum").drop(op.get_bind())
    sa.Enum(
        "Draft",
        "Deleted",
        "Sent",
        "Submitted",
        "Recommended",
        "Recorded",
        "Refused",
        "Declined",
        "Rescinded",
        name="transfer_type_enum",
    ).drop(op.get_bind())
    sa.Enum(
        "GOVERNMENT",
        "ADMINISTRATOR",
        "ANALYST",
        "COMPLIANCE_MANAGER",
        "DIRECTOR",
        "SUPPLIER",
        "MANAGE_USERS",
        "TRANSFER",
        "COMPLIANCE_REPORTING",
        "SIGNING_AUTHORITY",
        "READ_ONLY",
        name="role_enum",
    ).drop(op.get_bind())
