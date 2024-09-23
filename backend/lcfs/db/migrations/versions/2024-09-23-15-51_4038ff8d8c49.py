"""Consolidated materialized views and triggers

Revision ID: 4038ff8d8c49
Revises: e7fa1aeef86e
Create Date: 2024-09-23 12:34:56.789123

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4038ff8d8c49'
down_revision = 'e7fa1aeef86e'
branch_labels = None
depends_on = None


def upgrade():
    # Drop existing triggers
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_report ON compliance_report;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report;""")

    # Drop existing functions
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")

    # Drop existing materialized views and views
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")

    # Create mv_transaction_aggregate materialized view
    op.execute("""
    CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
    SELECT
        t.transfer_id AS transaction_id,
        'Transfer' AS transaction_type,
        org_from.organization_id AS from_organization_id,
        org_from.name AS from_organization,
        org_to.organization_id AS to_organization_id,
        org_to.name AS to_organization,
        t.quantity,
        t.price_per_unit,
        ts.status::text AS status,
        NULL AS compliance_period,
        t.from_org_comment AS comment,
        tc.category,
        (
            SELECT th.create_date 
            FROM transfer_history th 
            WHERE th.transfer_id = t.transfer_id AND th.transfer_status_id = 6
        ) AS recorded_date,
        NULL AS approved_date,
        t.transaction_effective_date,
        t.update_date,
        t.create_date
    FROM transfer t
    JOIN organization org_from ON t.from_organization_id = org_from.organization_id
    JOIN organization org_to ON t.to_organization_id = org_to.organization_id
    JOIN transfer_status ts ON t.current_status_id = ts.transfer_status_id
    LEFT JOIN transfer_category tc ON t.transfer_category_id = tc.transfer_category_id
    UNION ALL
    SELECT
        ia.initiative_agreement_id AS transaction_id,
        'InitiativeAgreement' AS transaction_type,
        NULL AS from_organization_id,
        NULL AS from_organization,
        org.organization_id AS to_organization_id,
        org.name AS to_organization,
        ia.compliance_units AS quantity,
        NULL AS price_per_unit,
        ias.status::text AS status,
        NULL AS compliance_period,
        ia.gov_comment AS comment,
        NULL AS category,
        NULL AS recorded_date,
        (
            SELECT iah.create_date 
            FROM initiative_agreement_history iah 
            WHERE iah.initiative_agreement_id = ia.initiative_agreement_id AND iah.initiative_agreement_status_id = 3
        ) AS approved_date,
        ia.transaction_effective_date,
        ia.update_date,
        ia.create_date
    FROM initiative_agreement ia
    JOIN organization org ON ia.to_organization_id = org.organization_id
    JOIN initiative_agreement_status ias ON ia.current_status_id = ias.initiative_agreement_status_id
    UNION ALL
    SELECT
        aa.admin_adjustment_id AS transaction_id,
        'AdminAdjustment' AS transaction_type,
        NULL AS from_organization_id,
        NULL AS from_organization,
        org.organization_id AS to_organization_id,
        org.name AS to_organization,
        aa.compliance_units AS quantity,
        NULL AS price_per_unit,
        aas.status::text AS status,
        NULL AS compliance_period,
        aa.gov_comment AS comment,
        NULL AS category,
        NULL AS recorded_date,
        (
            SELECT aah.create_date 
            FROM admin_adjustment_history aah 
            WHERE aah.admin_adjustment_id = aa.admin_adjustment_id AND aah.admin_adjustment_status_id = 3
        ) AS approved_date,
        aa.transaction_effective_date,
        aa.update_date,
        aa.create_date
    FROM admin_adjustment aa
    JOIN organization org ON aa.to_organization_id = org.organization_id
    JOIN admin_adjustment_status aas ON aa.current_status_id = aas.admin_adjustment_status_id;
    """)

    # Create unique index on mv_transaction_aggregate
    op.execute("""
    CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx ON mv_transaction_aggregate (transaction_id, transaction_type);
    """)

    # Create transaction_status_view
    op.execute("""
    CREATE OR REPLACE VIEW transaction_status_view AS
    SELECT 
        status::text, 
        create_date,
        update_date
    FROM initiative_agreement_status
    UNION
    SELECT         
        status::text, 
        create_date,
        update_date 
    FROM admin_adjustment_status
    UNION
    SELECT 
        status::text, 
        create_date,
        update_date  
    FROM transfer_status;
    """)

    # Create refresh_transaction_aggregate function
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_transaction_aggregate()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_aggregate;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create triggers to refresh mv_transaction_aggregate
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_transfer_history
    AFTER INSERT OR UPDATE OR DELETE ON transfer_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_initiative_agreement_history
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)
    op.execute("""
    CREATE TRIGGER refresh_transaction_view_after_admin_adjustment_history
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment_history
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_transaction_aggregate();
    """)

    # Create mv_transaction_count materialized view
    op.execute("""
    CREATE MATERIALIZED VIEW mv_transaction_count AS
    SELECT
        'transfers' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                t.current_status_id IN (4, 5)  -- Submitted, Recommended
        ) AS count_in_progress
    FROM transfer t
    UNION ALL
    SELECT
        'initiative_agreements' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                ia.current_status_id IN (1, 2)  -- Draft, Recommended
        ) AS count_in_progress
    FROM initiative_agreement ia
    UNION ALL
    SELECT
        'admin_adjustments' AS transaction_type,
        COUNT(*) FILTER (
            WHERE
                aa.current_status_id IN (1, 2)  -- Draft, Recommended
        ) AS count_in_progress
    FROM admin_adjustment aa;
    """)

    # Create unique index on mv_transaction_count
    op.execute("""
    CREATE UNIQUE INDEX mv_transaction_count_unique_idx ON mv_transaction_count (transaction_type);
    """)

    # Create refresh_mv_transaction_count function
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_mv_transaction_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_transaction_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create triggers to refresh mv_transaction_count
    op.execute("""
    CREATE TRIGGER refresh_mv_transaction_count_after_transfer
    AFTER INSERT OR UPDATE OR DELETE ON transfer
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """)
    op.execute("""
    CREATE TRIGGER refresh_mv_transaction_count_after_initiative_agreement
    AFTER INSERT OR UPDATE OR DELETE ON initiative_agreement
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """)
    op.execute("""
    CREATE TRIGGER refresh_mv_transaction_count_after_admin_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON admin_adjustment
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_transaction_count();
    """)

    # Create mv_director_review_transaction_count materialized view
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
                cr.current_status_id = 4  -- Recommended by Manager
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

    # Create unique index on mv_director_review_transaction_count
    op.execute("""
    CREATE UNIQUE INDEX mv_director_review_transaction_count_unique_idx ON mv_director_review_transaction_count (transaction_type);
    """)

    # Create refresh_mv_director_review_transaction_count function
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_mv_director_review_transaction_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_director_review_transaction_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create triggers to refresh mv_director_review_transaction_count
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

    # Create mv_org_compliance_report_count materialized view
    op.execute("""
    CREATE MATERIALIZED VIEW mv_org_compliance_report_count AS
    SELECT
        organization_id,
        COUNT(*) FILTER (WHERE current_status_id = 1) AS count_in_progress,
        COUNT(*) FILTER (WHERE current_status_id = 2) AS count_awaiting_gov_review
    FROM
        compliance_report
    GROUP BY
        organization_id;
    """)

    # Create unique index on mv_org_compliance_report_count
    op.execute("""
    CREATE UNIQUE INDEX mv_org_compliance_report_count_org_id_idx ON mv_org_compliance_report_count (organization_id);
    """)

    # Create refresh_mv_org_compliance_report_count function
    op.execute("""
    CREATE OR REPLACE FUNCTION refresh_mv_org_compliance_report_count()
    RETURNS TRIGGER AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_compliance_report_count;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
    """)

    # Create trigger to refresh mv_org_compliance_report_count
    op.execute("""
    CREATE TRIGGER refresh_mv_org_compliance_report_count_after_compliance_report
    AFTER INSERT OR UPDATE OR DELETE ON compliance_report
    FOR EACH STATEMENT EXECUTE FUNCTION refresh_mv_org_compliance_report_count();
    """)


def downgrade():
    # Drop triggers
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_transfer_history ON transfer_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_initiative_agreement_history ON initiative_agreement_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_transaction_view_after_admin_adjustment_history ON admin_adjustment_history;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_transaction_count_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_transfer ON transfer;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_compliance_report ON compliance_report;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_initiative_agreement ON initiative_agreement;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_director_review_transaction_count_after_admin_adjustment ON admin_adjustment;""")
    op.execute("""DROP TRIGGER IF EXISTS refresh_mv_org_compliance_report_count_after_compliance_report ON compliance_report;""")

    # Drop functions
    op.execute("""DROP FUNCTION IF EXISTS refresh_transaction_aggregate();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_transaction_count();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_director_review_transaction_count();""")
    op.execute("""DROP FUNCTION IF EXISTS refresh_mv_org_compliance_report_count();""")

    # Drop materialized views and views
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate;""")
    op.execute("""DROP VIEW IF EXISTS transaction_status_view;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_transaction_count;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_director_review_transaction_count;""")
    op.execute("""DROP MATERIALIZED VIEW IF EXISTS mv_org_compliance_report_count;""")
