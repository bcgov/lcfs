"""Add designated action document association.

Documents attach to designated actions (#4840): the wireframe's evidence
files and per-action award letters live on the action, not the agreement.
The table mirrors initiative_agreement_document_association; the document
folder work (#4925) builds on it.

Revision ID: b8c3d5e7f9a1
Revises: d7e2f4a9b1c6
Create Date: 2026-08-24 12:00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b8c3d5e7f9a1"
down_revision = "d7e2f4a9b1c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "designated_action_document_association",
        sa.Column("designated_action_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["designated_action_id"],
            ["designated_action.designated_action_id"],
            name=op.f(
                "fk_designated_action_document_association_designated_action_id_designated_action"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            name=op.f("fk_designated_action_document_association_document_id_document"),
        ),
        sa.PrimaryKeyConstraint(
            "designated_action_id",
            "document_id",
            name=op.f("pk_designated_action_document_association"),
        ),
        comment=(
            "Associates documents with designated actions; documents attach "
            "to a concrete action row and follow the group across change "
            "orders in queries."
        ),
    )


def downgrade() -> None:
    op.drop_table("designated_action_document_association")
