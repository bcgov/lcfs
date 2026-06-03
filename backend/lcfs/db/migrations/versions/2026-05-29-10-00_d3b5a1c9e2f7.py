"""Add comment_category lookup table and denormalized metadata for Comment Log.

Introduces:
- ``comment_category`` lookup (seeded)
- Denormalized columns on ``internal_comment`` for fast org-scoped queries.
- ``compliance_report_group_uuid`` on ``compliance_report_internal_comment``.
- Composite + GIN + date indexes backing Comment Log queries.

Backfill in follow-up migration; nullable here to unblock concurrent deploys.

Revision ID: d3b5a1c9e2f7
Revises: c2a4f6b8d9e1
Create Date: 2026-05-29 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "d3b5a1c9e2f7"
down_revision = "c2a4f6b8d9e1"
branch_labels = None
depends_on = None


CATEGORY_SEED = (
    ("Compliance notes", 10),
    ("Transfer notes", 20),
    ("IA notes", 30),
    ("Penalty notes", 40),
    ("CI application notes", 50),
)

COMPOSITE_INDEX_NAME = "idx_internal_comment_org_year_cat_vis"
GIN_INDEX_NAME = "idx_internal_comment_search_vector"
CREATE_DATE_INDEX_NAME = "idx_internal_comment_create_date"
GROUP_UUID_INDEX_NAME = "idx_cr_internal_comment_group_uuid"


def upgrade() -> None:
    # --- comment_category lookup table ---------------------------------
    op.create_table(
        "comment_category",
        sa.Column(
            "comment_category_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Primary key.",
        ),
        sa.Column(
            "display_name",
            sa.String(length=100),
            nullable=False,
            comment="Display label for Comment Log UI.",
        ),
        sa.Column(
            "display_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Display sort order.",
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
        sa.UniqueConstraint("display_name", name="uq_comment_category_display_name"),
        comment="Lookup table for Comment Log categories.",
    )

    # Seed categories (idempotent per unique display_name constraint).
    op.bulk_insert(
        sa.table(
            "comment_category",
            sa.column("display_name", sa.String),
            sa.column("display_order", sa.Integer),
        ),
        [
            {"display_name": name, "display_order": order}
            for name, order in CATEGORY_SEED
        ],
    )

    # --- internal_comment new columns ----------------------------------
    op.add_column(
        "internal_comment",
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=True,
            comment="Denormalized org for fast org-scoped queries.",
        ),
    )
    op.create_foreign_key(
        "fk_internal_comment_organization_id",
        source_table="internal_comment",
        referent_table="organization",
        local_cols=["organization_id"],
        remote_cols=["organization_id"],
    )

    op.add_column(
        "internal_comment",
        sa.Column(
            "compliance_year",
            sa.Integer(),
            nullable=True,
            comment="Denormalized compliance year from source entity.",
        ),
    )

    op.add_column(
        "internal_comment",
        sa.Column(
            "comment_category_id",
            sa.Integer(),
            nullable=True,
            comment="FK to comment_category.",
        ),
    )
    op.create_foreign_key(
        "fk_internal_comment_comment_category_id",
        source_table="internal_comment",
        referent_table="comment_category",
        local_cols=["comment_category_id"],
        remote_cols=["comment_category_id"],
    )

    op.add_column(
        "internal_comment",
        sa.Column(
            "comment_search_text",
            sa.Text(),
            nullable=True,
            comment="Sanitized plain text for full-text search.",
        ),
    )

    op.add_column(
        "internal_comment",
        sa.Column(
            "comment_search_vector",
            postgresql.TSVECTOR(),
            nullable=True,
            comment="tsvector for PostgreSQL full-text search.",
        ),
    )

    # --- compliance_report_internal_comment new column -----------------
    op.add_column(
        "compliance_report_internal_comment",
        sa.Column(
            "compliance_report_group_uuid",
            sa.String(length=36),
            nullable=True,
            comment="Denormalized for grouping comments across report versions.",
        ),
    )
    op.create_index(
        GROUP_UUID_INDEX_NAME,
        "compliance_report_internal_comment",
        ["compliance_report_group_uuid"],
    )

    # --- Supporting indexes for the Comment Log read view --------------
    # Composite index with DESC create_date serves filter + ordering.
    op.create_index(
        COMPOSITE_INDEX_NAME,
        "internal_comment",
        [
            "organization_id",
            "compliance_year",
            "comment_category_id",
            "visibility",
            sa.text("create_date DESC"),
        ],
    )
    op.create_index(
        GIN_INDEX_NAME,
        "internal_comment",
        ["comment_search_vector"],
        postgresql_using="gin",
    )
    op.create_index(
        CREATE_DATE_INDEX_NAME,
        "internal_comment",
        ["create_date"],
    )


def downgrade() -> None:
    op.drop_index(CREATE_DATE_INDEX_NAME, table_name="internal_comment")
    op.drop_index(GIN_INDEX_NAME, table_name="internal_comment")
    op.drop_index(COMPOSITE_INDEX_NAME, table_name="internal_comment")

    op.drop_index(
        GROUP_UUID_INDEX_NAME,
        table_name="compliance_report_internal_comment",
    )
    op.drop_column("compliance_report_internal_comment", "compliance_report_group_uuid")

    op.drop_constraint(
        "fk_internal_comment_comment_category_id",
        "internal_comment",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_internal_comment_organization_id",
        "internal_comment",
        type_="foreignkey",
    )
    op.drop_column("internal_comment", "comment_search_vector")
    op.drop_column("internal_comment", "comment_search_text")
    op.drop_column("internal_comment", "comment_category_id")
    op.drop_column("internal_comment", "compliance_year")
    op.drop_column("internal_comment", "organization_id")

    op.drop_table("comment_category")
