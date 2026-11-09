"""Add organization-linked fuel production facilities.

Revision ID: 9e0e5741b48f
Revises: a6f1c2d3e4b5
Create Date: 2026-11-05 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "9e0e5741b48f"
down_revision = "a6f1c2d3e4b5"
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

    # Backfill facilities from legacy ci_application / fuel_code columns.
    # Rows describing the same facility (same organization, location,
    # nameplate capacity + unit and contact details, compared trimmed and
    # case-insensitively, NULL-safe) collapse into a single facility row.
    # ISO is not part of the key because it is derived from the country and
    # only CI applications record it; the first non-null value is kept.
    # Fuel codes without an organization (unmatched historical producers) are
    # identified by their company name instead, so two producers sharing a
    # location never share a facility. The company key only exists during
    # the migration and is dropped once linking is complete.
    op.add_column(
        "fuel_production_facility",
        sa.Column("legacy_company_key", sa.String(length=1000), nullable=True),
    )
    op.execute(
        """
        CREATE TEMP TABLE tmp_fpf_source AS
        SELECT 'ci_application' AS source_type,
               ci_application_id AS source_id,
               organization_id,
               NULL::varchar AS company_key,
               facility_city AS city,
               facility_province_state AS province_state,
               facility_country AS country,
               facility_iso AS iso,
               facility_nameplate_capacity AS nameplate_capacity,
               facility_nameplate_capacity_unit AS nameplate_capacity_unit,
               NULL::varchar AS contact_name,
               NULL::varchar AS contact_email,
               COALESCE(create_date, now()) AS create_date,
               create_user
        FROM ci_application
        UNION ALL
        SELECT 'fuel_code',
               fuel_code_id,
               organization_id,
               CASE
                   WHEN organization_id IS NULL THEN lower(btrim(company))
               END,
               fuel_production_facility_city,
               fuel_production_facility_province_state,
               fuel_production_facility_country,
               NULL,
               facility_nameplate_capacity,
               facility_nameplate_capacity_unit,
               contact_name,
               contact_email,
               COALESCE(create_date, now()),
               create_user
        FROM fuel_code
        """
    )
    # Records with no facility data at all get no facility row.
    op.execute(
        """
        DELETE FROM tmp_fpf_source
        WHERE city IS NULL AND province_state IS NULL AND country IS NULL
          AND nameplate_capacity IS NULL AND nameplate_capacity_unit IS NULL
          AND contact_name IS NULL AND contact_email IS NULL
        """
    )

    _insert_missing_facilities("src.source_type = 'ci_application'")
    _link_facilities(
        "ci_application", "ci_application_id", "src.source_type = 'ci_application'"
    )

    # Fuel codes generated from a CI application share its facility when the
    # location and capacity still match; their contact details then complete
    # the facility record (CI applications never captured contacts).
    op.execute(
        f"""
        UPDATE fuel_code AS code
        SET fuel_production_facility_id = application.fuel_production_facility_id
        FROM ci_application_fuel_code_association AS assoc
        JOIN ci_application AS application
          ON application.ci_application_id = assoc.ci_application_id
        WHERE code.fuel_code_id = assoc.fuel_code_id
          AND application.fuel_production_facility_id IS NOT NULL
          AND {_same_text("code.fuel_production_facility_city", "application.facility_city")}
          AND {_same_text("code.fuel_production_facility_province_state", "application.facility_province_state")}
          AND {_same_text("code.fuel_production_facility_country", "application.facility_country")}
          AND code.facility_nameplate_capacity
              IS NOT DISTINCT FROM application.facility_nameplate_capacity
          AND code.facility_nameplate_capacity_unit
              IS NOT DISTINCT FROM application.facility_nameplate_capacity_unit
        """
    )
    op.execute(
        """
        UPDATE fuel_production_facility AS facility
        SET contact_name = contacts.contact_name,
            contact_email = contacts.contact_email
        FROM (
            SELECT DISTINCT ON (fuel_production_facility_id)
                   fuel_production_facility_id, contact_name, contact_email
            FROM fuel_code
            WHERE fuel_production_facility_id IS NOT NULL
              AND (contact_name IS NOT NULL OR contact_email IS NOT NULL)
            ORDER BY fuel_production_facility_id, fuel_code_id
        ) AS contacts
        WHERE facility.fuel_production_facility_id = contacts.fuel_production_facility_id
          AND facility.contact_name IS NULL
          AND facility.contact_email IS NULL
        """
    )

    remaining_fuel_codes = """
        src.source_type = 'fuel_code'
        AND src.source_id IN (
            SELECT fuel_code_id FROM fuel_code
            WHERE fuel_production_facility_id IS NULL
        )
    """
    _insert_missing_facilities(remaining_fuel_codes)
    _link_facilities("fuel_code", "fuel_code_id", remaining_fuel_codes)

    op.execute("DROP TABLE tmp_fpf_source")
    op.drop_column("fuel_production_facility", "legacy_company_key")

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


def _same_text(left: str, right: str) -> str:
    return f"lower(btrim({left})) IS NOT DISTINCT FROM lower(btrim({right}))"


def _facility_key_match(facility: str, source: str) -> str:
    """SQL predicate: facility row describes the same facility as a source row."""
    return " AND ".join(
        [
            f"{facility}.organization_id IS NOT DISTINCT FROM {source}.organization_id",
            f"{facility}.legacy_company_key IS NOT DISTINCT FROM {source}.company_key",
            _same_text(f"{facility}.city", f"{source}.city"),
            _same_text(f"{facility}.province_state", f"{source}.province_state"),
            _same_text(f"{facility}.country", f"{source}.country"),
            f"{facility}.nameplate_capacity IS NOT DISTINCT FROM {source}.nameplate_capacity",
            f"{facility}.nameplate_capacity_unit IS NOT DISTINCT FROM {source}.nameplate_capacity_unit",
            _same_text(f"{facility}.contact_name", f"{source}.contact_name"),
            _same_text(f"{facility}.contact_email", f"{source}.contact_email"),
        ]
    )


_SOURCE_KEY_EXPRESSIONS = """
    src.organization_id,
    src.company_key,
    lower(btrim(src.city)),
    lower(btrim(src.province_state)),
    lower(btrim(src.country)),
    src.nameplate_capacity,
    src.nameplate_capacity_unit,
    lower(btrim(src.contact_name)),
    lower(btrim(src.contact_email))
"""


def _insert_missing_facilities(source_filter: str) -> None:
    """Create one facility per distinct key among the filtered source rows
    that does not already have a matching facility."""
    op.execute(
        f"""
        INSERT INTO fuel_production_facility (
            organization_id, legacy_company_key, city, province_state, country, iso,
            nameplate_capacity, nameplate_capacity_unit, contact_name, contact_email,
            create_date, create_user
        )
        SELECT DISTINCT ON ({_SOURCE_KEY_EXPRESSIONS})
               src.organization_id, src.company_key,
               src.city, src.province_state, src.country, src.iso,
               src.nameplate_capacity, src.nameplate_capacity_unit,
               src.contact_name, src.contact_email,
               src.create_date, src.create_user
        FROM tmp_fpf_source AS src
        WHERE ({source_filter})
          AND NOT EXISTS (
              SELECT 1 FROM fuel_production_facility AS facility
              WHERE {_facility_key_match("facility", "src")}
          )
        ORDER BY {_SOURCE_KEY_EXPRESSIONS},
                 src.iso IS NULL, src.create_date, src.source_id
        """
    )


def _link_facilities(table: str, primary_key: str, source_filter: str) -> None:
    op.execute(
        f"""
        UPDATE {table} AS target
        SET fuel_production_facility_id = facility.fuel_production_facility_id
        FROM tmp_fpf_source AS src
        JOIN fuel_production_facility AS facility
          ON {_facility_key_match("facility", "src")}
        WHERE ({source_filter})
          AND target.{primary_key} = src.source_id
        """
    )

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
