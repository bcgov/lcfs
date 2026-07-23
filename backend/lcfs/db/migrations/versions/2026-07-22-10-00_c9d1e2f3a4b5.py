"""Company Overview comments: org-scoped internal comments (#4608).

- Adds the ``organization_internal_comment`` association table linking
  ``internal_comment`` rows to an ``organization`` (mirrors the other
  ``*_internal_comment`` association tables).
- Seeds a ``Company Overview`` ``comment_category`` (display_order 60) so the
  dashboard Company Overview thread flows into the org Comment Log and is
  filterable/searchable by category.
- Hard-drops the legacy free-form ``organization.company_*`` columns that the
  old Company Overview subtab used (business confirmed they are unused).

Revision ID: c9d1e2f3a4b5
Revises: e7f8a9b0c1d2
Create Date: 2026-07-22 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "c9d1e2f3a4b5"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


COMPANY_OVERVIEW_CATEGORY = "Company Overview"
COMPANY_OVERVIEW_ORDER = 60

# Legacy free-form columns removed from ``organization`` (name -> comment) so
# the downgrade can restore them faithfully.
LEGACY_COMPANY_COLUMNS = (
    ("company_details", "Free-form text field for company details"),
    (
        "company_representation_agreements",
        "Free-form text field for company representation agreements or "
        "affiliated organizations",
    ),
    (
        "company_acting_as_aggregator",
        "Free-form text field for acting as an aggregator information",
    ),
    ("company_additional_notes", "Free-form text field for additional company notes"),
)


def upgrade() -> None:
    # 1. Association table -------------------------------------------------
    op.create_table(
        "organization_internal_comment",
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment=(
                "Foreign key to organization, part of the composite "
                "primary key."
            ),
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment=(
                "Foreign key to internal_comment, part of the composite "
                "primary key."
            ),
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment=(
                "Date and time (UTC) when the physical record was created "
                "in the database."
            ),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            comment=(
                "Date and time (UTC) when the physical record was updated "
                "in the database."
            ),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_organization_internal_comment_organization_id"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["internal_comment_id"],
            ["internal_comment.internal_comment_id"],
            name=op.f("fk_organization_internal_comment_internal_comment_id"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "organization_id",
            "internal_comment_id",
            name=op.f("pk_organization_internal_comment"),
        ),
        comment=(
            "Associates internal comments with an organization "
            "(e.g. Company Overview notes on the org dashboard)."
        ),
    )
    op.create_index(
        "idx_organization_internal_comment_org_id",
        "organization_internal_comment",
        ["organization_id"],
        unique=False,
    )

    # 2. Seed the Company Overview comment category (idempotent) -----------
    op.execute(
        sa.text(
            """
            INSERT INTO comment_category (display_name, display_order)
            VALUES (:name, :order)
            ON CONFLICT (display_name) DO NOTHING
            """
        ).bindparams(name=COMPANY_OVERVIEW_CATEGORY, order=COMPANY_OVERVIEW_ORDER)
    )

    # 3. Drop the legacy free-form company_* columns ----------------------
    for column_name, _comment in LEGACY_COMPANY_COLUMNS:
        op.drop_column("organization", column_name)


def downgrade() -> None:
    # 3. Restore the legacy columns ---------------------------------------
    for column_name, comment in LEGACY_COMPANY_COLUMNS:
        op.add_column(
            "organization",
            sa.Column(
                column_name,
                sa.String(),
                nullable=True,
                comment=comment,
            ),
        )

    # 2. Remove the seeded category ---------------------------------------
    op.execute(
        sa.text(
            "DELETE FROM comment_category WHERE display_name = :name"
        ).bindparams(name=COMPANY_OVERVIEW_CATEGORY)
    )

    # 1. Drop the association table ----------------------------------------
    op.drop_index(
        "idx_organization_internal_comment_org_id",
        table_name="organization_internal_comment",
    )
    op.drop_table("organization_internal_comment")
