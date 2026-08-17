"""Extend initiative agreement and add designated action / evidence tables.

Phase 1 (additive) of the Initiative Agreements module (#4804 #4805 #4846
#4806). The legacy credit-award flow is untouched: existing columns, statuses
and materialized views keep working until the transaction-flow cutover.

  - initiative_agreement            — new agreement-management columns (code,
                                      type, title, contacts, dates, credit
                                      totals); award-era columns unchanged
  - initiative_agreement_type_enum  — adds Underway | Completed | Terminated
  - designated_action (+ _status)   — Schedule B actions with change-order
                                      versioning (group_uuid/version)
  - evidence_requirement            — per-action requirements incl. analyst
                                      review, active/inactive soft delete
  - evidence_submission (+ _status) — append-only evidence packages per action
  - designated_action_internal_comment — internal comment association

Revision ID: d7e2f4a9b1c6
Revises: f9a0b1c2d3e5
Create Date: 2026-08-17 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

# revision identifiers, used by Alembic.
revision = "d7e2f4a9b1c6"
down_revision = "f9a0b1c2d3e5"
branch_labels = None
depends_on = None


def _timestamp_columns():
    """Fresh create/update timestamp columns (mirrors the BaseModel mixin)."""
    return [
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment=(
                "Date and time (UTC) when the physical record was created in "
                "the database."
            ),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment=(
                "Date and time (UTC) when the physical record was updated in "
                "the database. It will be the same as the create_date until "
                "the record is first updated after creation."
            ),
        ),
    ]


def _audit_columns():
    """Fresh audit columns (mirrors the BaseModel + Auditable mixins)."""
    return [
        *_timestamp_columns(),
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


def _versioning_columns():
    """Fresh versioning columns (mirrors the Versioning mixin)."""
    return [
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
            PgEnum(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            nullable=False,
            server_default=sa.text("'CREATE'"),
            comment="Action type for this record",
        ),
    ]


def upgrade() -> None:
    # ------------------------------------------------------------------
    # initiative_agreement_status: add agreement-management statuses to
    # the existing enum (values cannot be added inside a transaction)
    # ------------------------------------------------------------------
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE initiative_agreement_type_enum ADD VALUE IF NOT EXISTS 'Underway'"
        )
        op.execute(
            "ALTER TYPE initiative_agreement_type_enum ADD VALUE IF NOT EXISTS 'Completed'"
        )
        op.execute(
            "ALTER TYPE initiative_agreement_type_enum ADD VALUE IF NOT EXISTS 'Terminated'"
        )

    # ------------------------------------------------------------------
    # initiative_agreement: agreement management columns (#4804)
    # ------------------------------------------------------------------
    sa.Enum("Initiative Agreement", "P3A", name="agreement_type_enum").create(
        op.get_bind()
    )

    op.add_column(
        "initiative_agreement",
        sa.Column(
            "ia_code",
            sa.String(50),
            nullable=True,
            comment=(
                "Agreement code, e.g. IA-25AZU1; unique when set. Backfilled "
                "for migrated legacy records at cutover."
            ),
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "agreement_type",
            PgEnum(
                "Initiative Agreement",
                "P3A",
                name="agreement_type_enum",
                create_type=False,
            ),
            nullable=False,
            server_default=sa.text("'Initiative Agreement'"),
            comment=(
                "Kind of agreement: current Initiative Agreement or migrated "
                "legacy P3A."
            ),
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "title",
            sa.String(500),
            nullable=True,
            comment="Project title of the agreement",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "project_description",
            sa.Text(),
            nullable=True,
            comment="Agreement brief / project summary",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "contact_name",
            sa.String(500),
            nullable=True,
            comment="Agreement contact person name",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "contact_email",
            sa.String(255),
            nullable=True,
            comment="Agreement contact email",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "contact_phone",
            sa.String(50),
            nullable=True,
            comment="Agreement contact phone",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "entry_date",
            sa.Date(),
            nullable=True,
            comment="Date the agreement was entered into the tracker",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "agreement_start_date",
            sa.Date(),
            nullable=True,
            comment="Agreement start date",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "agreement_end_date",
            sa.Date(),
            nullable=True,
            comment="Agreement end date",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "total_credits_allocated",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
            comment=(
                "Total compliance units allocated under the agreement. "
                "Authoritative value, not derived from designated actions "
                "(legacy agreements may lack an action breakdown)."
            ),
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "total_credits_issued",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
            comment=(
                "Total compliance units issued to date under the agreement. "
                "Authoritative value, not derived."
            ),
        ),
    )
    op.create_unique_constraint(
        op.f("uq_initiative_agreement_ia_code"), "initiative_agreement", ["ia_code"]
    )
    op.create_index(
        op.f("ix_initiative_agreement_current_status_id"),
        "initiative_agreement",
        ["current_status_id"],
    )
    op.create_table_comment(
        "initiative_agreement",
        (
            "Initiative agreements (s.15 Low Carbon Fuels Act): parent record "
            "for designated actions and evidence tracking. Also holds legacy "
            "credit-award fields until the transaction-flow cutover."
        ),
        existing_comment=(
            "Goverment to organization compliance units initiative agreement"
        ),
    )

    # ------------------------------------------------------------------
    # designated_action_status  (lookup)
    # ------------------------------------------------------------------
    op.create_table(
        "designated_action_status",
        sa.Column(
            "designated_action_status_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the designated action status",
        ),
        sa.Column(
            "status",
            sa.String(100),
            nullable=False,
            comment="Status value (e.g. Not started, In progress, Complete)",
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
        *_audit_columns(),
        comment="Lookup table for designated action completion statuses",
    )

    # ------------------------------------------------------------------
    # evidence_submission_status  (lookup)
    # ------------------------------------------------------------------
    op.create_table(
        "evidence_submission_status",
        sa.Column(
            "evidence_submission_status_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the evidence submission status",
        ),
        sa.Column(
            "status",
            sa.String(100),
            nullable=False,
            comment=("Status value (e.g. Submitted, Under review, Accepted, Rejected)"),
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
        *_audit_columns(),
        comment="Lookup table for evidence submission review statuses",
    )

    # ------------------------------------------------------------------
    # designated_action (#4805)
    # ------------------------------------------------------------------
    op.create_table(
        "designated_action",
        sa.Column(
            "designated_action_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the designated action",
        ),
        sa.Column(
            "initiative_agreement_id",
            sa.Integer(),
            nullable=False,
            comment="Parent initiative agreement",
        ),
        sa.Column(
            "action_number",
            sa.Integer(),
            nullable=False,
            comment=(
                "Action number within the agreement; displayed as "
                "DA{n}-IA{agreement id}"
            ),
        ),
        sa.Column(
            "name",
            sa.String(500),
            nullable=False,
            comment="Designated action name/title",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Detailed description of the designated action",
        ),
        sa.Column(
            "specified_date",
            sa.Date(),
            nullable=True,
            comment="Specified completion date from Schedule B",
        ),
        sa.Column(
            "completed_date",
            sa.Date(),
            nullable=True,
            comment="Actual completion date",
        ),
        sa.Column(
            "determination_date",
            sa.Date(),
            nullable=True,
            comment="Date the determination was made",
        ),
        sa.Column(
            "credit_allocation",
            sa.BigInteger(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Compliance units allocated to this action ('up to' amount)",
        ),
        sa.Column(
            "current_status_id",
            sa.Integer(),
            nullable=False,
            comment="Current completion status",
        ),
        sa.Column(
            "determination",
            sa.String(100),
            nullable=True,
            comment=(
                "Determination result (e.g. Compliant, Non-Compliant, Waived); "
                "validated at the API layer"
            ),
        ),
        sa.Column(
            "assigned_analyst_id",
            sa.Integer(),
            nullable=True,
            comment="IDIR analyst assigned to this designated action",
        ),
        *_versioning_columns(),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["initiative_agreement_id"],
            ["initiative_agreement.initiative_agreement_id"],
            name=op.f("fk_designated_action_initiative_agreement_id"),
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["designated_action_status.designated_action_status_id"],
            name=op.f("fk_designated_action_current_status_id"),
        ),
        sa.ForeignKeyConstraint(
            ["assigned_analyst_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_designated_action_assigned_analyst_id_user_profile"),
        ),
        sa.UniqueConstraint(
            "initiative_agreement_id",
            "action_number",
            "version",
            name="uq_designated_action_agreement_number_version",
        ),
        comment=(
            "Designated actions defined in Schedule B of an initiative "
            "agreement: milestones with credit allocations, completion and "
            "determination tracking."
        ),
    )
    op.create_index(
        op.f("ix_designated_action_initiative_agreement_id"),
        "designated_action",
        ["initiative_agreement_id"],
    )
    op.create_index(
        op.f("ix_designated_action_current_status_id"),
        "designated_action",
        ["current_status_id"],
    )
    op.create_index(
        op.f("ix_designated_action_assigned_analyst_id"),
        "designated_action",
        ["assigned_analyst_id"],
    )
    op.create_index(
        "ix_designated_action_group_uuid", "designated_action", ["group_uuid"]
    )

    # ------------------------------------------------------------------
    # evidence_requirement (#4846)
    # ------------------------------------------------------------------
    op.create_table(
        "evidence_requirement",
        sa.Column(
            "evidence_requirement_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the evidence requirement",
        ),
        sa.Column(
            "designated_action_id",
            sa.Integer(),
            nullable=False,
            comment="Parent designated action",
        ),
        sa.Column(
            "requirement_number",
            sa.Integer(),
            nullable=False,
            comment="Business number of the requirement; also the display order",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
            comment="Description of the evidence requirement",
        ),
        sa.Column(
            "analyst_review",
            sa.Text(),
            nullable=True,
            comment="Long-form analyst review findings for this requirement",
        ),
        sa.Column(
            "evidence_type",
            sa.String(100),
            nullable=True,
            comment=("Type of evidence expected (vocabulary defined by the business)"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment=(
                "Soft-delete flag: inactive requirements are hidden but "
                "retained. This is the business deactivation flag; Versioning "
                "action_type records change-order lineage only."
            ),
        ),
        *_versioning_columns(),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["designated_action_id"],
            ["designated_action.designated_action_id"],
            name=op.f("fk_evidence_requirement_designated_action_id"),
        ),
        comment=(
            "Evidence requirements a proponent must satisfy for a designated "
            "action, including analyst review findings."
        ),
    )
    op.create_index(
        op.f("ix_evidence_requirement_designated_action_id"),
        "evidence_requirement",
        ["designated_action_id"],
    )
    op.create_index(
        "ix_evidence_requirement_group_uuid", "evidence_requirement", ["group_uuid"]
    )

    # ------------------------------------------------------------------
    # evidence_submission (#4806)
    # ------------------------------------------------------------------
    op.create_table(
        "evidence_submission",
        sa.Column(
            "evidence_submission_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the evidence submission",
        ),
        sa.Column(
            "designated_action_id",
            sa.Integer(),
            nullable=False,
            comment="Designated action the evidence was submitted against",
        ),
        sa.Column(
            "submission_date",
            sa.Date(),
            nullable=True,
            comment="Date the evidence was submitted",
        ),
        sa.Column(
            "current_status_id",
            sa.Integer(),
            nullable=False,
            comment="Current review status of the submission",
        ),
        sa.Column(
            "submission_method",
            sa.String(100),
            nullable=True,
            comment="How the evidence was submitted (e.g. email, portal)",
        ),
        sa.Column(
            "cover_letter_received",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment=("Whether a signed cover letter was received with the submission"),
        ),
        sa.Column(
            "comments",
            sa.Text(),
            nullable=True,
            comment="Comments recorded against the submission",
        ),
        sa.Column(
            "submitted_by_user_id",
            sa.Integer(),
            nullable=True,
            comment="Submitting user when submitted through the application",
        ),
        sa.Column(
            "submitted_by",
            sa.String(500),
            nullable=True,
            comment=(
                "Display name of the submitter when not a system user "
                "(legacy/email submissions)"
            ),
        ),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["designated_action_id"],
            ["designated_action.designated_action_id"],
            name=op.f("fk_evidence_submission_designated_action_id"),
        ),
        sa.ForeignKeyConstraint(
            ["current_status_id"],
            ["evidence_submission_status.evidence_submission_status_id"],
            name=op.f("fk_evidence_submission_current_status_id"),
        ),
        sa.ForeignKeyConstraint(
            ["submitted_by_user_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_evidence_submission_submitted_by_user_id_user_profile"),
        ),
        comment=(
            "Evidence packages submitted by proponents in support of a "
            "designated action; append-only submission history."
        ),
    )
    op.create_index(
        op.f("ix_evidence_submission_designated_action_id"),
        "evidence_submission",
        ["designated_action_id"],
    )
    op.create_index(
        op.f("ix_evidence_submission_current_status_id"),
        "evidence_submission",
        ["current_status_id"],
    )

    # ------------------------------------------------------------------
    # designated_action_internal_comment (association)
    # ------------------------------------------------------------------
    op.create_table(
        "designated_action_internal_comment",
        sa.Column(
            "designated_action_id",
            sa.Integer(),
            primary_key=True,
            comment=(
                "Foreign key to designated_action, part of the composite "
                "primary key."
            ),
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            primary_key=True,
            comment=(
                "Foreign key to internal_comment, part of the composite " "primary key."
            ),
        ),
        sa.Column(
            "designated_action_group_uuid",
            sa.String(36),
            nullable=True,
            comment=(
                "Denormalized designated_action.group_uuid so comments stay "
                "grouped across change-order versions."
            ),
        ),
        *_timestamp_columns(),
        sa.ForeignKeyConstraint(
            ["designated_action_id"],
            ["designated_action.designated_action_id"],
            name=op.f("fk_designated_action_internal_comment_designated_action_id"),
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f("fk_designated_action_internal_comment_internal_comment_id"),
        ),
        comment="Associates internal comments with a designated action.",
    )
    op.create_index(
        "idx_designated_action_internal_comment_group_uuid",
        "designated_action_internal_comment",
        ["designated_action_group_uuid"],
    )

    # ------------------------------------------------------------------
    # Seed lookup data
    # ------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO initiative_agreement_status
            (status, display_order, create_user, update_user)
        VALUES
            ('Underway',   5, 'system', 'system'),
            ('Completed',  6, 'system', 'system'),
            ('Terminated', 7, 'system', 'system')
        """
    )

    op.execute(
        """
        INSERT INTO designated_action_status
            (status, description, display_order, create_user, update_user)
        VALUES
            ('Not started', 'Work on the designated action has not begun',   1, 'system', 'system'),
            ('In progress', 'The designated action is underway',             2, 'system', 'system'),
            ('Complete',    'The designated action has been completed',      3, 'system', 'system')
        """
    )

    op.execute(
        """
        INSERT INTO evidence_submission_status
            (status, description, display_order, create_user, update_user)
        VALUES
            ('Submitted',    'Evidence has been submitted by the proponent',  1, 'system', 'system'),
            ('Under review', 'Evidence is being reviewed by an analyst',      2, 'system', 'system'),
            ('Accepted',     'Evidence has been accepted',                    3, 'system', 'system'),
            ('Rejected',     'Evidence has been rejected',                    4, 'system', 'system')
        """
    )


def downgrade() -> None:
    op.drop_index(
        "idx_designated_action_internal_comment_group_uuid",
        table_name="designated_action_internal_comment",
    )
    op.drop_table("designated_action_internal_comment")

    op.drop_index(
        op.f("ix_evidence_submission_current_status_id"),
        table_name="evidence_submission",
    )
    op.drop_index(
        op.f("ix_evidence_submission_designated_action_id"),
        table_name="evidence_submission",
    )
    op.drop_table("evidence_submission")
    op.drop_table("evidence_submission_status")

    op.drop_index(
        "ix_evidence_requirement_group_uuid", table_name="evidence_requirement"
    )
    op.drop_index(
        op.f("ix_evidence_requirement_designated_action_id"),
        table_name="evidence_requirement",
    )
    op.drop_table("evidence_requirement")

    op.drop_index("ix_designated_action_group_uuid", table_name="designated_action")
    op.drop_index(
        op.f("ix_designated_action_assigned_analyst_id"),
        table_name="designated_action",
    )
    op.drop_index(
        op.f("ix_designated_action_current_status_id"),
        table_name="designated_action",
    )
    op.drop_index(
        op.f("ix_designated_action_initiative_agreement_id"),
        table_name="designated_action",
    )
    op.drop_table("designated_action")
    op.drop_table("designated_action_status")

    op.execute(
        "DELETE FROM initiative_agreement_status "
        "WHERE status IN ('Underway', 'Completed', 'Terminated')"
    )

    op.create_table_comment(
        "initiative_agreement",
        "Goverment to organization compliance units initiative agreement",
        existing_comment=(
            "Initiative agreements (s.15 Low Carbon Fuels Act): parent record "
            "for designated actions and evidence tracking. Also holds legacy "
            "credit-award fields until the transaction-flow cutover."
        ),
    )
    op.drop_index(
        op.f("ix_initiative_agreement_current_status_id"),
        table_name="initiative_agreement",
    )
    op.drop_constraint(
        op.f("uq_initiative_agreement_ia_code"),
        "initiative_agreement",
        type_="unique",
    )
    for column_name in (
        "total_credits_issued",
        "total_credits_allocated",
        "agreement_end_date",
        "agreement_start_date",
        "entry_date",
        "contact_phone",
        "contact_email",
        "contact_name",
        "project_description",
        "title",
        "agreement_type",
        "ia_code",
    ):
        op.drop_column("initiative_agreement", column_name)

    sa.Enum(name="agreement_type_enum").drop(op.get_bind())

    # PostgreSQL cannot remove enum values in place: 'Underway', 'Completed'
    # and 'Terminated' remain on initiative_agreement_type_enum.
