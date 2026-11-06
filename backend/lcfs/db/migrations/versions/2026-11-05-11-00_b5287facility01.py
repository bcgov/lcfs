"""Add organization-linked fuel production facilities.

Revision ID: b5287facility01
Revises: 4dab1d106b2b
Create Date: 2026-11-05 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b5287facility01"
down_revision = "4dab1d106b2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fuel_production_facility",
        sa.Column(
            "fuel_production_facility_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column("organization_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=500), nullable=True),
        sa.Column("city", sa.String(length=1000), nullable=True),
        sa.Column("province_state", sa.String(length=1000), nullable=True),
        sa.Column("country", sa.String(length=1000), nullable=True),
        sa.Column("iso", sa.String(length=10), nullable=True),
        sa.Column("nameplate_capacity", sa.Integer(), nullable=True),
        sa.Column(
            "nameplate_capacity_unit",
            postgresql.ENUM(name="quantityunitsenum", create_type=False),
            nullable=True,
        ),
        sa.Column("contact_name", sa.String(length=500), nullable=True),
        sa.Column("contact_email", sa.String(length=500), nullable=True),
        sa.Column(
            "create_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("create_user", sa.String(length=500), nullable=True),
        sa.Column(
            "update_date",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("update_user", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            ondelete="SET NULL",
        ),
        comment="Production facilities associated with organizations and fuel codes",
    )
    op.create_index(
        "ix_fuel_production_facility_organization_id",
        "fuel_production_facility",
        ["organization_id"],
    )

    op.create_table(
        "fuel_production_facility_document_association",
        sa.Column("fuel_production_facility_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["fuel_production_facility_id"],
            ["fuel_production_facility.fuel_production_facility_id"],
        ),
        sa.ForeignKeyConstraint(["document_id"], ["document.document_id"]),
        sa.PrimaryKeyConstraint("fuel_production_facility_id", "document_id"),
    )

    for table in ("ci_application", "fuel_code", "pathway"):
        op.add_column(
            table,
            sa.Column("fuel_production_facility_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            f"ix_{table}_fuel_production_facility_id",
            table,
            ["fuel_production_facility_id"],
        )
        op.create_foreign_key(
            f"fk_{table}_fuel_production_facility_id",
            table,
            "fuel_production_facility",
            ["fuel_production_facility_id"],
            ["fuel_production_facility_id"],
            ondelete="SET NULL",
        )

    # Keep one facility row per legacy record instead of guessing that rows
    # sharing a location belong to the same physical facility.
    op.add_column(
        "fuel_production_facility",
        sa.Column("legacy_ci_application_id", sa.Integer(), nullable=True),
    )
    op.execute("""
        INSERT INTO fuel_production_facility (
            organization_id, city, province_state, country, iso,
            nameplate_capacity, nameplate_capacity_unit, legacy_ci_application_id,
            create_date, create_user
        )
        SELECT organization_id, facility_city, facility_province_state,
               facility_country, facility_iso, facility_nameplate_capacity,
               facility_nameplate_capacity_unit, ci_application_id,
               COALESCE(create_date, now()), create_user
        FROM ci_application
        """)
    op.execute("""
        UPDATE ci_application AS application
        SET fuel_production_facility_id = facility.fuel_production_facility_id
        FROM fuel_production_facility AS facility
        WHERE facility.legacy_ci_application_id = application.ci_application_id
        """)
    op.drop_column("fuel_production_facility", "legacy_ci_application_id")

    op.add_column(
        "fuel_production_facility",
        sa.Column("legacy_fuel_code_id", sa.Integer(), nullable=True),
    )
    op.execute("""
        INSERT INTO fuel_production_facility (
            organization_id, city, province_state, country,
            nameplate_capacity, nameplate_capacity_unit, contact_name, contact_email,
            legacy_fuel_code_id, create_date, create_user
        )
        SELECT organization_id, fuel_production_facility_city,
               fuel_production_facility_province_state,
               fuel_production_facility_country, facility_nameplate_capacity,
               facility_nameplate_capacity_unit, contact_name, contact_email,
               fuel_code_id, COALESCE(create_date, now()), create_user
        FROM fuel_code
        """)
    op.execute("""
        UPDATE fuel_code AS code
        SET fuel_production_facility_id = facility.fuel_production_facility_id
        FROM fuel_production_facility AS facility
        WHERE facility.legacy_fuel_code_id = code.fuel_code_id
        """)
    op.drop_column("fuel_production_facility", "legacy_fuel_code_id")

    op.execute("""
        UPDATE pathway
        SET fuel_production_facility_id = COALESCE(
            (SELECT code.fuel_production_facility_id
             FROM fuel_code AS code
             WHERE code.fuel_code_id = pathway.fuel_code_id),
            (SELECT application.fuel_production_facility_id
             FROM ci_application AS application
             WHERE application.ci_application_id = pathway.ci_application_id)
        )
        """)


def downgrade() -> None:
    for table in ("pathway", "fuel_code", "ci_application"):
        op.drop_constraint(
            f"fk_{table}_fuel_production_facility_id",
            table,
            type_="foreignkey",
        )
        op.drop_index(
            f"ix_{table}_fuel_production_facility_id",
            table_name=table,
        )
        op.drop_column(table, "fuel_production_facility_id")
    op.drop_table("fuel_production_facility_document_association")
    op.drop_index(
        "ix_fuel_production_facility_organization_id",
        table_name="fuel_production_facility",
    )
    op.drop_table("fuel_production_facility")
