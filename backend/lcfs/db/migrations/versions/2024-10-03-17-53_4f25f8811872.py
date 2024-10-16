"""Add documents

Revision ID: 4f25f8811872
Revises: 4038ff8d8c49
Create Date: 2024-10-03 17:53:22.626658

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4f25f8811872"
down_revision = "4038ff8d8c49"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "document",
        sa.Column(
            "document_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the document",
        ),
        sa.Column("file_key", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=False),
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
        sa.PrimaryKeyConstraint("document_id", name=op.f("pk_document")),
        sa.UniqueConstraint("document_id", name=op.f("uq_document_document_id")),
        comment="Main document table for storing base document information",
    )
    op.create_table(
        "compliance_report_document_association",
        sa.Column("compliance_report_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f(
                "fk_compliance_report_document_association_compliance_report_id_compliance_report"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["document.document_id"],
            name=op.f("fk_compliance_report_document_association_document_id_document"),
        ),
        sa.PrimaryKeyConstraint(
            "compliance_report_id",
            "document_id",
            name=op.f("pk_compliance_report_document_association"),
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###

    op.drop_table("compliance_report_document_association")
    op.drop_table("document")
    # ### end Alembic commands ###
