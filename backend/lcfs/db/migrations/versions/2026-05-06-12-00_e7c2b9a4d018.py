"""Add document_category to ci_application_document_association.

Step 3 of the CI application workflow uploads documents in three buckets:
``technical_report`` (mandatory), ``ghgenius_model`` (mandatory), and
``supporting`` (optional). The category is stored on the join table so a
single Document row stays uncategorised globally and only carries
meaning in the context of a specific CI application.

Revision ID: e7c2b9a4d018
Revises: e5f6a7b8c9d0
Create Date: 2026-05-06 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "e7c2b9a4d018"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ci_application_document_association",
        sa.Column(
            "document_category",
            sa.String(50),
            nullable=False,
            server_default="supporting",
            comment=(
                "Category of the upload in the context of the parent CI "
                "application: 'technical_report', 'ghgenius_model', or "
                "'supporting'."
            ),
        ),
    )
    # Drop the server default so subsequent inserts must specify a value
    # explicitly. The default only exists to backfill any pre-existing rows.
    op.alter_column(
        "ci_application_document_association",
        "document_category",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("ci_application_document_association", "document_category")
