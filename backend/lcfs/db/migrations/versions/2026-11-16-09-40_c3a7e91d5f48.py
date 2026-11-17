"""Add initiative_agreement_note.

Revision ID: c3a7e91d5f48
Revises: 9e0e5741b48f
Create Date: 2026-11-16 09:40:00
"""

import sqlalchemy as sa
from alembic import op

revision = "c3a7e91d5f48"
down_revision = "9e0e5741b48f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "initiative_agreement_note",
        sa.Column(
            "initiative_agreement_note_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the initiative agreement note",
        ),
        sa.Column(
            "initiative_agreement_id",
            sa.Integer(),
            nullable=False,
            comment="Initiative agreement the note belongs to",
        ),
        sa.Column(
            "note_number",
            sa.Numeric(8, 2),
            nullable=False,
            comment=(
                "User-controlled number, unique within the agreement; also the "
                "display order"
            ),
        ),
        sa.Column(
            "note_text",
            sa.Text(),
            nullable=False,
            comment="Sanitized rich-text (HTML) body of the note",
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
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("initiative_agreement_note_id"),
        sa.UniqueConstraint(
            "initiative_agreement_id",
            "note_number",
            name="uq_initiative_agreement_note_number",
        ),
        comment="Numbered rich-text notes recorded against an initiative agreement.",
    )


def downgrade() -> None:
    op.drop_table("initiative_agreement_note")
