"""Change order drafts for initiative agreement packages (#5555).

Adds the "Change order draft" lifecycle status, the change order table,
and one version table per versioned record type (agreement details,
notes, designated actions, evidence requirements). Live rows keep their
ids and hold the accepted values. A change order's edits wait in the
version tables until the Director accepts them.

Records a change order adds are live rows marked with
``pending_change_order_id`` until acceptance, so they can carry children
(an EOC on a new designated action) without being visible to the
organization. Notes gain ``is_active`` so a note a change order removes
keeps its versions. Note-number uniqueness moves to active notes only.

No backfill: versions are written only when a change order touches a
record.

Revision ID: fce153b2e467
Revises: f29bf127e5a5
Create Date: 2026-11-24 15:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "fce153b2e467"
down_revision = "f29bf127e5a5"
branch_labels = None
depends_on = None

CHANGE_ORDER_DRAFT = "Change order draft"
CHANGE_ORDER_FK = (
    "initiative_agreement_change_order.initiative_agreement_change_order_id"
)

action_type_enum = postgresql.ENUM(
    "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
)


def _audit_columns():
    return [
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment=(
                "Date and time (UTC) when the physical record was created in "
                "the database."
            ),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment=(
                "Date and time (UTC) when the physical record was updated in "
                "the database. It will be the same as the create_date until "
                "the record is first updated after creation."
            ),
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


def _version_columns():
    return [
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            comment=(
                "Version number of the record: 0 is the record before its "
                "first change order, each change order that touches it adds one"
            ),
        ),
        sa.Column(
            "action_type",
            action_type_enum,
            nullable=False,
            comment="CREATE, UPDATE or DELETE: what this version did to the record",
        ),
        sa.Column(
            "change_order_id",
            sa.Integer(),
            nullable=True,
            comment=(
                "Change order that produced this version; NULL for the record "
                "as it stood before its first change order"
            ),
        ),
    ]


def _create_version_table(
    table, pk, record_column, record_fk, record_ondelete, fields, comment
):
    op.create_table(
        table,
        sa.Column(
            pk,
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the version",
        ),
        sa.Column(
            record_column,
            sa.Integer(),
            nullable=False,
            comment="Record this is a version of",
        ),
        *fields,
        *_version_columns(),
        *_audit_columns(),
        sa.ForeignKeyConstraint(
            [record_column],
            [record_fk],
            name=op.f(f"fk_{table}_{record_column}_{record_fk.split('.')[0]}"),
            ondelete=record_ondelete,
        ),
        sa.ForeignKeyConstraint(
            ["change_order_id"],
            [CHANGE_ORDER_FK],
            name=op.f(f"fk_{table}_change_order_id_initiative_agreement_change_order"),
        ),
        sa.PrimaryKeyConstraint(pk, name=op.f(f"pk_{table}")),
        sa.UniqueConstraint(record_column, "version", name=f"uq_{table}_version"),
        sa.UniqueConstraint(
            record_column, "change_order_id", name=f"uq_{table}_change_order"
        ),
        comment=comment,
    )
    op.create_index(op.f(f"ix_{table}_{record_column}"), table, [record_column])
    op.create_index(op.f(f"ix_{table}_change_order_id"), table, ["change_order_id"])


def _add_pending_column(table, noun):
    op.add_column(
        table,
        sa.Column(
            "pending_change_order_id",
            sa.Integer(),
            nullable=True,
            comment=(
                f"Change order that added this {noun}, while it is not part of "
                f"the accepted package. NULL for every accepted {noun}; "
                "acceptance clears it (#5555)."
            ),
        ),
    )
    op.create_foreign_key(
        op.f(f"fk_{table}_pending_change_order_id_initiative_agreement_change_order"),
        table,
        "initiative_agreement_change_order",
        ["pending_change_order_id"],
        ["initiative_agreement_change_order_id"],
    )
    op.create_index(
        op.f(f"ix_{table}_pending_change_order_id"),
        table,
        ["pending_change_order_id"],
    )


def _drop_pending_column(table):
    op.drop_index(op.f(f"ix_{table}_pending_change_order_id"), table_name=table)
    op.drop_constraint(
        op.f(f"fk_{table}_pending_change_order_id_initiative_agreement_change_order"),
        table,
        type_="foreignkey",
    )
    op.drop_column(table, "pending_change_order_id")


# The tables this migration creates; each gets the audit trigger.
AUDITED_TABLES = (
    "initiative_agreement_change_order",
    "initiative_agreement_version",
    "initiative_agreement_note_version",
    "designated_action_version",
    "evidence_requirement_version",
)


def _add_audit_triggers():
    """Audit this migration's tables only. ensure_audit_triggers() would also
    attach the trigger to every other table without one, including
    scheduled_job_lease, whose text key the audit trigger cannot handle: the
    maintenance jobs' lease writes would then fail."""
    for table in AUDITED_TABLES:
        trigger = f"audit_{table}_insert_update_delete"[:63]
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_proc
                    WHERE proname = 'audit_trigger_func'
                      AND pronamespace = 'public'::regnamespace
                ) THEN
                    CREATE TRIGGER {trigger}
                        AFTER INSERT OR UPDATE OR DELETE ON {table}
                        FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
                END IF;
            END $$;
            """)


def upgrade() -> None:
    op.execute(f"""
        INSERT INTO initiative_agreement_lifecycle_status
            (status, description, display_order, create_user, update_user)
        SELECT '{CHANGE_ORDER_DRAFT}',
               'Changes to an underway agreement are being prepared; the '
               'organization sees the accepted agreement until the Director '
               'accepts them',
               25, 'system', 'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM initiative_agreement_lifecycle_status
            WHERE status = '{CHANGE_ORDER_DRAFT}'
        )
        """)

    op.create_table(
        "initiative_agreement_change_order",
        sa.Column(
            "initiative_agreement_change_order_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the change order",
        ),
        sa.Column(
            "initiative_agreement_id",
            sa.Integer(),
            nullable=False,
            comment="Agreement the change order amends",
        ),
        sa.Column(
            "change_order_number",
            sa.Integer(),
            nullable=False,
            comment="Sequence number of the change order within its agreement",
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="Draft",
            nullable=False,
            comment="Draft, Accepted or Discarded",
        ),
        sa.Column(
            "origin",
            sa.String(length=20),
            server_default="IDIR",
            nullable=False,
            comment="Who prepared the change order: IDIR (government) or BCeID",
        ),
        sa.Column(
            "started_by_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who started the change order",
        ),
        sa.Column(
            "started_by_display_name",
            sa.String(length=255),
            nullable=True,
            comment="Name of that user when it was started",
        ),
        sa.Column(
            "accepted_date",
            sa.Date(),
            nullable=True,
            comment=(
                "Effective date of the change order, entered by the Director. "
                "Can differ from accepted_at, the day it was recorded."
            ),
        ),
        sa.Column(
            "accepted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="System date and time the acceptance was recorded",
        ),
        sa.Column(
            "accepted_by_user_id",
            sa.Integer(),
            nullable=True,
            comment="Director who accepted the change order",
        ),
        sa.Column(
            "accepted_by_display_name",
            sa.String(length=255),
            nullable=True,
            comment="Name of that Director when it was accepted",
        ),
        sa.Column(
            "discarded_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="System date and time the change order was discarded",
        ),
        sa.Column(
            "discarded_by_user_id",
            sa.Integer(),
            nullable=True,
            comment="User who discarded the change order",
        ),
        sa.Column(
            "discarded_by_display_name",
            sa.String(length=255),
            nullable=True,
            comment="Name of that user when it was discarded",
        ),
        *_audit_columns(),
        sa.CheckConstraint(
            "status IN ('Draft', 'Accepted', 'Discarded')",
            name=op.f("ck_initiative_agreement_change_order_status"),
        ),
        sa.CheckConstraint(
            "origin IN ('IDIR', 'BCeID')",
            name=op.f("ck_initiative_agreement_change_order_origin"),
        ),
        sa.CheckConstraint(
            "status <> 'Accepted' OR (accepted_date IS NOT NULL "
            "AND accepted_at IS NOT NULL)",
            name=op.f("ck_initiative_agreement_change_order_accepted_fields"),
        ),
        sa.ForeignKeyConstraint(
            ["initiative_agreement_id"],
            ["initiative_agreement.initiative_agreement_id"],
            name=op.f(
                "fk_initiative_agreement_change_order_initiative_agreement_id_"
                "initiative_agreement"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["started_by_user_id"],
            ["user_profile.user_profile_id"],
            name=op.f(
                "fk_initiative_agreement_change_order_started_by_user_id_user_profile"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["accepted_by_user_id"],
            ["user_profile.user_profile_id"],
            name=op.f(
                "fk_initiative_agreement_change_order_accepted_by_user_id_user_profile"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["discarded_by_user_id"],
            ["user_profile.user_profile_id"],
            name=op.f(
                "fk_initiative_agreement_change_order_discarded_by_user_id_"
                "user_profile"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "initiative_agreement_change_order_id",
            name=op.f("pk_initiative_agreement_change_order"),
        ),
        sa.UniqueConstraint(
            "initiative_agreement_id",
            "change_order_number",
            name="uq_initiative_agreement_change_order_number",
        ),
        comment=(
            "Change orders against initiative agreement packages: who started "
            "each one, and the Director's acceptance with its effective date."
        ),
    )
    op.create_index(
        op.f("ix_initiative_agreement_change_order_initiative_agreement_id"),
        "initiative_agreement_change_order",
        ["initiative_agreement_id"],
    )
    op.create_index(
        "uq_initiative_agreement_change_order_one_draft",
        "initiative_agreement_change_order",
        ["initiative_agreement_id"],
        unique=True,
        postgresql_where=sa.text("status = 'Draft'"),
    )

    _create_version_table(
        "initiative_agreement_version",
        "initiative_agreement_version_id",
        "initiative_agreement_id",
        "initiative_agreement.initiative_agreement_id",
        None,
        [
            sa.Column("ia_code", sa.String(length=50), comment="Agreement code"),
            sa.Column(
                "agreement_type", sa.String(length=100), comment="Kind of agreement"
            ),
            sa.Column("title", sa.String(length=500), comment="Project title"),
            sa.Column("project_description", sa.Text(), comment="Project summary"),
            sa.Column("project_location", sa.Text(), comment="Project location"),
            sa.Column("contact_name", sa.String(length=500), comment="Contact name"),
            sa.Column("contact_email", sa.String(length=255), comment="Contact email"),
            sa.Column("contact_phone", sa.String(length=50), comment="Contact phone"),
            sa.Column("agreement_start_date", sa.Date(), comment="Start date"),
            sa.Column("agreement_end_date", sa.Date(), comment="End date"),
        ],
        (
            "Versions of an initiative agreement's details, written only when "
            "a change order changes them (#5555)."
        ),
    )
    _create_version_table(
        "initiative_agreement_note_version",
        "initiative_agreement_note_version_id",
        "initiative_agreement_note_id",
        "initiative_agreement_note.initiative_agreement_note_id",
        "CASCADE",
        [
            sa.Column(
                "note_number",
                sa.Numeric(8, 2),
                nullable=False,
                comment="Note number",
            ),
            sa.Column(
                "note_text",
                sa.Text(),
                nullable=False,
                comment="Sanitized rich-text body",
            ),
        ],
        (
            "Versions of an initiative agreement note, written only when a "
            "change order changes it (#5555)."
        ),
    )
    _create_version_table(
        "designated_action_version",
        "designated_action_version_id",
        "designated_action_id",
        "designated_action.designated_action_id",
        None,
        [
            sa.Column(
                "name",
                sa.String(length=500),
                nullable=False,
                comment="Designated action name",
            ),
            sa.Column("description", sa.Text(), comment="Description"),
            sa.Column("specified_date", sa.Date(), comment="Date for completion"),
            sa.Column(
                "credit_allocation",
                sa.BigInteger(),
                nullable=False,
                comment="Compliance units to be issued",
            ),
        ],
        (
            "Versions of a designated action's terms, written only when a "
            "change order changes them (#5555). Workflow state is not versioned."
        ),
    )
    _create_version_table(
        "evidence_requirement_version",
        "evidence_requirement_version_id",
        "evidence_requirement_id",
        "evidence_requirement.evidence_requirement_id",
        None,
        [
            sa.Column(
                "requirement_number",
                sa.Integer(),
                nullable=False,
                comment="Requirement number",
            ),
            sa.Column("title", sa.String(length=500), comment="Requirement title"),
            sa.Column(
                "description",
                sa.Text(),
                nullable=False,
                comment="Requirement description",
            ),
            sa.Column("evidence_type", sa.String(length=100), comment="Evidence type"),
        ],
        (
            "Versions of an evidence requirement's definition, written only "
            "when a change order changes it (#5555). The analyst's review is "
            "not versioned."
        ),
    )

    _add_pending_column("designated_action", "designated action")
    _add_pending_column("evidence_requirement", "evidence requirement")
    _add_pending_column("initiative_agreement_note", "note")

    op.add_column(
        "initiative_agreement_note",
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
            comment=(
                "False once a change order has removed the note; its versions "
                "are kept (#5555)"
            ),
        ),
    )
    op.drop_constraint(
        "uq_initiative_agreement_note_number",
        "initiative_agreement_note",
        type_="unique",
    )
    op.create_index(
        "uq_initiative_agreement_note_number_active",
        "initiative_agreement_note",
        ["initiative_agreement_id", "note_number"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )
    op.alter_column(
        "initiative_agreement_note",
        "note_number",
        comment=(
            "User-controlled number, unique within the agreement's active "
            "notes; also the display order"
        ),
        existing_type=sa.Numeric(8, 2),
        existing_nullable=False,
    )

    _add_audit_triggers()


def downgrade() -> None:
    # Removed notes would collide with active ones once the number is unique
    # across every note again; nothing a change order removed survives the
    # downgrade.
    op.execute("DELETE FROM initiative_agreement_note WHERE NOT is_active")
    op.drop_index(
        "uq_initiative_agreement_note_number_active",
        table_name="initiative_agreement_note",
    )
    op.create_unique_constraint(
        "uq_initiative_agreement_note_number",
        "initiative_agreement_note",
        ["initiative_agreement_id", "note_number"],
    )
    op.alter_column(
        "initiative_agreement_note",
        "note_number",
        comment=(
            "User-controlled number, unique within the agreement; also the "
            "display order"
        ),
        existing_type=sa.Numeric(8, 2),
        existing_nullable=False,
    )
    op.drop_column("initiative_agreement_note", "is_active")

    # Records an unaccepted change order added are not part of any accepted
    # package. Notes have no dependants and go. Actions and requirements may
    # carry history, comments or documents, so they are retired with the
    # soft deletes the earlier schema already understands.
    op.execute(
        "DELETE FROM initiative_agreement_note "
        "WHERE pending_change_order_id IS NOT NULL"
    )
    op.execute(
        "UPDATE evidence_requirement SET is_active = false "
        "WHERE pending_change_order_id IS NOT NULL"
    )
    op.execute(
        "UPDATE designated_action SET action_type = 'DELETE' "
        "WHERE pending_change_order_id IS NOT NULL"
    )
    _drop_pending_column("initiative_agreement_note")
    _drop_pending_column("evidence_requirement")
    _drop_pending_column("designated_action")

    for table in (
        "evidence_requirement_version",
        "designated_action_version",
        "initiative_agreement_note_version",
        "initiative_agreement_version",
    ):
        op.drop_table(table)

    # An agreement left in a change order draft returns to Underway.
    op.execute(f"""
        UPDATE initiative_agreement
        SET lifecycle_status_id = (
            SELECT initiative_agreement_lifecycle_status_id
            FROM initiative_agreement_lifecycle_status
            WHERE status = 'Underway'
        )
        WHERE lifecycle_status_id = (
            SELECT initiative_agreement_lifecycle_status_id
            FROM initiative_agreement_lifecycle_status
            WHERE status = '{CHANGE_ORDER_DRAFT}'
        )
        """)
    op.execute(f"""
        DELETE FROM initiative_agreement_lifecycle_history
        WHERE lifecycle_status_id = (
            SELECT initiative_agreement_lifecycle_status_id
            FROM initiative_agreement_lifecycle_status
            WHERE status = '{CHANGE_ORDER_DRAFT}'
        )
        """)
    op.drop_index(
        "uq_initiative_agreement_change_order_one_draft",
        table_name="initiative_agreement_change_order",
    )
    op.drop_table("initiative_agreement_change_order")
    op.execute(
        f"DELETE FROM initiative_agreement_lifecycle_status "
        f"WHERE status = '{CHANGE_ORDER_DRAFT}'"
    )
