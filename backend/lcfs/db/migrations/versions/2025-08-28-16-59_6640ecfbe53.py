"""Create charging sites and Charging Equipment tables.

Revision ID: 6640ecfbe53
Revises: 71e8f75d9815
Create Date: 2025-08-28 16:59:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "6640ecfbe53"
down_revision = "71e8f75d9815"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use existing enum types (both already exist from initial migration)
    actiontypeenum = postgresql.ENUM(
        "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
    )
    ports_enum = postgresql.ENUM(
        "Single port", "Dual port", name="ports_enum", create_type=False
    )

    # 1. Create charging_site_status table
    op.create_table(
        "charging_site_status",
        sa.Column(
            "charging_site_status_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the charging site status",
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            comment="Charging site status",
        ),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment="Status description",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Display order for the status",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was updated in the database.",
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
        sa.PrimaryKeyConstraint("charging_site_status_id"),
        sa.UniqueConstraint("status"),
        comment="Status values for charging sites",
    )

    # 2. Create charging_site table
    op.create_table(
        "charging_site",
        sa.Column(
            "charging_site_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the charging site",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Associated organization ID",
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            nullable=False,
            comment="Current status of the charging site",
        ),
        sa.Column(
            "site_code",
            sa.String(length=5),
            nullable=False,
            comment="Auto-generated 5-character alphanumeric site code",
        ),
        sa.Column(
            "site_name",
            sa.String(length=255),
            nullable=False,
            comment="Name of the charging site",
        ),
        sa.Column(
            "street_address",
            sa.String(length=255),
            nullable=False,
            comment="Street address of the charging site",
        ),
        sa.Column(
            "city",
            sa.String(length=100),
            nullable=False,
            comment="City where the charging site is located",
        ),
        sa.Column(
            "postal_code",
            sa.String(length=10),
            nullable=False,
            comment="Postal code of the charging site",
        ),
        sa.Column(
            "latitude",
            sa.Double(),
            nullable=True,
            comment="Latitude coordinate of the charging site location",
        ),
        sa.Column(
            "longitude",
            sa.Double(),
            nullable=True,
            comment="Longitude coordinate of the charging site location",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
            comment="Optional notes about the charging site",
        ),
        # Versioning fields
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
            server_default=sa.text("0"),
            comment="Version number of the record",
        ),
        sa.Column(
            "action_type",
            actiontypeenum,
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this record",
        ),
        # Audit fields
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was updated in the database.",
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
        sa.PrimaryKeyConstraint("charging_site_id"),
        sa.UniqueConstraint("site_code"),
        comment="Charging sites",
    )

    # 3. Create charging_equipment_status table
    op.create_table(
        "charging_equipment_status",
        sa.Column(
            "charging_equipment_status_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the charging equipment status",
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            comment="Charging equipment status",
        ),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment="Status description",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Display order for the status",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was updated in the database.",
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
        sa.PrimaryKeyConstraint("charging_equipment_status_id"),
        sa.UniqueConstraint("status"),
        comment="Status values for charging equipment",
    )

    # 4. Create charging_equipment table
    op.create_table(
        "charging_equipment",
        sa.Column(
            "charging_equipment_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the charging equipment",
        ),
        sa.Column(
            "charging_site_id",
            sa.Integer(),
            nullable=False,
            comment="Associated charging site",
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            nullable=False,
            comment="Current status of the charging equipment",
        ),
        sa.Column(
            "equipment_number",
            sa.String(length=3),
            nullable=False,
            comment="Auto-generated 3-digit equipment number (suffix for registration)",
        ),
        sa.Column(
            "allocating_organization_id",
            sa.Integer(),
            nullable=True,
            comment="Optional allocating organization",
        ),
        sa.Column(
            "serial_number",
            sa.String(length=100),
            nullable=False,
            comment="Serial number of the equipment",
        ),
        sa.Column(
            "manufacturer",
            sa.String(length=100),
            nullable=False,
            comment="Manufacturer of the equipment",
        ),
        sa.Column(
            "model",
            sa.String(length=100),
            nullable=True,
            comment="Model of the equipment",
        ),
        sa.Column(
            "level_of_equipment_id",
            sa.Integer(),
            nullable=False,
            comment="Level/type of equipment",
        ),
        sa.Column(
            "ports",
            ports_enum,
            nullable=True,
            comment="Port configuration of the equipment",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
            comment="Optional notes about the charging equipment",
        ),
        # Versioning fields
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
            server_default=sa.text("0"),
            comment="Version number of the record",
        ),
        sa.Column(
            "action_type",
            actiontypeenum,
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this record",
        ),
        # Audit fields
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the record was updated in the database.",
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
        sa.PrimaryKeyConstraint("charging_equipment_id"),
        comment="Charging equipment",
    )

    # 5. Create charging_site_intended_user_association table
    op.create_table(
        "charging_site_intended_user_association",
        sa.Column(
            "charging_site_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "end_user_type_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("charging_site_id", "end_user_type_id"),
    )

    # 6. Create charging_site_document_association table
    op.create_table(
        "charging_site_document_association",
        sa.Column(
            "charging_site_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("charging_site_id", "document_id"),
    )

    # 7. Create charging_equipment_intended_use_association table
    op.create_table(
        "charging_equipment_intended_use_association",
        sa.Column(
            "charging_equipment_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "end_use_type_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("charging_equipment_id", "end_use_type_id"),
    )

    # Create foreign key constraints
    op.create_foreign_key(
        "fk_charging_site_organization_id",
        "charging_site",
        "organization",
        ["organization_id"],
        ["organization_id"],
    )
    op.create_foreign_key(
        "fk_charging_site_status_id",
        "charging_site",
        "charging_site_status",
        ["status_id"],
        ["charging_site_status_id"],
    )
    op.create_foreign_key(
        "fk_charging_equipment_charging_site_id",
        "charging_equipment",
        "charging_site",
        ["charging_site_id"],
        ["charging_site_id"],
    )
    op.create_foreign_key(
        "fk_charging_equipment_status_id",
        "charging_equipment",
        "charging_equipment_status",
        ["status_id"],
        ["charging_equipment_status_id"],
    )
    op.create_foreign_key(
        "fk_charging_equipment_allocating_organization_id",
        "charging_equipment",
        "organization",
        ["allocating_organization_id"],
        ["organization_id"],
    )
    op.create_foreign_key(
        "fk_charging_equipment_level_of_equipment_id",
        "charging_equipment",
        "level_of_equipment",
        ["level_of_equipment_id"],
        ["level_of_equipment_id"],
    )

    op.create_foreign_key(
        "fk_charging_site_intended_user_site_id",
        "charging_site_intended_user_association",
        "charging_site",
        ["charging_site_id"],
        ["charging_site_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_charging_site_intended_user_user_type_id",
        "charging_site_intended_user_association",
        "end_user_type",
        ["end_user_type_id"],
        ["end_user_type_id"],
    )
    op.create_foreign_key(
        "fk_charging_site_document_site_id",
        "charging_site_document_association",
        "charging_site",
        ["charging_site_id"],
        ["charging_site_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_charging_site_document_document_id",
        "charging_site_document_association",
        "document",
        ["document_id"],
        ["document_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_charging_equipment_intended_use_charging_equipment_id",
        "charging_equipment_intended_use_association",
        "charging_equipment",
        ["charging_equipment_id"],
        ["charging_equipment_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_charging_equipment_intended_use_end_use_type_id",
        "charging_equipment_intended_use_association",
        "end_use_type",
        ["end_use_type_id"],
        ["end_use_type_id"],
    )

    # Create indexes
    op.create_index(
        "idx_charging_site_organization_id", "charging_site", ["organization_id"]
    )
    op.create_index("idx_charging_site_status_id", "charging_site", ["status_id"])
    op.create_index("idx_charging_site_site_code", "charging_site", ["site_code"])
    op.create_index(
        "idx_charging_equipment_charging_site_id",
        "charging_equipment",
        ["charging_site_id"],
    )
    op.create_index(
        "idx_charging_equipment_status_id", "charging_equipment", ["status_id"]
    )
    op.create_index(
        "idx_charging_equipment_equipment_number",
        "charging_equipment",
        ["equipment_number"],
    )
    op.create_index(
        "idx_charging_equipment_level_of_equipment_id",
        "charging_equipment",
        ["level_of_equipment_id"],
    )

    # Seed initial status data
    charging_site_status_table = sa.table(
        "charging_site_status",
        sa.column("status", sa.String),
        sa.column("description", sa.String),
        sa.column("display_order", sa.Integer),
    )

    charging_equipment_status_table = sa.table(
        "charging_equipment_status",
        sa.column("status", sa.String),
        sa.column("description", sa.String),
        sa.column("display_order", sa.Integer),
    )

    op.bulk_insert(
        charging_site_status_table,
        [
            {
                "status": "Draft",
                "description": "Site is being created or edited",
                "display_order": 1,
            },
            {
                "status": "Submitted",
                "description": "Site has been submitted for review",
                "display_order": 2,
            },
            {
                "status": "Validated",
                "description": "Site has been validated",
                "display_order": 3,
            },
            {
                "status": "Updated",
                "description": "Site has been updated after validation",
                "display_order": 4,
            },
        ],
    )

    op.bulk_insert(
        charging_equipment_status_table,
        [
            {
                "status": "Draft",
                "description": "Charging equipment is being created or edited",
                "display_order": 1,
            },
            {
                "status": "Submitted",
                "description": "Charging equipment has been submitted for review",
                "display_order": 2,
            },
            {
                "status": "Validated",
                "description": "Charging equipment has been validated",
                "display_order": 3,
            },
            {
                "status": "Updated",
                "description": "Charging equipment has been updated after validation",
                "display_order": 4,
            },
            {
                "status": "Decommissioned",
                "description": "Charging equipment is no longer in service",
                "display_order": 5,
            },
        ],
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index("idx_charging_equipment_level_of_equipment_id", "charging_equipment")
    op.drop_index("idx_charging_equipment_equipment_number", "charging_equipment")
    op.drop_index("idx_charging_equipment_status_id", "charging_equipment")
    op.drop_index("idx_charging_equipment_charging_site_id", "charging_equipment")
    op.drop_index("idx_charging_site_site_code", "charging_site")
    op.drop_index("idx_charging_site_status_id", "charging_site")
    op.drop_index("idx_charging_site_organization_id", "charging_site")

    # Drop foreign key constraints
    op.drop_constraint(
        "fk_charging_equipment_intended_use_end_use_type_id",
        "charging_equipment_intended_use_association",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_equipment_intended_use_charging_equipment_id",
        "charging_equipment_intended_use_association",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_site_document_document_id",
        "charging_site_document_association",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_site_document_site_id",
        "charging_site_document_association",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_site_intended_user_user_type_id",
        "charging_site_intended_user_association",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_site_intended_user_site_id",
        "charging_site_intended_user_association",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_charging_equipment_level_of_equipment_id",
        "charging_equipment",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_equipment_allocating_organization_id",
        "charging_equipment",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_equipment_status_id", "charging_equipment", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_charging_equipment_charging_site_id",
        "charging_equipment",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_charging_site_status_id", "charging_site", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_charging_site_organization_id", "charging_site", type_="foreignkey"
    )

    # Drop tables
    op.drop_table("charging_equipment_intended_use_association")
    op.drop_table("charging_site_document_association")
    op.drop_table("charging_site_intended_user_association")
    op.drop_table("charging_equipment")
    op.drop_table("charging_equipment_status")
    op.drop_table("charging_site")
    op.drop_table("charging_site_status")
