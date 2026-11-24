"""Add initiative agreement notes and designated action links.

Revision ID: d009f44301a9
Revises: b7a04f59fdf3
Create Date: 2026-11-24 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "d009f44301a9"
down_revision = "b7a04f59fdf3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_designated_action_id_agreement_group",
        "designated_action",
        [
            "designated_action_id",
            "initiative_agreement_id",
            "group_uuid",
        ],
    )
    op.create_table(
        "initiative_agreement_note",
        sa.Column(
            "initiative_agreement_note_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
        ),
        sa.Column("initiative_agreement_id", sa.Integer(), nullable=False),
        sa.Column(
            "note_number",
            sa.Numeric(),
            nullable=False,
            comment="Numeric note number, unique within its initiative agreement",
        ),
        sa.Column(
            "note_text",
            sa.Text(),
            nullable=False,
            comment="Rich-text note content stored as Quill-compatible HTML",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("create_user", sa.String(), nullable=True),
        sa.Column("update_user", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["initiative_agreement_id"],
            ["initiative_agreement.initiative_agreement_id"],
            name=op.f(
                "fk_initiative_agreement_note_initiative_agreement_id_"
                "initiative_agreement"
            ),
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "initiative_agreement_note_id",
            "initiative_agreement_id",
            name="uq_ia_note_id_agreement_id",
        ),
        sa.UniqueConstraint(
            "initiative_agreement_id",
            "note_number",
            name="uq_ia_note_agreement_number",
        ),
        comment=(
            "Staff notes associated with initiative agreements and "
            "designated action version groups."
        ),
    )
    op.create_index(
        op.f("ix_initiative_agreement_note_initiative_agreement_id"),
        "initiative_agreement_note",
        ["initiative_agreement_id"],
    )
    op.create_table(
        "initiative_agreement_note_designated_action",
        sa.Column("initiative_agreement_note_id", sa.Integer(), nullable=False),
        sa.Column("initiative_agreement_id", sa.Integer(), nullable=False),
        sa.Column("designated_action_id", sa.Integer(), nullable=False),
        sa.Column("designated_action_group_uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["initiative_agreement_note_id", "initiative_agreement_id"],
            [
                "initiative_agreement_note.initiative_agreement_note_id",
                "initiative_agreement_note.initiative_agreement_id",
            ],
            name="fk_ia_note_da_note_agreement",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            [
                "designated_action_id",
                "initiative_agreement_id",
                "designated_action_group_uuid",
            ],
            [
                "designated_action.designated_action_id",
                "designated_action.initiative_agreement_id",
                "designated_action.group_uuid",
            ],
            name="fk_ia_note_da_action_agreement_group",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "initiative_agreement_note_id",
            "designated_action_id",
            name="pk_ia_note_designated_action",
        ),
        sa.UniqueConstraint(
            "initiative_agreement_note_id",
            "designated_action_group_uuid",
            name="uq_ia_note_da_note_group",
        ),
        comment=(
            "Associates notes with designated action version groups "
            "belonging to the same initiative agreement."
        ),
    )
    op.create_index(
        "ix_ia_note_da_agreement_group",
        "initiative_agreement_note_designated_action",
        ["initiative_agreement_id", "designated_action_group_uuid"],
    )
    op.create_index(
        "ix_ia_note_da_designated_action_id",
        "initiative_agreement_note_designated_action",
        ["designated_action_id"],
    )
    op.execute("SELECT ensure_audit_triggers();")


def downgrade() -> None:
    op.drop_index(
        "ix_ia_note_da_designated_action_id",
        table_name="initiative_agreement_note_designated_action",
    )
    op.drop_index(
        "ix_ia_note_da_agreement_group",
        table_name="initiative_agreement_note_designated_action",
    )
    op.drop_table("initiative_agreement_note_designated_action")
    op.drop_index(
        op.f("ix_initiative_agreement_note_initiative_agreement_id"),
        table_name="initiative_agreement_note",
    )
    op.drop_table("initiative_agreement_note")
    op.drop_constraint(
        "uq_designated_action_id_agreement_group",
        "designated_action",
        type_="unique",
    )
