"""Add CI application, pathway, and related lookup tables.

Implements the full Carbon Intensity (CI) application data model:
  - ci_application_status     — lookup: Draft | Submitted | Completed | Withdrawn
  - pathway_application_type  — lookup: New | Renewal
  - pathway_fuel_code_type    — lookup: 1-year provisional | 3-year
  - ci_application            — main application record (org, status, facility, consultant, signature)
  - pathway                   — pathway details linked to a CI application
  - ci_application_document_association — M:N link to the existing document table
  - ci_application_history    — JSONB snapshot-based audit trail with status tracking

Revision ID: c1d2e3f4a5b6
Revises: e0f9a4a6316a
Create Date: 2026-04-16 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "e0f9a4a6316a"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ------------------------------------------------------------------
    # ci_application_status  (lookup)
    # ------------------------------------------------------------------
    op.create_table(
        "ci_application_status",
        sa.Column(
            "ci_application_status_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the CI application status",
        ),
        sa.Column(
            "status",
            sa.String(100),
            nullable=False,
            comment="Status value (e.g. Draft, Submitted, Completed, Withdrawn)",
        ),
        sa.Column(
            "description",
            sa.String(500),
            nullable=True,
            comment="Optional description of the status",
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
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was updated in the database.",
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
        comment="Lookup table for CI application workflow statuses",
    )

    # ------------------------------------------------------------------
    # pathway_application_type  (lookup)
    # ------------------------------------------------------------------
    op.create_table(
        "pathway_application_type",
        sa.Column(
            "pathway_application_type_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the pathway application type",
        ),
        sa.Column(
            "type",
            sa.String(100),
            nullable=False,
            comment="Pathway application type value (e.g. New, Renewal)",
        ),
        sa.Column(
            "description",
            sa.String(500),
            nullable=True,
            comment="Optional description of the type",
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
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was updated in the database.",
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
        comment="Lookup table for CI application pathway types (New or Renewal)",
    )

    # ------------------------------------------------------------------
    # pathway_fuel_code_type  (lookup)
    # ------------------------------------------------------------------
    op.create_table(
        "pathway_fuel_code_type",
        sa.Column(
            "pathway_fuel_code_type_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the pathway fuel code type",
        ),
        sa.Column(
            "type",
            sa.String(100),
            nullable=False,
            comment="Fuel code duration type value (e.g. 1-year provisional, 3-year)",
        ),
        sa.Column(
            "description",
            sa.String(500),
            nullable=True,
            comment="Optional description of the type",
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
            comment="Date and time (UTC) when the physical record was created.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was updated.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record.",
        ),
        comment="Lookup table for CI pathway fuel code duration types",
    )

    # ------------------------------------------------------------------
    # ci_application
    # ------------------------------------------------------------------
    op.create_table(
        "ci_application",
        sa.Column(
            "ci_application_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the CI application",
        ),
        # Status
        sa.Column(
            "status_id",
            sa.Integer(),
            sa.ForeignKey(
                "ci_application_status.ci_application_status_id",
                name="fk_ci_application_status_id_ci_application_status",
            ),
            nullable=False,
            comment="Current workflow status of the CI application (Draft, Submitted, Completed, Withdrawn)",
        ),
        # Organization
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey(
                "organization.organization_id",
                name="fk_ci_application_organization_id_organization",
            ),
            nullable=False,
            comment="Organization submitting the CI application",
        ),
        # Facility location
        sa.Column(
            "facility_city",
            sa.String(500),
            nullable=True,
            comment="City of the fuel production facility",
        ),
        sa.Column(
            "facility_province_state",
            sa.String(500),
            nullable=True,
            comment="Province or state of the fuel production facility",
        ),
        sa.Column(
            "facility_country",
            sa.String(500),
            nullable=False,
            comment="Country of the fuel production facility",
        ),
        sa.Column(
            "facility_iso",
            sa.String(10),
            nullable=True,
            comment="ISO country or region code for the facility location",
        ),
        # Nameplate capacity
        sa.Column(
            "facility_nameplate_capacity",
            sa.Integer(),
            nullable=False,
            comment="Annual nameplate capacity of the fuel production facility",
        ),
        sa.Column(
            "facility_nameplate_capacity_unit_id",
            sa.Integer(),
            sa.ForeignKey(
                "unit_of_measure.uom_id",
                name="fk_ci_application_capacity_unit_id_unit_of_measure",
            ),
            nullable=False,
            comment="Unit of measure for the facility nameplate capacity",
        ),
        # Fuel code / pathway
        sa.Column(
            "proposed_fuel_code_effective_date",
            sa.Date(),
            nullable=True,
            comment="Proposed date from which the fuel code becomes effective",
        ),
        sa.Column(
            "pathway_description",
            sa.Text(),
            nullable=True,
            comment="Free-text description of the CI pathway",
        ),
        sa.Column(
            "supporting_document_other",
            sa.String(1000),
            nullable=True,
            comment="Description of any other supporting documents provided",
        ),
        # Consultant contact
        sa.Column(
            "consultant_name",
            sa.String(500),
            nullable=True,
            comment="Full name of the third-party consultant (if applicable)",
        ),
        sa.Column(
            "consultant_company",
            sa.String(500),
            nullable=True,
            comment="Company of the third-party consultant (if applicable)",
        ),
        sa.Column(
            "consultant_email",
            sa.String(500),
            nullable=True,
            comment="Email address of the third-party consultant (if applicable)",
        ),
        # Electronic signature
        sa.Column(
            "signature_user",
            sa.String(500),
            nullable=True,
            comment="Username or full name of the signatory",
        ),
        sa.Column(
            "signature_date_time",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time at which the application was electronically signed",
        ),
        # Versioning
        sa.Column(
            "group_uuid",
            sa.String(36),
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
            PgEnum("CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False),
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this record",
        ),
        # Audit
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was created.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was updated.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record.",
        ),
        comment=(
            "Carbon Intensity application submitted by an organization, "
            "containing facility details, consultant contact, and signature."
        ),
    )

    op.create_index(
        "ix_ci_application_organization_id",
        "ci_application",
        ["organization_id"],
    )
    op.create_index(
        "ix_ci_application_status_id",
        "ci_application",
        ["status_id"],
    )

    # ------------------------------------------------------------------
    # pathway
    # ------------------------------------------------------------------
    op.create_table(
        "pathway",
        sa.Column(
            "pathway_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the pathway record",
        ),
        sa.Column(
            "ci_application_id",
            sa.Integer(),
            sa.ForeignKey(
                "ci_application.ci_application_id",
                name="fk_pathway_ci_application_id_ci_application",
            ),
            nullable=False,
            comment="CI application this pathway belongs to",
        ),
        sa.Column(
            "application_type_id",
            sa.Integer(),
            sa.ForeignKey(
                "pathway_application_type.pathway_application_type_id",
                name="fk_pathway_application_type_id_pathway_application_type",
            ),
            nullable=False,
            comment="Whether this pathway is for a new application or a renewal",
        ),
        sa.Column(
            "fuel_code_type_id",
            sa.Integer(),
            sa.ForeignKey(
                "pathway_fuel_code_type.pathway_fuel_code_type_id",
                name="fk_pathway_fuel_code_type_id_pathway_fuel_code_type",
            ),
            nullable=False,
            comment="Duration type of the proposed fuel code",
        ),
        sa.Column(
            "operating_data_from",
            sa.Date(),
            nullable=False,
            comment="Start date of the operating data collection period",
        ),
        sa.Column(
            "operating_data_to",
            sa.Date(),
            nullable=False,
            comment="End date of the operating data collection period",
        ),
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            sa.ForeignKey(
                "fuel_code.fuel_code_id",
                name="fk_pathway_fuel_code_id_fuel_code",
            ),
            nullable=True,
            comment="Existing fuel code being renewed; null for new applications",
        ),
        sa.Column(
            "proposed_ci",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            comment="Proposed carbon intensity value in gCO2e/MJ",
        ),
        sa.Column(
            "fuel_type_id",
            sa.Integer(),
            sa.ForeignKey(
                "fuel_type.fuel_type_id",
                name="fk_pathway_fuel_type_id_fuel_type",
            ),
            nullable=False,
            comment="Type of fuel produced",
        ),
        sa.Column(
            "feedstock",
            sa.String(500),
            nullable=False,
            comment="Feedstock used to produce the fuel",
        ),
        sa.Column(
            "feedstock_region",
            sa.String(500),
            nullable=False,
            comment="Geographic region from which the feedstock is sourced",
        ),
        sa.Column(
            "feedstock_transport_mode",
            sa.String(500),
            nullable=False,
            comment="Mode of transport used to move the feedstock to the facility",
        ),
        sa.Column(
            "feedstock_transport_distance",
            sa.Integer(),
            nullable=False,
            comment="Distance (km) the feedstock is transported to the facility",
        ),
        sa.Column(
            "coproducts",
            sa.String(1000),
            nullable=True,
            comment="Description of co-products produced alongside the main fuel (if any)",
        ),
        sa.Column(
            "finished_fuel_transport_mode",
            sa.String(500),
            nullable=False,
            comment="Mode of transport used to deliver the finished fuel",
        ),
        sa.Column(
            "finished_fuel_transport_distance",
            sa.Integer(),
            nullable=False,
            comment="Distance (km) the finished fuel is transported for delivery",
        ),
        # Versioning
        sa.Column(
            "group_uuid",
            sa.String(36),
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
            PgEnum("CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False),
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this record",
        ),
        # Audit
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was created.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was updated.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record.",
        ),
        comment=(
            "CI pathway details for a CI application, including fuel type, "
            "feedstock, transport, and proposed carbon intensity."
        ),
    )

    op.create_index(
        "ix_pathway_ci_application_id",
        "pathway",
        ["ci_application_id"],
    )
    op.create_index(
        "ix_pathway_fuel_code_id",
        "pathway",
        ["fuel_code_id"],
    )
    op.create_index(
        "ix_pathway_fuel_type_id",
        "pathway",
        ["fuel_type_id"],
    )

    # ------------------------------------------------------------------
    # ci_application_document_association  (M:N)
    # ------------------------------------------------------------------
    op.create_table(
        "ci_application_document_association",
        sa.Column(
            "ci_application_id",
            sa.Integer(),
            sa.ForeignKey(
                "ci_application.ci_application_id",
                name="fk_ci_app_doc_assoc_ci_application_id_ci_application",
            ),
            primary_key=True,
            comment="Foreign key to ci_application",
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey(
                "document.document_id",
                name="fk_ci_application_document_association_document_id_document",
            ),
            primary_key=True,
            comment="Foreign key to document",
        ),
    )

    # ------------------------------------------------------------------
    # ci_application_history
    # ------------------------------------------------------------------
    op.create_table(
        "ci_application_history",
        sa.Column(
            "ci_application_history_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the history record",
        ),
        sa.Column(
            "ci_application_id",
            sa.Integer(),
            sa.ForeignKey(
                "ci_application.ci_application_id",
                name="fk_ci_application_history_ci_application_id_ci_application",
            ),
            nullable=False,
            comment="CI application this history record belongs to",
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            sa.ForeignKey(
                "ci_application_status.ci_application_status_id",
                name="fk_ci_application_history_status_id_ci_application_status",
            ),
            nullable=True,
            comment="Status of the CI application at the time this history record was created",
        ),
        sa.Column(
            "ci_application_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Complete snapshot of the CI application at the time of change",
        ),
        # Versioning
        sa.Column(
            "group_uuid",
            sa.String(36),
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
            PgEnum("CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False),
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this record",
        ),
        # Audit
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was created.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment="Date and time (UTC) when the physical record was updated.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record.",
        ),
        comment="Audit trail capturing snapshots of CI application state at each change",
    )

    op.create_index(
        "ix_ci_application_history_ci_application_id",
        "ci_application_history",
        ["ci_application_id"],
    )

    # ------------------------------------------------------------------
    # Seed lookup data
    # ------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO ci_application_status
            (status, description, display_order, create_user, update_user)
        VALUES
            ('Draft',     'Application is being drafted by the organization', 1, 'system', 'system'),
            ('Submitted', 'Application has been submitted for review',        2, 'system', 'system'),
            ('Completed', 'Application has been completed and approved',      3, 'system', 'system'),
            ('Withdrawn', 'Application has been withdrawn by the applicant',  4, 'system', 'system')
        """
    )

    op.execute(
        """
        INSERT INTO pathway_application_type
            (type, description, display_order, create_user, update_user)
        VALUES
            ('New',     'New CI application',                    1, 'system', 'system'),
            ('Renewal', 'Renewal of an existing CI application', 2, 'system', 'system')
        """
    )

    op.execute(
        """
        INSERT INTO pathway_fuel_code_type
            (type, description, display_order, create_user, update_user)
        VALUES
            ('1-year provisional', '1-year provisional fuel code', 1, 'system', 'system'),
            ('3-year',             '3-year fuel code',             2, 'system', 'system')
        """
    )


def downgrade() -> None:
    op.drop_index("ix_ci_application_history_ci_application_id", table_name="ci_application_history")
    op.drop_table("ci_application_history")
    op.drop_table("ci_application_document_association")
    op.drop_index("ix_pathway_fuel_type_id", table_name="pathway")
    op.drop_index("ix_pathway_fuel_code_id", table_name="pathway")
    op.drop_index("ix_pathway_ci_application_id", table_name="pathway")
    op.drop_table("pathway")
    op.drop_index("ix_ci_application_status_id", table_name="ci_application")
    op.drop_index("ix_ci_application_organization_id", table_name="ci_application")
    op.drop_table("ci_application")
    op.drop_table("pathway_fuel_code_type")
    op.drop_table("pathway_application_type")
    op.drop_table("ci_application_status")
