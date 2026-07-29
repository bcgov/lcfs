"""Company Overview comments: org-scoped internal comments (#4608).

- Adds the ``organization_internal_comment`` association table linking
  ``internal_comment`` rows to an ``organization`` (mirrors the other
  ``*_internal_comment`` association tables).
- Seeds a ``Company Overview`` ``comment_category`` (display_order 60) so the
  dashboard Company Overview thread flows into the org Comment Log and is
  filterable/searchable by category.
- Preserves any populated legacy ``organization.company_*`` values before
  removal: each organization with data gets (a) a row in the
  ``organization_company_overview_backup`` table (verbatim snapshot) and
  (b) a migrated "Company Overview" internal comment carrying the same
  content into the new framework. Only then are the legacy columns dropped.

Revision ID: c9d1e2f3a4b5
Revises: e7f8a9b0c1d2
Create Date: 2026-07-22 10:00:00.000000
"""

import html as html_lib

import sqlalchemy as sa
from alembic import op

revision = "c9d1e2f3a4b5"
down_revision = "b3c4d5e6f7a8"
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

BACKUP_TABLE = "organization_company_overview_backup"

# Display labels for the migrated comment body (matches the old subtab labels).
FIELD_LABELS = (
    ("company_details", "Company details"),
    (
        "company_representation_agreements",
        "Company representation agreements or affiliated organizations",
    ),
    ("company_acting_as_aggregator", "Acting as an aggregator"),
    ("company_additional_notes", "Additional notes"),
)

MIGRATION_NOTE = "Migrated from the former Company Overview fields."


def _compose_comment(row) -> tuple[str, str]:
    """Build the migrated comment as (sanitized HTML, plain search text)."""
    html_parts = []
    plain_parts = []
    for column_name, label in FIELD_LABELS:
        value = (row[column_name] or "").strip()
        if not value:
            continue
        escaped = html_lib.escape(value).replace("\n", "<br />")
        html_parts.append(f"<p><strong>{label}:</strong></p><p>{escaped}</p>")
        plain_parts.append(f"{label}: {value}")
    html_parts.append(f"<p><em>{MIGRATION_NOTE}</em></p>")
    plain_parts.append(MIGRATION_NOTE)
    return "".join(html_parts), "\n".join(plain_parts)


def upgrade() -> None:
    # 1. Association table -------------------------------------------------
    op.create_table(
        "organization_internal_comment",
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment=(
                "Foreign key to organization, part of the composite " "primary key."
            ),
        ),
        sa.Column(
            "internal_comment_id",
            sa.Integer(),
            nullable=False,
            comment=(
                "Foreign key to internal_comment, part of the composite " "primary key."
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

    # 3. Preserve populated legacy values before removal ------------------
    # 3a. Verbatim snapshot table (kept after the migration; may be dropped
    #     manually once the migrated comments are verified in production).
    op.create_table(
        BACKUP_TABLE,
        sa.Column("organization_id", sa.Integer(), primary_key=True),
        *[
            sa.Column(column_name, sa.String(), nullable=True, comment=comment)
            for column_name, comment in LEGACY_COMPANY_COLUMNS
        ],
        sa.Column(
            "migrated_internal_comment_id",
            sa.Integer(),
            nullable=True,
            comment="internal_comment created from this row during migration.",
        ),
        sa.Column(
            "backed_up_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
        ),
        comment=(
            "Pre-drop snapshot of the legacy organization.company_* fields "
            "(#4608). Safe to drop once the migrated Company Overview "
            "comments are verified."
        ),
    )

    bind = op.get_bind()
    populated = (
        bind.execute(
            sa.text(
                """
            SELECT organization_id, company_details,
                   company_representation_agreements,
                   company_acting_as_aggregator, company_additional_notes
            FROM organization
            WHERE btrim(coalesce(company_details, '')) <> ''
               OR btrim(coalesce(company_representation_agreements, '')) <> ''
               OR btrim(coalesce(company_acting_as_aggregator, '')) <> ''
               OR btrim(coalesce(company_additional_notes, '')) <> ''
            """
            )
        )
        .mappings()
        .all()
    )

    category_id = bind.execute(
        sa.text(
            "SELECT comment_category_id FROM comment_category "
            "WHERE display_name = :name"
        ).bindparams(name=COMPANY_OVERVIEW_CATEGORY)
    ).scalar_one()

    # 3b. Snapshot + convert each populated row into a Company Overview
    #     comment so the data stays visible in the new framework.
    for row in populated:
        bind.execute(
            sa.text(
                f"""
                INSERT INTO {BACKUP_TABLE}
                    (organization_id, company_details,
                     company_representation_agreements,
                     company_acting_as_aggregator, company_additional_notes)
                VALUES (:org_id, :details, :agreements, :aggregator, :notes)
                """
            ).bindparams(
                org_id=row["organization_id"],
                details=row["company_details"],
                agreements=row["company_representation_agreements"],
                aggregator=row["company_acting_as_aggregator"],
                notes=row["company_additional_notes"],
            )
        )
        comment_html, search_text = _compose_comment(row)
        comment_id = bind.execute(
            sa.text(
                """
                INSERT INTO internal_comment
                    (comment, comment_search_text, comment_search_vector,
                     organization_id, comment_category_id, visibility,
                     create_user, update_user, create_date, update_date)
                VALUES
                    (:comment, :search_text,
                     to_tsvector('english', :search_text),
                     :org_id, :category_id, 'Internal',
                     'system', 'system', now(), now())
                RETURNING internal_comment_id
                """
            ).bindparams(
                comment=comment_html,
                search_text=search_text,
                org_id=row["organization_id"],
                category_id=category_id,
            )
        ).scalar_one()
        bind.execute(
            sa.text(
                """
                INSERT INTO organization_internal_comment
                    (organization_id, internal_comment_id)
                VALUES (:org_id, :comment_id)
                """
            ).bindparams(org_id=row["organization_id"], comment_id=comment_id)
        )
        bind.execute(
            sa.text(
                f"""
                UPDATE {BACKUP_TABLE}
                SET migrated_internal_comment_id = :comment_id
                WHERE organization_id = :org_id
                """
            ).bindparams(comment_id=comment_id, org_id=row["organization_id"])
        )

    # 3c. Drop the legacy free-form company_* columns ---------------------
    for column_name, _comment in LEGACY_COMPANY_COLUMNS:
        op.drop_column("organization", column_name)


def downgrade() -> None:
    bind = op.get_bind()

    # 3. Restore the legacy columns and repopulate them from the backup ----
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
    bind.execute(
        sa.text(
            f"""
            UPDATE organization o
            SET company_details = b.company_details,
                company_representation_agreements =
                    b.company_representation_agreements,
                company_acting_as_aggregator = b.company_acting_as_aggregator,
                company_additional_notes = b.company_additional_notes
            FROM {BACKUP_TABLE} b
            WHERE b.organization_id = o.organization_id
            """
        )
    )

    # Remove only the comments this migration created (tracked in the backup
    # table); user-authored Company Overview comments are left in place with
    # their category cleared below.
    bind.execute(
        sa.text(
            f"""
            DELETE FROM organization_internal_comment
            WHERE internal_comment_id IN (
                SELECT migrated_internal_comment_id FROM {BACKUP_TABLE}
                WHERE migrated_internal_comment_id IS NOT NULL
            )
            """
        )
    )
    bind.execute(
        sa.text(
            f"""
            DELETE FROM internal_comment
            WHERE internal_comment_id IN (
                SELECT migrated_internal_comment_id FROM {BACKUP_TABLE}
                WHERE migrated_internal_comment_id IS NOT NULL
            )
            """
        )
    )
    op.drop_table(BACKUP_TABLE)

    # 2. Remove the seeded category (detach any remaining comments first so
    #    the FK does not block the delete) ---------------------------------
    bind.execute(
        sa.text(
            """
            UPDATE internal_comment SET comment_category_id = NULL
            WHERE comment_category_id = (
                SELECT comment_category_id FROM comment_category
                WHERE display_name = :name
            )
            """
        ).bindparams(name=COMPANY_OVERVIEW_CATEGORY)
    )
    op.execute(
        sa.text("DELETE FROM comment_category WHERE display_name = :name").bindparams(
            name=COMPANY_OVERVIEW_CATEGORY
        )
    )

    # 1. Drop the association table ----------------------------------------
    op.drop_index(
        "idx_organization_internal_comment_org_id",
        table_name="organization_internal_comment",
    )
    op.drop_table("organization_internal_comment")
