"""Add the LCJFIP application data model (#5501).

Creates the Low Carbon Jet Fuel Incentive Program (LCJFIP) application tables:

Lookups (seeded here):
  - lcjfip_application_status   Draft | Submitted | Approved | Rejected
  - lcjfip_car_type             CAR 701 / 703 / 704 / 705
  - lcjfip_certificate_type     Domestic | Foreign (3) | Private
  - lcjfip_feedstock_source     12 anticipated feedstock sources
  - lcjfip_incentive_option     Cash | LCFS credit | credit to fuel supplier
  - lcjfip_incentive_rate       max CAD or credits per litre by CI band

Reference data with no seed (dates still to be set by the program):
  - lcjfip_application_period   intake rounds

Application data:
  - lcjfip_application                       one row per application
  - lcjfip_application_car_type              application <-> CAR type (M:N)
  - lcjfip_purchase_detail                   LCJF purchase rows (1:N)
  - lcjfip_purchase_detail_feedstock         purchase row <-> feedstock (M:N)
  - lcjfip_application_history               status timeline + JSONB snapshot
  - lcjfip_application_internal_comment      link to the shared comment framework
  - lcjfip_application_document_association  link to the shared document table

Also seeds the "LCJFIP application notes" Comment Log category, creates
the Metabase views vw_lcjfip_application_base and
vw_lcjfip_purchase_detail_base from sql/views/metabase.sql, and revokes any
reporting-role access to the base tables that default privileges granted.

Revision ID: 810923914d50
Revises: 9b3e5c7a1d24
Create Date: 2026-11-17 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "810923914d50"
down_revision = "9b3e5c7a1d24"
branch_labels = None
depends_on = None


INCENTIVE_TYPE_ENUM = postgresql.ENUM(
    "Cash", "Credit", name="lcjfip_incentive_type_enum", create_type=False
)

COMMENT_CATEGORY = "LCJFIP application notes"
COMMENT_CATEGORY_ORDER = 70

VIEW_SECTIONS = [
    "LCJFIP Application Base View",
    "LCJFIP Purchase Detail Base View",
]
VIEW_NAMES = [
    "vw_lcjfip_application_base",
    "vw_lcjfip_purchase_detail_base",
]

# Every base table created here. Metabase reads LCJFIP only through the views,
# which leave out Drafts and contact details.
BASE_TABLES = [
    "lcjfip_application_status",
    "lcjfip_application_period",
    "lcjfip_car_type",
    "lcjfip_certificate_type",
    "lcjfip_feedstock_source",
    "lcjfip_incentive_option",
    "lcjfip_incentive_rate",
    "lcjfip_application",
    "lcjfip_application_car_type",
    "lcjfip_purchase_detail",
    "lcjfip_purchase_detail_feedstock",
    "lcjfip_application_history",
    "lcjfip_application_internal_comment",
    "lcjfip_application_document_association",
]

# (status, description), seeded in display order.
STATUSES = [
    ("Draft", "Being prepared by the applicant. Not visible to government."),
    ("Submitted", "Signed and submitted for government review."),
    ("Approved", "Approved by government. An incentive award letter follows."),
    ("Rejected", "Not approved by government."),
]

CAR_TYPES = [
    "CAR 701 - Foreign air operations",
    "CAR 703 - Air taxi operations",
    "CAR 704 - Commuter operations",
    "CAR 705 - Airline operations",
]

CERTIFICATE_TYPES = [
    "Domestic",
    "Foreign - air transport service",
    "Foreign - code share",
    "Foreign - free trade agreement",
    "Private",
]

FEEDSTOCK_SOURCES = [
    "Agricultural residues",
    "Alcohol-derived feedstock",
    "Canola / rapeseed oil",
    "Corn oil",
    "Forestry / woody biomass residues",
    "Municipal solid waste / waste-derived feedstock",
    "Other",
    "Other vegetable oils",
    "Soybean oil",
    "Tallow / animal fats",
    "Unknown / To be determined",
    "Used cooking oil (UCO)",
]

# (name, incentive_type, requires_fuel_supplier)
INCENTIVE_OPTIONS = [
    ("Cash incentive", "Cash", False),
    ("LCFS credit option", "Credit", False),
    ("LCFS credit option - Fuel supplier incentive transfer", "Credit", True),
]

# (incentive_type, ci_lower_bound (exclusive), ci_upper_bound (inclusive),
#  max_rate_per_litre, description)
INCENTIVE_RATES = [
    ("Cash", 10, None, "0.7500", "CI greater than 10 gCO2e/MJ"),
    ("Cash", None, 10, "1.1250", "CI less than or equal to 10 gCO2e/MJ"),
    ("Credit", 10, None, "0.0050", "CI greater than 10 gCO2e/MJ"),
    ("Credit", None, 10, "0.0075", "CI less than or equal to 10 gCO2e/MJ"),
]


# ---------------------------------------------------------------------------
# Column helpers (match BaseModel, Auditable, DisplayOrder, EffectiveDates)
# ---------------------------------------------------------------------------


def _pk(name, comment):
    return sa.Column(
        name, sa.Integer(), autoincrement=True, nullable=False, comment=comment
    )


def _audit_columns():
    return [
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
    ]


def _timestamp_columns():
    """create_date/update_date only (BaseModel without Auditable)."""
    return _audit_columns()[:2]


def _display_order_column():
    return sa.Column(
        "display_order",
        sa.Integer(),
        nullable=True,
        comment="Relative rank in display sorting order",
    )


def _effective_date_columns():
    return [
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
    ]


def _select_list_lookup(
    table, pk, pk_comment, name_comment, description_comment, comment, extra=()
):
    """A select-list lookup: name + description, orderable and retirable."""
    op.create_table(
        table,
        _pk(pk, pk_comment),
        sa.Column("name", sa.String(length=100), nullable=False, comment=name_comment),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment=description_comment,
        ),
        *extra,
        *_audit_columns(),
        _display_order_column(),
        *_effective_date_columns(),
        sa.PrimaryKeyConstraint(pk, name=op.f(f"pk_{table}")),
        sa.UniqueConstraint("name", name=op.f(f"uq_{table}_name")),
        comment=comment,
    )


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------


def _create_lookup_tables() -> None:
    INCENTIVE_TYPE_ENUM.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lcjfip_application_status",
        _pk(
            "lcjfip_application_status_id",
            "Unique identifier for the LCJFIP application status.",
        ),
        sa.Column(
            "status",
            sa.String(length=100),
            nullable=False,
            comment="Status value (e.g. Draft, Submitted, Approved, Rejected).",
        ),
        sa.Column(
            "description",
            sa.String(length=500),
            nullable=True,
            comment="Description of the status.",
        ),
        *_audit_columns(),
        _display_order_column(),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_status_id",
            name=op.f("pk_lcjfip_application_status"),
        ),
        sa.UniqueConstraint("status", name=op.f("uq_lcjfip_application_status_status")),
        comment="Lookup table for LCJFIP application workflow statuses.",
    )

    op.create_table(
        "lcjfip_application_period",
        _pk(
            "lcjfip_application_period_id",
            "Unique identifier for the LCJFIP application period.",
        ),
        sa.Column(
            "description",
            sa.String(length=100),
            nullable=False,
            comment="Display name of the period, quoted in award and disbursement letters.",
        ),
        sa.Column(
            "open_date",
            sa.Date(),
            nullable=False,
            comment="First day (inclusive) on which applications can be submitted into this period.",
        ),
        sa.Column(
            "close_date",
            sa.Date(),
            nullable=True,
            comment="Last day (inclusive) on which applications can be submitted into this period. NULL while the close date is not yet set.",
        ),
        *_audit_columns(),
        _display_order_column(),
        sa.CheckConstraint(
            "close_date IS NULL OR close_date >= open_date",
            name=op.f("ck_lcjfip_application_period_close_after_open"),
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_period_id",
            name=op.f("pk_lcjfip_application_period"),
        ),
        sa.UniqueConstraint(
            "description", name=op.f("uq_lcjfip_application_period_description")
        ),
        comment="LCJFIP intake rounds. An application is assigned to the period open on its submission date.",
    )

    _select_list_lookup(
        "lcjfip_car_type",
        "lcjfip_car_type_id",
        "Unique identifier for the CAR type.",
        "Option label shown in the select list, e.g. 'CAR 705 - Airline operations'.",
        "Description of the CAR type.",
        "Lookup of Canadian Aviation Regulations (CAR) operation types an LCJFIP applicant can hold. Linked to applications through lcjfip_application_car_type.",
    )
    _select_list_lookup(
        "lcjfip_certificate_type",
        "lcjfip_certificate_type_id",
        "Unique identifier for the certificate type.",
        "Option label shown in the select list, e.g. 'Domestic'.",
        "Description of the certificate type.",
        "Lookup of air operator certificate types for LCJFIP applicants.",
    )
    _select_list_lookup(
        "lcjfip_feedstock_source",
        "lcjfip_feedstock_source_id",
        "Unique identifier for the feedstock source.",
        "Option label shown in the select list, e.g. 'Used cooking oil (UCO)'.",
        "Description of the feedstock source.",
        "Lookup of anticipated feedstock sources for LCJF purchases. Linked to purchase details through lcjfip_purchase_detail_feedstock.",
    )
    _select_list_lookup(
        "lcjfip_incentive_option",
        "lcjfip_incentive_option_id",
        "Unique identifier for the incentive option.",
        "Option label shown on the form, e.g. 'Cash incentive'.",
        "Description of the incentive option.",
        "Lookup of the incentive options an LCJFIP applicant can prefer. incentive_type sets the unit of the application's incentive amounts.",
        extra=(
            sa.Column(
                "incentive_type",
                INCENTIVE_TYPE_ENUM,
                nullable=False,
                comment="Cash (amounts in CAD) or Credit (amounts in LCFS credits).",
            ),
            sa.Column(
                "requires_fuel_supplier",
                sa.Boolean(),
                server_default="false",
                nullable=False,
                comment="True when the applicant must name the fuel supplier that receives the incentive (fuel supplier incentive transfer).",
            ),
        ),
    )

    op.create_table(
        "lcjfip_incentive_rate",
        _pk("lcjfip_incentive_rate_id", "Unique identifier for the incentive rate."),
        sa.Column(
            "incentive_type",
            INCENTIVE_TYPE_ENUM,
            nullable=False,
            comment="Cash (rate in CAD per litre) or Credit (rate in LCFS credits per litre).",
        ),
        sa.Column(
            "ci_lower_bound",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Exclusive lower carbon intensity bound in gCO2e/MJ. NULL means no lower bound.",
        ),
        sa.Column(
            "ci_upper_bound",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Inclusive upper carbon intensity bound in gCO2e/MJ. NULL means no upper bound.",
        ),
        sa.Column(
            "max_rate_per_litre",
            sa.Numeric(precision=10, scale=4),
            nullable=False,
            comment="Maximum incentive per litre of LCJF: CAD for Cash, LCFS credits for Credit.",
        ),
        sa.Column(
            "description",
            sa.String(length=200),
            nullable=True,
            comment="Band label shown on the form, e.g. 'CI less than or equal to 10 gCO2e/MJ'.",
        ),
        *_audit_columns(),
        _display_order_column(),
        *_effective_date_columns(),
        sa.CheckConstraint(
            "ci_lower_bound IS NULL OR ci_upper_bound IS NULL OR ci_lower_bound < ci_upper_bound",
            name=op.f("ck_lcjfip_incentive_rate_ci_bounds_ordered"),
        ),
        sa.CheckConstraint(
            "max_rate_per_litre > 0",
            name=op.f("ck_lcjfip_incentive_rate_max_rate_positive"),
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_incentive_rate_id", name=op.f("pk_lcjfip_incentive_rate")
        ),
        comment="Maximum LCJFIP incentive per litre by incentive type and carbon intensity band. Lower bound exclusive, upper bound inclusive.",
    )


def _create_application_tables() -> None:
    op.create_table(
        "lcjfip_application",
        _pk(
            "lcjfip_application_id",
            "Unique identifier for the LCJFIP application. Displayed as LCJFIP-<id>.",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Applicant organization (the logged-in BCeID user's organization).",
        ),
        sa.Column(
            "contact_user_profile_id",
            sa.Integer(),
            nullable=False,
            comment="Applicant contact shown on the form and in letters. Defaults to the user who created the application.",
        ),
        sa.Column(
            "certificate_type_id",
            sa.Integer(),
            nullable=True,
            comment="Air operator certificate type held by the applicant.",
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            nullable=False,
            comment="Current workflow status of the application.",
        ),
        sa.Column(
            "application_period_id",
            sa.Integer(),
            nullable=True,
            comment="Intake period the application was submitted into. Set on submission; NULL while Draft.",
        ),
        sa.Column(
            "incentive_option_id",
            sa.Integer(),
            nullable=True,
            comment="Preferred incentive option. Its incentive_type sets the unit of estimated_incentive_amount.",
        ),
        sa.Column(
            "estimated_carbon_intensity",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
            comment="Estimated carbon intensity of the LCJF in gCO2e/MJ. Selects the incentive rate band.",
        ),
        sa.Column(
            "fuel_code_id",
            sa.Integer(),
            nullable=True,
            comment="BC-LCFS fuel code of the LCJF, if known.",
        ),
        sa.Column(
            "requested_incentive_volume",
            sa.BigInteger(),
            nullable=True,
            comment="Total volume of LCJF incentive requested, in litres.",
        ),
        sa.Column(
            "estimated_incentive_amount",
            sa.Numeric(precision=15, scale=2),
            nullable=True,
            comment="Estimated incentive amount requested: CAD for Cash options, LCFS credits for Credit options.",
        ),
        sa.Column(
            "fuel_supplier_organization_id",
            sa.Integer(),
            nullable=True,
            comment="LCFS-registered fuel supplier that receives the incentive. Credits can only be transferred to a registered organization.",
        ),
        sa.Column(
            "fuel_supplier_legal_name",
            sa.String(length=500),
            nullable=True,
            comment="Fuel supplier legal name as entered, only when the supplier is not linked to an LCFS organization.",
        ),
        sa.Column(
            "fuel_supplier_contact_first_name",
            sa.String(length=100),
            nullable=True,
            comment="First name of the fuel supplier contact.",
        ),
        sa.Column(
            "fuel_supplier_contact_last_name",
            sa.String(length=100),
            nullable=True,
            comment="Last name of the fuel supplier contact.",
        ),
        sa.Column(
            "fuel_supplier_contact_email",
            sa.String(length=255),
            nullable=True,
            comment="Email address of the fuel supplier contact.",
        ),
        sa.Column(
            "signed_by_user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="User who accepted the signing authority declarations and submitted the application.",
        ),
        sa.Column(
            "signed_date",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="UTC date and time the declarations were accepted and the application submitted.",
        ),
        *_audit_columns(),
        sa.CheckConstraint(
            "requested_incentive_volume IS NULL OR requested_incentive_volume >= 0",
            name=op.f("ck_lcjfip_application_requested_volume_non_negative"),
        ),
        sa.CheckConstraint(
            "estimated_incentive_amount IS NULL OR estimated_incentive_amount >= 0",
            name=op.f("ck_lcjfip_application_incentive_amount_non_negative"),
        ),
        sa.CheckConstraint(
            "fuel_supplier_organization_id IS NULL OR fuel_supplier_legal_name IS NULL",
            name=op.f("ck_lcjfip_application_fuel_supplier_org_or_name"),
        ),
        sa.CheckConstraint(
            "(signed_by_user_profile_id IS NULL) = (signed_date IS NULL)",
            name=op.f("ck_lcjfip_application_signature_complete"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_lcjfip_application_organization_id_organization"),
        ),
        sa.ForeignKeyConstraint(
            ["contact_user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_lcjfip_application_contact_user_profile_id_user_profile"),
        ),
        sa.ForeignKeyConstraint(
            ["certificate_type_id"],
            ["lcjfip_certificate_type.lcjfip_certificate_type_id"],
            name="fk_lcjfip_application_certificate_type_id",
        ),
        sa.ForeignKeyConstraint(
            ["status_id"],
            ["lcjfip_application_status.lcjfip_application_status_id"],
            name=op.f("fk_lcjfip_application_status_id_lcjfip_application_status"),
        ),
        sa.ForeignKeyConstraint(
            ["application_period_id"],
            ["lcjfip_application_period.lcjfip_application_period_id"],
            name="fk_lcjfip_application_application_period_id",
        ),
        sa.ForeignKeyConstraint(
            ["incentive_option_id"],
            ["lcjfip_incentive_option.lcjfip_incentive_option_id"],
            name="fk_lcjfip_application_incentive_option_id",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_code_id"],
            ["fuel_code.fuel_code_id"],
            name=op.f("fk_lcjfip_application_fuel_code_id_fuel_code"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_supplier_organization_id"],
            ["organization.organization_id"],
            name="fk_lcjfip_application_fuel_supplier_organization_id",
        ),
        sa.ForeignKeyConstraint(
            ["signed_by_user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_lcjfip_application_signed_by_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_id", name=op.f("pk_lcjfip_application")
        ),
        comment="Low Carbon Jet Fuel Incentive Program (LCJFIP) application submitted by an organization: applicant details, preferred incentive, requested incentive and signing authority.",
    )
    for column in ("organization_id", "status_id", "application_period_id"):
        op.create_index(
            op.f(f"ix_lcjfip_application_{column}"),
            "lcjfip_application",
            [column],
            unique=False,
        )

    op.create_table(
        "lcjfip_application_car_type",
        sa.Column(
            "lcjfip_application_id",
            sa.Integer(),
            nullable=False,
            comment="LCJFIP application holding the CAR type.",
        ),
        sa.Column(
            "car_type_id",
            sa.Integer(),
            nullable=False,
            comment="CAR type selected on the application.",
        ),
        sa.ForeignKeyConstraint(
            ["lcjfip_application_id"],
            ["lcjfip_application.lcjfip_application_id"],
            name="fk_lcjfip_application_car_type_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["car_type_id"],
            ["lcjfip_car_type.lcjfip_car_type_id"],
            name=op.f("fk_lcjfip_application_car_type_car_type_id_lcjfip_car_type"),
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_id",
            "car_type_id",
            name=op.f("pk_lcjfip_application_car_type"),
        ),
        comment="CAR operation types selected on an LCJFIP application.",
    )

    op.create_table(
        "lcjfip_purchase_detail",
        _pk(
            "lcjfip_purchase_detail_id",
            "Unique identifier for the purchase detail row.",
        ),
        sa.Column(
            "lcjfip_application_id",
            sa.Integer(),
            nullable=False,
            comment="LCJFIP application the purchase belongs to.",
        ),
        sa.Column(
            "estimated_volume",
            sa.BigInteger(),
            nullable=True,
            comment="Estimated total volume for support, in litres.",
        ),
        sa.Column(
            "anticipated_delivery_date",
            sa.Date(),
            nullable=True,
            comment="Anticipated delivery completion date.",
        ),
        sa.Column(
            "estimated_blend_percentage",
            sa.Numeric(precision=5, scale=2),
            nullable=True,
            comment="Estimated blend ratio: LCJF share of the blended jet fuel, as a percentage from 0 to 100.",
        ),
        sa.Column(
            "assumed_jet_a_price",
            sa.Numeric(precision=10, scale=4),
            nullable=True,
            comment="Jet-A price assumed in the premium estimate, in CAD per litre.",
        ),
        sa.Column(
            "price_premium_from",
            sa.Numeric(precision=10, scale=4),
            nullable=True,
            comment="Low end of the estimated LCJF price premium above Jet-A, in CAD per litre.",
        ),
        sa.Column(
            "price_premium_to",
            sa.Numeric(precision=10, scale=4),
            nullable=True,
            comment="High end of the estimated LCJF price premium above Jet-A, in CAD per litre.",
        ),
        *_audit_columns(),
        sa.CheckConstraint(
            "estimated_volume IS NULL OR estimated_volume >= 0",
            name=op.f("ck_lcjfip_purchase_detail_volume_non_negative"),
        ),
        sa.CheckConstraint(
            "estimated_blend_percentage IS NULL OR (estimated_blend_percentage >= 0 AND estimated_blend_percentage <= 100)",
            name=op.f("ck_lcjfip_purchase_detail_blend_percentage_range"),
        ),
        sa.CheckConstraint(
            "assumed_jet_a_price IS NULL OR assumed_jet_a_price >= 0",
            name=op.f("ck_lcjfip_purchase_detail_jet_a_price_non_negative"),
        ),
        sa.CheckConstraint(
            "(price_premium_from IS NULL OR price_premium_from >= 0) AND (price_premium_to IS NULL OR price_premium_to >= 0)",
            name=op.f("ck_lcjfip_purchase_detail_premium_non_negative"),
        ),
        sa.CheckConstraint(
            "price_premium_from IS NULL OR price_premium_to IS NULL OR price_premium_from <= price_premium_to",
            name=op.f("ck_lcjfip_purchase_detail_premium_range_ordered"),
        ),
        sa.ForeignKeyConstraint(
            ["lcjfip_application_id"],
            ["lcjfip_application.lcjfip_application_id"],
            name="fk_lcjfip_purchase_detail_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_purchase_detail_id", name=op.f("pk_lcjfip_purchase_detail")
        ),
        comment="Low Carbon Jet Fuel purchase details on an LCJFIP application, one row per anticipated purchase.",
    )
    op.create_index(
        op.f("ix_lcjfip_purchase_detail_lcjfip_application_id"),
        "lcjfip_purchase_detail",
        ["lcjfip_application_id"],
        unique=False,
    )

    op.create_table(
        "lcjfip_purchase_detail_feedstock",
        sa.Column(
            "lcjfip_purchase_detail_id",
            sa.Integer(),
            nullable=False,
            comment="Purchase detail row.",
        ),
        sa.Column(
            "feedstock_source_id",
            sa.Integer(),
            nullable=False,
            comment="Anticipated feedstock source of the purchase.",
        ),
        sa.ForeignKeyConstraint(
            ["lcjfip_purchase_detail_id"],
            ["lcjfip_purchase_detail.lcjfip_purchase_detail_id"],
            name="fk_lcjfip_purchase_detail_feedstock_lcjfip_purchase_detail_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["feedstock_source_id"],
            ["lcjfip_feedstock_source.lcjfip_feedstock_source_id"],
            name="fk_lcjfip_purchase_detail_feedstock_feedstock_source_id",
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_purchase_detail_id",
            "feedstock_source_id",
            name=op.f("pk_lcjfip_purchase_detail_feedstock"),
        ),
        comment="Anticipated feedstock sources of an LCJF purchase detail row.",
    )

    op.create_table(
        "lcjfip_application_history",
        _pk(
            "lcjfip_application_history_id",
            "Unique identifier for the history record.",
        ),
        sa.Column(
            "lcjfip_application_id",
            sa.Integer(),
            nullable=False,
            comment="LCJFIP application this history record belongs to.",
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            nullable=False,
            comment="Status the application moved into.",
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="User who made the status change.",
        ),
        sa.Column(
            "application_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Snapshot of the application, its purchase details and the applicant contact at the time of the change.",
        ),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["lcjfip_application_id"],
            ["lcjfip_application.lcjfip_application_id"],
            name="fk_lcjfip_application_history_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["status_id"],
            ["lcjfip_application_status.lcjfip_application_status_id"],
            name="fk_lcjfip_application_history_status_id",
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_lcjfip_application_history_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_history_id",
            name=op.f("pk_lcjfip_application_history"),
        ),
        comment="Status timeline of LCJFIP applications. Each row records a status change, who made it, and a snapshot of the application at that time.",
    )
    op.create_index(
        op.f("ix_lcjfip_application_history_lcjfip_application_id"),
        "lcjfip_application_history",
        ["lcjfip_application_id"],
        unique=False,
    )

    op.create_table(
        "lcjfip_application_internal_comment",
        sa.Column(
            "lcjfip_application_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to lcjfip_application, part of the composite primary key.",
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to internal_comment, part of the composite primary key.",
        ),
        *_timestamp_columns(),
        sa.ForeignKeyConstraint(
            ["lcjfip_application_id"],
            ["lcjfip_application.lcjfip_application_id"],
            name="fk_lcjfip_application_internal_comment_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name="fk_lcjfip_application_internal_comment_internal_comment_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_id",
            "internal_comment_id",
            name=op.f("pk_lcjfip_application_internal_comment"),
        ),
        comment="Associates comments with an LCJFIP application. Comment visibility (Internal or Public) is on internal_comment.",
    )

    op.create_table(
        "lcjfip_application_document_association",
        sa.Column(
            "lcjfip_application_id",
            sa.Integer(),
            nullable=False,
            comment="LCJFIP application the document belongs to.",
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            nullable=False,
            comment="Uploaded or generated document.",
        ),
        sa.ForeignKeyConstraint(
            ["lcjfip_application_id"],
            ["lcjfip_application.lcjfip_application_id"],
            name="fk_lcjfip_application_document_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            name="fk_lcjfip_application_document_document_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "lcjfip_application_id",
            "document_id",
            name=op.f("pk_lcjfip_application_document_association"),
        ),
        comment="Documents attached to an LCJFIP application.",
    )


def _seed_reference_data() -> None:
    bind = op.get_bind()

    for order, (status, description) in enumerate(STATUSES, start=1):
        bind.execute(
            sa.text("""
                INSERT INTO lcjfip_application_status
                    (status, description, display_order, create_user, update_user)
                VALUES (:status, :description, :display_order, 'system', 'system')
                ON CONFLICT (status) DO NOTHING
                """),
            {"status": status, "description": description, "display_order": order},
        )

    for table, names in (
        ("lcjfip_car_type", CAR_TYPES),
        ("lcjfip_certificate_type", CERTIFICATE_TYPES),
        ("lcjfip_feedstock_source", FEEDSTOCK_SOURCES),
    ):
        for order, name in enumerate(names, start=1):
            bind.execute(
                sa.text(f"""
                    INSERT INTO {table}
                        (name, display_order, create_user, update_user)
                    VALUES (:name, :display_order, 'system', 'system')
                    ON CONFLICT (name) DO NOTHING
                    """),
                {"name": name, "display_order": order},
            )

    for order, (name, incentive_type, requires_fuel_supplier) in enumerate(
        INCENTIVE_OPTIONS, start=1
    ):
        bind.execute(
            sa.text("""
                INSERT INTO lcjfip_incentive_option
                    (name, incentive_type, requires_fuel_supplier,
                     display_order, create_user, update_user)
                VALUES
                    (:name, CAST(:incentive_type AS lcjfip_incentive_type_enum),
                     :requires_fuel_supplier, :display_order, 'system', 'system')
                ON CONFLICT (name) DO NOTHING
                """),
            {
                "name": name,
                "incentive_type": incentive_type,
                "requires_fuel_supplier": requires_fuel_supplier,
                "display_order": order,
            },
        )

    for order, (incentive_type, lower, upper, rate, description) in enumerate(
        INCENTIVE_RATES, start=1
    ):
        bind.execute(
            sa.text("""
                INSERT INTO lcjfip_incentive_rate
                    (incentive_type, ci_lower_bound, ci_upper_bound,
                     max_rate_per_litre, description, display_order,
                     create_user, update_user)
                VALUES
                    (CAST(:incentive_type AS lcjfip_incentive_type_enum),
                     :lower, :upper, CAST(:rate AS NUMERIC), :description,
                     :display_order, 'system', 'system')
                """),
            {
                "incentive_type": incentive_type,
                "lower": lower,
                "upper": upper,
                "rate": rate,
                "description": description,
                "display_order": order,
            },
        )

    bind.execute(
        sa.text("""
            INSERT INTO comment_category (display_name, display_order)
            VALUES (:name, :display_order)
            ON CONFLICT (display_name) DO NOTHING
            """),
        {"name": COMMENT_CATEGORY, "display_order": COMMENT_CATEGORY_ORDER},
    )


def _create_reporting_views() -> None:
    create_role_if_not_exists()
    sections = parse_sql_sections(find_and_read_sql_file(sqlFile="metabase.sql"))
    missing = [name for name in VIEW_SECTIONS if name not in sections]
    if missing:
        raise RuntimeError(f"metabase.sql is missing sections: {missing}")
    execute_sql_sections(sections, VIEW_SECTIONS)


def _revoke_reporting_access_to_base_tables() -> None:
    """
    Keep the reporting role on the views only.

    Where the role was created by create_role_if_not_exists (here or in
    manage_views.py), ALTER DEFAULT PRIVILEGES gives it SELECT on every new
    table, which would expose Drafts, contact details and history snapshots.
    The views keep working: they read the base tables with their owner's
    privileges.
    """
    op.execute(f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_roles WHERE rolname = 'basic_lcfs_reporting_role'
            ) THEN
                REVOKE ALL ON TABLE {", ".join(BASE_TABLES)}
                    FROM basic_lcfs_reporting_role;
            END IF;
        END $$;
        """)


def upgrade() -> None:
    _create_lookup_tables()
    _create_application_tables()
    _seed_reference_data()
    _create_reporting_views()
    _revoke_reporting_access_to_base_tables()


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------


def downgrade() -> None:
    for view in reversed(VIEW_NAMES):
        op.execute(f"DROP VIEW IF EXISTS {view}")

    # LCJFIP comments only exist through their application link; remove them
    # with it so they do not linger as unlinked rows in the Comment Log.
    op.execute("""
        DELETE FROM internal_comment
        WHERE internal_comment_id IN (
            SELECT internal_comment_id FROM lcjfip_application_internal_comment
        )
        """)
    op.execute(sa.text("""
            UPDATE internal_comment SET comment_category_id = NULL
            WHERE comment_category_id IN (
                SELECT comment_category_id FROM comment_category
                WHERE display_name = :name
            )
            """).bindparams(name=COMMENT_CATEGORY))
    op.execute(
        sa.text("DELETE FROM comment_category WHERE display_name = :name").bindparams(
            name=COMMENT_CATEGORY
        )
    )

    op.drop_table("lcjfip_application_document_association")
    op.drop_table("lcjfip_application_internal_comment")
    op.drop_index(
        op.f("ix_lcjfip_application_history_lcjfip_application_id"),
        table_name="lcjfip_application_history",
    )
    op.drop_table("lcjfip_application_history")
    op.drop_table("lcjfip_purchase_detail_feedstock")
    op.drop_index(
        op.f("ix_lcjfip_purchase_detail_lcjfip_application_id"),
        table_name="lcjfip_purchase_detail",
    )
    op.drop_table("lcjfip_purchase_detail")
    op.drop_table("lcjfip_application_car_type")
    for column in ("application_period_id", "status_id", "organization_id"):
        op.drop_index(
            op.f(f"ix_lcjfip_application_{column}"),
            table_name="lcjfip_application",
        )
    op.drop_table("lcjfip_application")
    op.drop_table("lcjfip_incentive_rate")
    op.drop_table("lcjfip_incentive_option")
    op.drop_table("lcjfip_feedstock_source")
    op.drop_table("lcjfip_certificate_type")
    op.drop_table("lcjfip_car_type")
    op.drop_table("lcjfip_application_period")
    op.drop_table("lcjfip_application_status")
    INCENTIVE_TYPE_ENUM.drop(op.get_bind(), checkfirst=True)
