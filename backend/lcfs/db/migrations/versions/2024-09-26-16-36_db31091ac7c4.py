"""add_documents_to_compliance

Revision ID: db31091ac7c4
Revises: 4038ff8d8c49
Create Date: 2024-09-26 16:36:14.839928

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "db31091ac7c4"
down_revision = "4038ff8d8c49"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
        sa.Column("compliance_report_id", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["compliance_report_id"],
            ["compliance_report.compliance_report_id"],
            name=op.f("fk_document_compliance_report_id_compliance_report"),
        ),
        sa.PrimaryKeyConstraint("document_id", name=op.f("pk_document")),
        sa.UniqueConstraint("document_id", name=op.f("uq_document_document_id")),
        comment="Main document table for storing base document information",
    )


def downgrade() -> None:
    op.drop_table("document")
