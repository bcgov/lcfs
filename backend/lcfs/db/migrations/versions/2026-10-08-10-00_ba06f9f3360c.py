"""Initiative agreements start Underway; record their lifecycle history (#5186).

Agreements entered by government users now start Underway. Draft is kept
for the applications BCeID proponents will start, and IDIR users do not
see drafts. Every agreement-kind Draft that exists today was entered by an
IDIR analyst, so each one moves to Underway here. Otherwise the analysts who
created them would lose sight of them.

Adds initiative_agreement_lifecycle_history, which records each lifecycle
status an agreement enters, beginning with the one it is created in. Each
agreement moved by this migration gets a row with no user, marked with this
migration's name.

Revision ID: ba06f9f3360c
Revises: 5148a6b7c9d0
Create Date: 2026-10-08 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ba06f9f3360c"
down_revision = "5148a6b7c9d0"
branch_labels = None
depends_on = None

MIGRATION_USER = "migration_ba06_ia_draft_to_underway"


def upgrade() -> None:
    op.create_table(
        "initiative_agreement_lifecycle_history",
        sa.Column(
            "initiative_agreement_lifecycle_history_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Unique identifier for the history record",
        ),
        sa.Column(
            "initiative_agreement_id",
            sa.Integer(),
            nullable=False,
            comment="Agreement whose status this records",
        ),
        sa.Column(
            "lifecycle_status_id",
            sa.Integer(),
            nullable=False,
            comment="Lifecycle status the agreement entered",
        ),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="User whose action set the status; null for system changes",
        ),
        sa.Column(
            "display_name",
            sa.String(255),
            nullable=True,
            comment="Name of that user when the status was set",
        ),
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
            ["initiative_agreement_id"],
            ["initiative_agreement.initiative_agreement_id"],
            name=op.f(
                "fk_initiative_agreement_lifecycle_history_initiative_agreement_id"
                "_initiative_agreement"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["lifecycle_status_id"],
            [
                "initiative_agreement_lifecycle_status."
                "initiative_agreement_lifecycle_status_id"
            ],
            name=op.f(
                "fk_initiative_agreement_lifecycle_history_lifecycle_status_id"
                "_initiative_agreement_lifecycle_status"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f(
                "fk_initiative_agreement_lifecycle_history_user_profile_id"
                "_user_profile"
            ),
        ),
        comment=(
            "Append-only history of the lifecycle statuses an initiative "
            "agreement has entered, beginning with its initial status."
        ),
    )
    op.create_index(
        op.f("ix_initiative_agreement_lifecycle_history_initiative_agreement_id"),
        "initiative_agreement_lifecycle_history",
        ["initiative_agreement_id"],
    )

    # Row-level audit trigger for the new table (function added by migration
    # e8f1d2c3b4a5; it is idempotent across all public tables).
    op.execute("SELECT ensure_audit_triggers();")

    # Analyst-entered drafts become Underway, and the move is recorded.
    # update_date is left alone: this corrects data, it is not user activity.
    op.execute(
        f"""
        WITH moved AS (
            UPDATE initiative_agreement AS ia
            SET lifecycle_status_id = underway.initiative_agreement_lifecycle_status_id,
                update_user = '{MIGRATION_USER}'
            FROM initiative_agreement_lifecycle_status AS draft,
                 initiative_agreement_lifecycle_status AS underway
            WHERE ia.record_kind = 'agreement'
              AND draft.status = 'Draft'
              AND underway.status = 'Underway'
              AND ia.lifecycle_status_id = draft.initiative_agreement_lifecycle_status_id
            RETURNING ia.initiative_agreement_id, ia.lifecycle_status_id
        )
        INSERT INTO initiative_agreement_lifecycle_history
            (initiative_agreement_id, lifecycle_status_id, create_user, update_user)
        SELECT initiative_agreement_id, lifecycle_status_id,
               '{MIGRATION_USER}', '{MIGRATION_USER}'
        FROM moved;
        """
    )


def downgrade() -> None:
    # Return the agreements this migration moved to Draft, unless they have
    # since moved on from Underway.
    op.execute(
        f"""
        UPDATE initiative_agreement AS ia
        SET lifecycle_status_id = draft.initiative_agreement_lifecycle_status_id
        FROM initiative_agreement_lifecycle_history AS history,
             initiative_agreement_lifecycle_status AS draft,
             initiative_agreement_lifecycle_status AS underway
        WHERE history.initiative_agreement_id = ia.initiative_agreement_id
          AND history.create_user = '{MIGRATION_USER}'
          AND draft.status = 'Draft'
          AND underway.status = 'Underway'
          AND ia.lifecycle_status_id = underway.initiative_agreement_lifecycle_status_id;
        """
    )
    op.drop_index(
        op.f("ix_initiative_agreement_lifecycle_history_initiative_agreement_id"),
        table_name="initiative_agreement_lifecycle_history",
    )
    op.drop_table("initiative_agreement_lifecycle_history")
