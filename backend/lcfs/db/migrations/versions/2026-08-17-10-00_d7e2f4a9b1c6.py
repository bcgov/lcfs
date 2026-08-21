"""Add Initiative Agreements module data model.

Phase 1 (additive) of the Initiative Agreements module (#4804 #4805 #4846
#4806). The legacy credit-award flow is untouched: its columns, its statuses,
``transaction_status_view`` and the transaction materialized views all keep
working until the transaction-flow cutover.

  - initiative_agreement_lifecycle_status  — NEW lookup for agreement
        lifecycle (Draft | Underway | Completed | Terminated). Deliberately
        separate from initiative_agreement_status: that table is surfaced by
        transaction_status_view (an unfiltered SELECT DISTINCT over the status
        tables) and validated against TransactionStatusEnum, so a lifecycle
        value there breaks GET /api/transactions/statuses/ for every caller.
  - initiative_agreement  — agreement-management columns (code, type, title,
        description, contacts, dates, credit totals), plus record_kind to
        discriminate agreements from the pre-existing one-row-per-award
        records, and a nullable lifecycle_status_id.
  - designated_action (+ _status, + _history) — Schedule B actions with
        change-order versioning, analyst assignment, recommended credits and
        an append-only event log.
  - evidence_requirement  — per-action requirements, amended by is_active.
  - evidence_submission (+ _status) — append-only evidence packages.
  - designated_action_internal_comment — internal comment association.

Revision ID: d7e2f4a9b1c6
Revises: b6c7d8e9f0a1
Create Date: 2026-08-17 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "d7e2f4a9b1c6"
down_revision = "b6c7d8e9f0a1"
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
            # The mixin's Python-side default does not apply to raw SQL
            # inserts, and the consolidation migration writes raw SQL.
            server_default=sa.text("gen_random_uuid()::text"),
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


def _lookup_table(table_name, pk_name, status_example, table_comment):
    """Create a status lookup table in the house shape (cf. ci_application_status)."""
    op.create_table(
        table_name,
        sa.Column(
            pk_name,
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment=f"Unique identifier for the {table_name.replace('_', ' ')}",
        ),
        sa.Column(
            "status",
            sa.String(100),
            nullable=False,
            comment=f"Status value (e.g. {status_example})",
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
        comment=table_comment,
    )


def upgrade() -> None:
    # ------------------------------------------------------------------
    # initiative_agreement_lifecycle_status (lookup)
    #
    # NOT added to initiative_agreement_status: every row of that table is
    # surfaced by transaction_status_view and validated against
    # TransactionStatusEnum.
    # ------------------------------------------------------------------
    _lookup_table(
        "initiative_agreement_lifecycle_status",
        "initiative_agreement_lifecycle_status_id",
        "Draft, Underway, Completed, Terminated",
        (
            "Lookup for initiative agreement lifecycle statuses. Separate "
            "from initiative_agreement_status, which feeds "
            "transaction_status_view and the transaction materialized views."
        ),
    )

    op.execute(
        """
        INSERT INTO initiative_agreement_lifecycle_status
            (status, description, display_order, create_user, update_user)
        VALUES
            ('Draft',      'Agreement is being prepared and is not yet in effect',      10, 'system', 'system'),
            ('Underway',   'Agreement is in effect and designated actions are running', 20, 'system', 'system'),
            ('Completed',  'All designated actions are concluded',                      30, 'system', 'system'),
            ('Terminated', 'Agreement was ended before completion',                     40, 'system', 'system')
        """
    )

    # ------------------------------------------------------------------
    # initiative_agreement: agreement management columns (#4804)
    # ------------------------------------------------------------------
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
            sa.String(100),
            nullable=False,
            server_default=sa.text("'Initiative Agreement'"),
            comment=(
                "Kind of agreement: 'Initiative Agreement' or migrated legacy "
                "'P3A'. Validated at the API layer."
            ),
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "record_kind",
            sa.String(50),
            nullable=False,
            server_default=sa.text("'legacy_award'"),
            comment=(
                "'agreement' for agreement-management records, 'legacy_award' "
                "for the pre-existing one-row-per-credit-award records that "
                "share this table until the transaction-flow cutover. "
                "Agreement grids and APIs filter on 'agreement'."
            ),
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "lifecycle_status_id",
            sa.Integer(),
            nullable=True,
            comment=(
                "Agreement lifecycle status. Nullable: legacy award records "
                "have no lifecycle."
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
                "Denormalized cache of the agreement's total allocation; "
                "reconciles against sum(designated_action.credit_allocation) "
                "where actions exist. Never read for balance calculations."
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
                "Denormalized cache of sum(transaction.compliance_units) over "
                "this agreement's designated actions; reconciled by test, "
                "never read for balance. transaction.compliance_units is the "
                "only authority for issued credits."
            ),
        ),
    )
    op.create_foreign_key(
        op.f(
            "fk_initiative_agreement_lifecycle_status_id"
            "_initiative_agreement_lifecycle_status"
        ),
        "initiative_agreement",
        "initiative_agreement_lifecycle_status",
        ["lifecycle_status_id"],
        ["initiative_agreement_lifecycle_status_id"],
    )
    op.create_unique_constraint(
        op.f("uq_initiative_agreement_ia_code"), "initiative_agreement", ["ia_code"]
    )
    op.create_index(
        op.f("ix_initiative_agreement_current_status_id"),
        "initiative_agreement",
        ["current_status_id"],
    )
    op.create_index(
        op.f("ix_initiative_agreement_record_kind"),
        "initiative_agreement",
        ["record_kind"],
    )
    op.create_index(
        op.f("ix_initiative_agreement_lifecycle_status_id"),
        "initiative_agreement",
        ["lifecycle_status_id"],
    )
    # One agreement may claim a given ledger transaction at most once. The
    # pre-existing index on this column is a plain btree.
    op.create_index(
        "uq_initiative_agreement_transaction_id",
        "initiative_agreement",
        ["transaction_id"],
        unique=True,
        postgresql_where=sa.text("transaction_id IS NOT NULL"),
    )
    op.create_table_comment(
        "initiative_agreement",
        (
            "Initiative agreements (s.15 Low Carbon Fuels Act): parent record "
            "for designated actions and evidence tracking. Also holds legacy "
            "credit-award records until the transaction-flow cutover; see "
            "record_kind."
        ),
        existing_comment=(
            "Goverment to organization compliance units initiative agreement"
        ),
    )

    # The four pre-existing award statuses have a NULL display_order, so any
    # ORDER BY display_order sorts them last.
    op.execute(
        """
        UPDATE initiative_agreement_status SET display_order = v.display_order
        FROM (VALUES
            ('Draft', 10), ('Recommended', 20), ('Approved', 30), ('Deleted', 40)
        ) AS v(status, display_order)
        WHERE initiative_agreement_status.status::text = v.status
          AND initiative_agreement_status.display_order IS NULL
        """
    )

    # ------------------------------------------------------------------
    # designated_action_status (lookup)
    # ------------------------------------------------------------------
    _lookup_table(
        "designated_action_status",
        "designated_action_status_id",
        "Not started, Underway, Approved",
        "Lookup table for designated action workflow statuses",
    )

    op.execute(
        """
        INSERT INTO designated_action_status
            (status, description, display_order, create_user, update_user)
        VALUES
            ('Not started',             'No evidence has been submitted for this action',       10,  'system', 'system'),
            ('Submission received',     'Evidence received; awaiting analyst review',           20,  'system', 'system'),
            ('Underway',                'Analyst review of the evidence is in progress',        30,  'system', 'system'),
            ('Information requested',   'Additional information has been requested',            40,  'system', 'system'),
            ('Recommended to manager',  'Analyst has recommended credits to the IA manager',    50,  'system', 'system'),
            ('Recommended to director', 'Manager has endorsed the recommendation',              60,  'system', 'system'),
            ('Approved',                'Director approved the action and credits were issued', 70,  'system', 'system'),
            ('Issued (legacy)',         'Credits were issued before this system existed',       75,  'system', 'system'),
            ('Returned',                'Returned to the previous reviewer for rework',         80,  'system', 'system'),
            ('Rejected',                'Rejected; no credits will be issued',                  90,  'system', 'system'),
            ('Cancelled',               'Designated action was cancelled',                      100, 'system', 'system')
        """
    )

    # ------------------------------------------------------------------
    # evidence_submission_status (lookup)
    # ------------------------------------------------------------------
    _lookup_table(
        "evidence_submission_status",
        "evidence_submission_status_id",
        "Submitted, Under review, Accepted, Rejected",
        "Lookup table for evidence submission review statuses",
    )

    op.execute(
        """
        INSERT INTO evidence_submission_status
            (status, description, display_order, create_user, update_user)
        VALUES
            ('Submitted',    'Evidence has been submitted by the proponent', 10, 'system', 'system'),
            ('Under review', 'Evidence is being reviewed by an analyst',     20, 'system', 'system'),
            ('Accepted',     'Evidence has been accepted',                   30, 'system', 'system'),
            ('Rejected',     'Evidence has been rejected',                   40, 'system', 'system')
        """
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
            "recommended_credits",
            sa.BigInteger(),
            nullable=True,
            comment=(
                "Compliance units the analyst recommends issuing for this "
                "action. NULL until a recommendation is made — 0 is itself a "
                "meaningful recommendation. Bounded by credit_allocation at "
                "the API layer."
            ),
        ),
        sa.Column(
            "current_status_id",
            sa.Integer(),
            nullable=False,
            comment="Current workflow status",
        ),
        sa.Column(
            "determination",
            sa.String(100),
            nullable=True,
            comment=(
                "Determination result (e.g. Compliant, Non-Compliant, "
                "Waived); validated at the API layer"
            ),
        ),
        sa.Column(
            "assigned_analyst_id",
            sa.Integer(),
            nullable=True,
            comment="IDIR analyst assigned to this designated action",
        ),
        sa.Column(
            "transaction_id",
            sa.Integer(),
            nullable=True,
            comment=(
                "Ledger transaction created when credits were issued for this "
                "action; set by consolidation of legacy award records and by "
                "future issuance on director approval"
            ),
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
        sa.ForeignKeyConstraint(
            ["transaction_id"],
            ["transaction.transaction_id"],
            name=op.f("fk_designated_action_transaction_id"),
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
        op.f("ix_designated_action_transaction_id"),
        "designated_action",
        ["transaction_id"],
    )
    op.create_index(
        "ix_designated_action_group_uuid", "designated_action", ["group_uuid"]
    )
    # Guards a concurrent double-issuance where two approvals both observe
    # transaction_id IS NULL.
    op.create_index(
        "uq_designated_action_transaction_id",
        "designated_action",
        ["transaction_id"],
        unique=True,
        postgresql_where=sa.text("transaction_id IS NOT NULL"),
    )

    # ------------------------------------------------------------------
    # designated_action_history (#4896 change log, #4898 audit history)
    # ------------------------------------------------------------------
    op.create_table(
        "designated_action_history",
        sa.Column(
            "designated_action_history_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the history record",
        ),
        sa.Column(
            "designated_action_id",
            sa.Integer(),
            nullable=False,
            comment="Designated action this event belongs to",
        ),
        sa.Column(
            "designated_action_group_uuid",
            sa.String(36),
            nullable=True,
            comment=(
                "Denormalized designated_action.group_uuid so history survives "
                "change-order version rows. Populated by the writer."
            ),
        ),
        sa.Column(
            "event",
            sa.String(100),
            nullable=False,
            comment=(
                "What happened, e.g. STATUS_CHANGE, ANALYST_ASSIGNED, "
                "CREDITS_RECOMMENDED, CREDITS_ISSUED"
            ),
        ),
        sa.Column(
            "status_id",
            sa.Integer(),
            nullable=True,
            comment=(
                "Status the action moved into, for STATUS_CHANGE events. "
                "Nullable so non-status events need no status."
            ),
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="User who caused the event; NULL for system events",
        ),
        sa.Column(
            "display_name",
            sa.String(255),
            nullable=True,
            comment="Denormalized actor name for display",
        ),
        sa.Column(
            "snapshot",
            JSONB(),
            nullable=True,
            comment="Event-specific payload (e.g. credits recommended, reason)",
        ),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["designated_action_id"],
            ["designated_action.designated_action_id"],
            name=op.f("fk_designated_action_history_designated_action_id"),
        ),
        sa.ForeignKeyConstraint(
            ["status_id"],
            ["designated_action_status.designated_action_status_id"],
            name=op.f("fk_designated_action_history_status_id"),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_designated_action_history_user_profile_id"),
        ),
        comment=(
            "Append-only history of designated action events: status changes, "
            "analyst assignment, recommendations, reviews, change orders and "
            "credit issuance."
        ),
    )
    op.create_index(
        op.f("ix_designated_action_history_designated_action_id"),
        "designated_action_history",
        ["designated_action_id"],
    )
    op.create_index(
        "ix_designated_action_history_group_uuid",
        "designated_action_history",
        ["designated_action_group_uuid"],
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
                "retained. Also the amendment mechanism — a change order "
                "deactivates the old requirement and inserts a replacement."
            ),
        ),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            ["designated_action_id"],
            ["designated_action.designated_action_id"],
            name=op.f("fk_evidence_requirement_designated_action_id"),
        ),
        comment=(
            "Evidence requirements a proponent must satisfy for a designated " "action."
        ),
    )
    op.create_index(
        op.f("ix_evidence_requirement_designated_action_id"),
        "evidence_requirement",
        ["designated_action_id"],
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
    # Row-level audit triggers for every new table (function added by
    # migration e8f1d2c3b4a5; it is idempotent across all public tables).
    # ------------------------------------------------------------------
    op.execute("SELECT ensure_audit_triggers();")


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

    op.drop_index(
        op.f("ix_evidence_requirement_designated_action_id"),
        table_name="evidence_requirement",
    )
    op.drop_table("evidence_requirement")

    op.drop_index(
        "ix_designated_action_history_group_uuid",
        table_name="designated_action_history",
    )
    op.drop_index(
        op.f("ix_designated_action_history_designated_action_id"),
        table_name="designated_action_history",
    )
    op.drop_table("designated_action_history")

    op.drop_index("uq_designated_action_transaction_id", table_name="designated_action")
    op.drop_index("ix_designated_action_group_uuid", table_name="designated_action")
    op.drop_index(
        op.f("ix_designated_action_transaction_id"), table_name="designated_action"
    )
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

    op.drop_table("evidence_submission_status")
    op.drop_table("designated_action_status")

    op.execute(
        """
        UPDATE initiative_agreement_status SET display_order = NULL
        WHERE status::text IN ('Draft', 'Recommended', 'Approved', 'Deleted')
        """
    )

    op.create_table_comment(
        "initiative_agreement",
        "Goverment to organization compliance units initiative agreement",
        existing_comment=(
            "Initiative agreements (s.15 Low Carbon Fuels Act): parent record "
            "for designated actions and evidence tracking. Also holds legacy "
            "credit-award records until the transaction-flow cutover; see "
            "record_kind."
        ),
    )
    op.drop_index(
        "uq_initiative_agreement_transaction_id", table_name="initiative_agreement"
    )
    op.drop_index(
        op.f("ix_initiative_agreement_lifecycle_status_id"),
        table_name="initiative_agreement",
    )
    op.drop_index(
        op.f("ix_initiative_agreement_record_kind"),
        table_name="initiative_agreement",
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
    op.drop_constraint(
        op.f(
            "fk_initiative_agreement_lifecycle_status_id"
            "_initiative_agreement_lifecycle_status"
        ),
        "initiative_agreement",
        type_="foreignkey",
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
        "lifecycle_status_id",
        "record_kind",
        "agreement_type",
        "ia_code",
    ):
        op.drop_column("initiative_agreement", column_name)

    op.drop_table("initiative_agreement_lifecycle_status")
