"""Add mv_director_review_transaction_count to calculate the number of transactions and compliance reports for the DirectorReview card on the dashboard.

Revision ID: 37721d823e5e
Revises: 13b4b52bfc3a
Create Date: 2024-07-25 13:20:31.817695

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "37721d823e5e"
down_revision = "13b4b52bfc3a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE MATERIALIZED VIEW mv_director_review_transaction_count AS
    SELECT
        'transfers' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                t.current_status_id = 5  -- Recommended
        ) AS count_for_review
    FROM transfer t
    UNION ALL
    SELECT
        'compliance_reports' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                cr.status_id = 4  -- Recommended by Manager
        ) AS count_for_review
    FROM compliance_report cr
    UNION ALL
    SELECT
        'initiative_agreements' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                ia.current_status_id = 2  -- Recommended
        ) AS count_for_review
    FROM initiative_agreement ia
    UNION ALL
    SELECT
        'admin_adjustments' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                aa.current_status_id = 2  -- Recommended
        ) AS count_for_review
    FROM admin_adjustment aa;
    """)

    op.execute("""CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx ON mv_director_review_transaction_count (transaction_type);""")

    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create triggers on transfer, compliance_report, initiative_agreement, and admin_adjustment tables
    op.execute("""
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """)

    op.execute("""
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_compliance_report
    AFTER INSERT OR UPDATE OR DELETE ON compliance_report
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """)

    op.execute("""
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """)

    op.execute("""
    CREATE TRIGGER refresh_mv_director_review_transaction_count_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_director_review_transaction_count();
    """)


def downgrade() -> None:
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_report ON compliance_report;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjustment ON admin_adjustment;""")

    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();""")

    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;""")
