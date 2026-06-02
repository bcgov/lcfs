"""Backfill comment metadata and group UUIDs.

Derivation rules:
- Compliance reports: org_id, year from report; category=COMPLIANCE_NOTES; group_uuid
- Transfers: org_id from buyer; category=TRANSFER_NOTES
- IA: org_id from initiator; category=IA_NOTES
- Admin adjustment: org_id from assessed org; category=PENALTY_NOTES
- comment_search_text: HTML-stripped plain text
- comment_search_vector: to_tsvector('english', search_text)

Revision ID: e4c6b2d0f3a8
Revises: d3b5a1c9e2f7
Create Date: 2026-05-29 10:30:00.000000
"""

import logging

import sqlalchemy as sa
from alembic import op

revision = "e4c6b2d0f3a8"
down_revision = "d3b5a1c9e2f7"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.runtime.migration")


# HTML tag stripping + whitespace collapse (conservative for SQL backfill).
SANITIZED_COMMENT_SQL = (
    "btrim(regexp_replace("
    "regexp_replace(coalesce(ic.comment, ''), E'<[^>]*>', ' ', 'g'), "
    "E'\\s+', ' ', 'g'))"
)


def _exec(sql: str, label: str, **params) -> int:
    """Execute statement, log row count, abort on failure with context."""
    bind = op.get_bind()
    try:
        result = bind.execute(sa.text(sql), params)
        count = result.rowcount if result.rowcount is not None else -1
        logger.info("comment-log backfill: %s updated %s rows", label, count)
        return max(count, 0)
    except Exception as exc:  # pragma: no cover - logged + re-raised
        logger.exception("comment-log backfill: %s FAILED: %s", label, exc)
        raise


def _category_ids(bind: sa.engine.Connection) -> dict[str, int]:
    """Return ``{display_name: comment_category_id}`` for the agreed categories."""
    rows = bind.execute(
        sa.text("SELECT display_name, comment_category_id FROM comment_category")
    ).fetchall()
    mapping = {name: cid for name, cid in rows}
    required = {
        "Compliance notes",
        "Transfer notes",
        "IA notes",
        "Penalty notes",
        "CI application notes",
    }
    missing = required - mapping.keys()
    if missing:
        raise RuntimeError(
            "comment-log backfill: missing seed rows in comment_category: "
            f"{sorted(missing)}"
        )
    return mapping


def upgrade() -> None:
    bind = op.get_bind()
    categories = _category_ids(bind)
    total = 0

    # 1. Compliance report comments -------------------------------------
    total += _exec(
        """
        UPDATE internal_comment AS ic
        SET organization_id = cr.organization_id,
            compliance_year = cp.description::int,
            comment_category_id = :cat_id
        FROM compliance_report_internal_comment AS cric
        JOIN compliance_report AS cr
          ON cr.compliance_report_id = cric.compliance_report_id
        JOIN compliance_period AS cp
          ON cp.compliance_period_id = cr.compliance_period_id
        WHERE cric.internal_comment_id = ic.internal_comment_id
          AND cp.description ~ '^[0-9]+$'
          AND (
            ic.organization_id IS DISTINCT FROM cr.organization_id
            OR ic.compliance_year IS DISTINCT FROM cp.description::int
            OR ic.comment_category_id IS DISTINCT FROM :cat_id
          )
        """,
        "compliance_report comments",
        cat_id=categories["Compliance notes"],
    )

    # 2. Transfer comments (buyer = to_organization_id) -----------------
    total += _exec(
        """
        UPDATE internal_comment AS ic
        SET organization_id = t.to_organization_id,
            comment_category_id = :cat_id
        FROM transfer_internal_comment AS tic
        JOIN transfer AS t ON t.transfer_id = tic.transfer_id
        WHERE tic.internal_comment_id = ic.internal_comment_id
          AND (
            ic.organization_id IS DISTINCT FROM t.to_organization_id
            OR ic.comment_category_id IS DISTINCT FROM :cat_id
          )
        """,
        "transfer comments",
        cat_id=categories["Transfer notes"],
    )

    # 3. Initiative agreement comments (initiator = to_organization_id) --
    total += _exec(
        """
        UPDATE internal_comment AS ic
        SET organization_id = ia.to_organization_id,
            comment_category_id = :cat_id
        FROM initiative_agreement_internal_comment AS iaic
        JOIN initiative_agreement AS ia
          ON ia.initiative_agreement_id = iaic.initiative_agreement_id
        WHERE iaic.internal_comment_id = ic.internal_comment_id
          AND (
            ic.organization_id IS DISTINCT FROM ia.to_organization_id
            OR ic.comment_category_id IS DISTINCT FROM :cat_id
          )
        """,
        "initiative_agreement comments",
        cat_id=categories["IA notes"],
    )

    # 4. Admin adjustment comments (assessed = to_organization_id) ------
    total += _exec(
        """
        UPDATE internal_comment AS ic
        SET organization_id = aa.to_organization_id,
            comment_category_id = :cat_id
        FROM admin_adjustment_internal_comment AS aaic
        JOIN admin_adjustment AS aa
          ON aa.admin_adjustment_id = aaic.admin_adjustment_id
        WHERE aaic.internal_comment_id = ic.internal_comment_id
          AND (
            ic.organization_id IS DISTINCT FROM aa.to_organization_id
            OR ic.comment_category_id IS DISTINCT FROM :cat_id
          )
        """,
        "admin_adjustment comments",
        cat_id=categories["Penalty notes"],
    )

    # 5. CI application comments ------------------------------------
    total += _exec(
        """
        UPDATE internal_comment AS ic
        SET organization_id = cia.organization_id,
            comment_category_id = :cat_id
        FROM ci_application_internal_comment AS ciaic
        JOIN ci_application AS cia
          ON cia.ci_application_id = ciaic.ci_application_id
        WHERE ciaic.internal_comment_id = ic.internal_comment_id
          AND (
            ic.organization_id IS DISTINCT FROM cia.organization_id
            OR ic.comment_category_id IS DISTINCT FROM :cat_id
          )
        """,
        "ci_application comments",
        cat_id=categories["CI application notes"],
    )

    # 6. Sanitize comment text and rebuild search vector ----------------
    total += _exec(
        f"""
        UPDATE internal_comment AS ic
        SET comment_search_text = {SANITIZED_COMMENT_SQL},
            comment_search_vector = to_tsvector(
                'english', {SANITIZED_COMMENT_SQL}
            )
        WHERE ic.comment IS NOT NULL
          AND (
            ic.comment_search_text IS DISTINCT FROM {SANITIZED_COMMENT_SQL}
            OR ic.comment_search_vector IS NULL
          )
        """,
        "search text/vector",
    )

    # 6. Backfill compliance_report_group_uuid on the association table --
    total += _exec(
        """
        UPDATE compliance_report_internal_comment AS cric
        SET compliance_report_group_uuid = cr.compliance_report_group_uuid
        FROM compliance_report AS cr
        WHERE cr.compliance_report_id = cric.compliance_report_id
          AND cric.compliance_report_group_uuid
              IS DISTINCT FROM cr.compliance_report_group_uuid
        """,
        "compliance_report_group_uuid on association",
    )

    # 7. Summary --------------------------------------------------------
    missing_org = bind.execute(
        sa.text("SELECT count(*) FROM internal_comment WHERE organization_id IS NULL")
    ).scalar()
    missing_cat = bind.execute(
        sa.text(
            "SELECT count(*) FROM internal_comment WHERE comment_category_id IS NULL"
        )
    ).scalar()
    missing_vec = bind.execute(
        sa.text(
            "SELECT count(*) FROM internal_comment "
            "WHERE comment_search_vector IS NULL AND comment IS NOT NULL"
        )
    ).scalar()
    logger.info(
        "comment-log backfill: total writes=%s, "
        "remaining NULL organization_id=%s, comment_category_id=%s, "
        "comment_search_vector=%s",
        total,
        missing_org,
        missing_cat,
        missing_vec,
    )


def downgrade() -> None:
    # Best-effort revert: clear the columns populated by this backfill.
    op.execute(
        sa.text(
            "UPDATE internal_comment SET "
            "organization_id = NULL, "
            "compliance_year = NULL, "
            "comment_category_id = NULL, "
            "comment_search_text = NULL, "
            "comment_search_vector = NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE compliance_report_internal_comment SET "
            "compliance_report_group_uuid = NULL"
        )
    )
