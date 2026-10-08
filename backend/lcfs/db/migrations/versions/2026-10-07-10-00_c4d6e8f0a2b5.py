"""Store effective dates as Pacific calendar dates and convert the transaction
views' dates once.

mv_transaction_aggregate converted every date with
``x AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'``. For the timestamptz
history dates that is a double conversion: recorded and approved dates landed a
day late for anything after 10 AM Pacific (8 AM in winter). Effective dates are
stored as the Pacific calendar date at midnight, so the same expression moved
them a day early. The views now convert timestamptz values to Pacific once and
read effective dates as the calendar dates they are.

That reading is only right if every stored effective date is a Pacific
calendar date, so two kinds of older value are corrected first:

* Transfers recorded before v1.3.1 (April 2026) stored the UTC instant of the
  recording (``datetime.now()`` in a UTC container, later
  ``datetime.now(timezone.utc)``, plus the 8cb65fb3418e backfill). They are the
  only transfer effective dates with a time of day, and become the Pacific
  date of that instant.
* Initiative agreements and admin adjustments approved with a blank effective
  date were stamped with the UTC date, which is the next day after 5 PM Pacific
  (4 PM in winter). The audit log identifies them exactly: the approval fills
  transaction_effective_date and transaction_id in the same update. Only those
  whose stamp differs from the Pacific date of the approval are changed.

Downgrade restores the previous view definitions. It keeps the corrected dates;
the audit log records their old values.

Revision ID: c4d6e8f0a2b5
Revises: 5148a6b7c9d0
Create Date: 2026-10-05 10:00:00.000000
"""

import logging

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c4d6e8f0a2b5"
down_revision = "5148a6b7c9d0"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")


# The TFRS migration and the record path since v1.3.1 store midnight, so a time
# of day marks exactly the transfers that hold a UTC instant.
NORMALIZE_TRANSFER_EFFECTIVE_DATES = """
UPDATE transfer
SET transaction_effective_date =
    (transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
WHERE transaction_effective_date::time <> TIME '00:00'
"""


def _blank_date_approval_fix(table: str, pk: str) -> str:
    """
    Re-date approvals in ``table`` whose blank effective date was stamped with
    the UTC date.

    The stamping update is the one that fills transaction_effective_date and
    transaction_id together, and its audit timestamp is the approval moment.
    The CTE is materialized so its casts only ever see that table's rows. Rows
    whose effective date changed after approval are left alone.
    """
    return f"""
WITH stamp AS MATERIALIZED (
    SELECT
        al.row_id #>> '{{}}' AS row_id,
        (al.new_values ->> 'transaction_effective_date')::timestamp AS stamped,
        (al.create_date AT TIME ZONE 'UTC')::date AS utc_date,
        (al.create_date AT TIME ZONE 'America/Vancouver')::date AS pacific_date
    FROM audit_log al
    WHERE al.table_name = '{table}'
      AND al.operation = 'UPDATE'
      AND al.old_values ->> 'transaction_effective_date' IS NULL
      AND al.new_values ->> 'transaction_effective_date' IS NOT NULL
      AND al.old_values ->> 'transaction_id' IS NULL
      AND al.new_values ->> 'transaction_id' IS NOT NULL
)
UPDATE {table} AS target
SET transaction_effective_date = stamp.pacific_date
FROM stamp
WHERE target.{pk}::text = stamp.row_id
  AND target.transaction_effective_date = stamp.stamped
  AND stamp.stamped::date = stamp.utc_date
  AND stamp.pacific_date <> stamp.utc_date
"""


FIX_INITIATIVE_AGREEMENT_DATES = _blank_date_approval_fix(
    "initiative_agreement", "initiative_agreement_id"
)
FIX_ADMIN_ADJUSTMENT_DATES = _blank_date_approval_fix(
    "admin_adjustment", "admin_adjustment_id"
)


# Verbatim from db/sql/materialized_views.sql.
UPGRADE_SQL = r"""
DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;

CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
    WITH all_transactions AS (
        ------------------------------------------------------------------------
        -- Transfers
        ------------------------------------------------------------------------
        SELECT
            t.transfer_id AS transaction_id,
            'Transfer' AS transaction_type,
            NULL AS description,
            org_from.organization_id AS from_organization_id,
            org_from.name AS from_organization,
            org_to.organization_id AS to_organization_id,
            org_to.name AS to_organization,
            t.quantity,
            t.price_per_unit,
            ts.status::text AS status,
            CASE
                WHEN ts.status = 'Recorded' THEN
                    EXTRACT(YEAR FROM COALESCE(
                        t.transaction_effective_date::date,
                        (
                            SELECT (th.create_date AT TIME ZONE 'America/Vancouver')::date
                            FROM transfer_history th
                            WHERE th.transfer_id = t.transfer_id
                            AND th.transfer_status_id = 6  -- Recorded
                            LIMIT 1
                        )
                    ))::text
                ELSE 'N/A'
            END AS compliance_period,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'FROM_ORG'
                LIMIT 1
            ) AS from_org_comment,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'TO_ORG'
                LIMIT 1
            ) AS to_org_comment,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'GOVERNMENT'
                LIMIT 1
            ) AS government_comment,
            tc.category,
            (
                SELECT (th.create_date AT TIME ZONE 'America/Vancouver')::date
                FROM transfer_history th
                WHERE th.transfer_id = t.transfer_id
                AND th.transfer_status_id = 6  -- Recorded
                LIMIT 1
            ) AS recorded_date,
            NULL AS approved_date,
            t.transaction_effective_date::date AS transaction_effective_date,
            t.update_date AS update_date,
            t.create_date AS create_date
        FROM transfer t
        JOIN organization org_from
            ON t.from_organization_id = org_from.organization_id
        JOIN organization org_to
            ON t.to_organization_id = org_to.organization_id
        JOIN transfer_status ts
            ON t.current_status_id = ts.transfer_status_id
        LEFT JOIN transfer_category tc
            ON t.transfer_category_id = tc.transfer_category_id
        UNION ALL
        ------------------------------------------------------------------------
        -- Initiative Agreements
        ------------------------------------------------------------------------
        SELECT
            ia.initiative_agreement_id AS transaction_id,
            'InitiativeAgreement' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            ia.compliance_units AS quantity,
            NULL AS price_per_unit,
            ias.status::text AS status,
            EXTRACT(YEAR FROM ia.transaction_effective_date::date)::text AS compliance_period,
            null as from_org_comment,
            null as to_org_comment,
            ia.gov_comment AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT (iah.create_date AT TIME ZONE 'America/Vancouver')::date
                FROM initiative_agreement_history iah
                WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                AND iah.initiative_agreement_status_id = 3 -- Approved
                LIMIT 1
            ) AS approved_date,
            ia.transaction_effective_date::date AS transaction_effective_date,
            ia.update_date AS update_date,
            ia.create_date AS create_date
        FROM initiative_agreement ia
        JOIN organization org
            ON ia.to_organization_id = org.organization_id
        JOIN initiative_agreement_status ias
            ON ia.current_status_id = ias.initiative_agreement_status_id
        UNION ALL
        ------------------------------------------------------------------------
        -- Admin Adjustments
        ------------------------------------------------------------------------
        SELECT
            aa.admin_adjustment_id AS transaction_id,
            'AdminAdjustment' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            aa.compliance_units AS quantity,
            NULL AS price_per_unit,
            aas.status::text AS status,
            EXTRACT(YEAR FROM aa.transaction_effective_date::date)::text AS compliance_period,
            null as from_org_comment,
            null as to_org_comment,
            aa.gov_comment AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT (aah.create_date AT TIME ZONE 'America/Vancouver')::date
                FROM admin_adjustment_history aah
                WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                AND aah.admin_adjustment_status_id = 3 -- Approved
                LIMIT 1
            ) AS approved_date,
            aa.transaction_effective_date::date AS transaction_effective_date,
            aa.update_date AS update_date,
            aa.create_date AS create_date
        FROM admin_adjustment aa
        JOIN organization org
            ON aa.to_organization_id = org.organization_id
        JOIN admin_adjustment_status aas
            ON aa.current_status_id = aas.admin_adjustment_status_id
        UNION ALL
        ------------------------------------------------------------------------
        -- Aggregator Issuances
        ------------------------------------------------------------------------
        SELECT
            ag.aggregator_issuance_id AS transaction_id,
            'AggregatorIssuance' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            ag.compliance_units AS quantity,
            NULL AS price_per_unit,
            'Recorded' AS status,
            EXTRACT(YEAR FROM ag.transaction_effective_date::date)::text AS compliance_period,
            NULL AS from_org_comment,
            NULL AS to_org_comment,
            ag.gov_comment AS government_comment,
            NULL AS category,
            ag.recorded_date::date AS recorded_date,
            NULL AS approved_date,
            ag.transaction_effective_date::date AS transaction_effective_date,
            ag.update_date AS update_date,
            ag.create_date AS create_date
        FROM aggregator_issuance ag
        JOIN organization org
            ON ag.to_organization_id = org.organization_id
        WHERE COALESCE(ag.effective_status, TRUE) = TRUE
        UNION ALL
        ------------------------------------------------------------------------
        -- Compliance Reports
        ------------------------------------------------------------------------
        SELECT
            cr.compliance_report_id AS transaction_id,
            'ComplianceReport' AS transaction_type,
            cr.nickname AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            tr.compliance_units AS quantity,
            NULL AS price_per_unit,
            crs.status::text AS status,
            cp.description AS compliance_period,
            NULL as from_org_comment,
            NULL as to_org_comment,
            NULL AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            NULL AS transaction_effective_date,
            cr.update_date AS update_date,
            cr.create_date AS create_date
        FROM compliance_report cr
        JOIN organization org
            ON cr.organization_id = org.organization_id
        JOIN compliance_report_status crs
            ON cr.current_status_id = crs.compliance_report_status_id
        JOIN compliance_period cp
            ON cr.compliance_period_id = cp.compliance_period_id
        JOIN "transaction" tr
            ON cr.transaction_id = tr.transaction_id
        AND cr.transaction_id IS NOT NULL
        WHERE crs.status IN ('Assessed', 'Reassessed')
        UNION ALL
        ------------------------------------------------------------------------
        -- Standalone Transactions (legacy / unassociated)
        ------------------------------------------------------------------------
        SELECT
            t.transaction_id,
            'StandaloneTransaction' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            t.compliance_units AS quantity,
            NULL AS price_per_unit,
            CASE WHEN COALESCE(t.effective_status, TRUE) THEN 'Recorded' ELSE 'Inactive' END AS status,
            EXTRACT(YEAR FROM COALESCE(
                t.effective_date,
                (t.create_date AT TIME ZONE 'America/Vancouver')::date
            ))::text AS compliance_period,
            NULL AS from_org_comment,
            NULL AS to_org_comment,
            NULL AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            COALESCE(
                t.effective_date,
                (t.create_date AT TIME ZONE 'America/Vancouver')::date
            ) AS transaction_effective_date,
            COALESCE(t.update_date, t.create_date) AS update_date,
            t.create_date AS create_date
        FROM "transaction" t
        JOIN organization org
            ON t.organization_id = org.organization_id
        LEFT JOIN compliance_report cr
            ON cr.transaction_id = t.transaction_id
        LEFT JOIN admin_adjustment aa
            ON aa.transaction_id = t.transaction_id
        LEFT JOIN initiative_agreement ia
            ON ia.transaction_id = t.transaction_id
        LEFT JOIN transfer tf_from
            ON tf_from.from_transaction_id = t.transaction_id
        LEFT JOIN transfer tf_to
            ON tf_to.to_transaction_id = t.transaction_id
        LEFT JOIN aggregator_issuance ag
            ON ag.transaction_id = t.transaction_id
        WHERE cr.transaction_id IS NULL
          AND aa.transaction_id IS NULL
          AND ia.transaction_id IS NULL
          AND tf_from.from_transaction_id IS NULL
          AND tf_to.to_transaction_id IS NULL
          AND ag.transaction_id IS NULL
          AND COALESCE(t.effective_status, TRUE) = TRUE
    )
    , deduped AS (
        SELECT
            *,
            ROW_NUMBER() OVER (
                PARTITION BY transaction_id, transaction_type
                ORDER BY update_date DESC NULLS LAST, create_date DESC NULLS LAST
            ) AS rn
        FROM all_transactions
    )
    SELECT * FROM deduped WHERE rn = 1;

CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
    ON mv_transaction_aggregate (transaction_id, transaction_type);

-- ==========================================
-- mv_credit_ledger
-- Source: 2026-10-05-10-00_c4d6e8f0a2b5.py
-- Depends on: mv_transaction_aggregate
-- ==========================================
CREATE MATERIALIZED VIEW mv_credit_ledger AS
WITH base AS (
    -- Transfers: from_org loses units
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.from_organization_id                       AS organization_id,
        -ABS(t.quantity)                             AS compliance_units,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'Transfer'
    AND    t.status           = 'Recorded'

    UNION ALL

    -- Transfers: to_org gains units
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id,
        ABS(t.quantity),
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'Transfer'
    AND    t.status           = 'Recorded'

    UNION ALL

    -- Admin Adjustments
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'AdminAdjustment'
    AND    t.status           = 'Approved'

    UNION ALL

    -- Initiative Agreements
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'InitiativeAgreement'
    AND    t.status           = 'Approved'

    UNION ALL

    -- Compliance Reports
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'ComplianceReport'
    AND    t.status           = 'Assessed'

    UNION ALL

    -- Standalone Transactions
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'StandaloneTransaction'
    AND    t.status           = 'Recorded'

    UNION ALL

    -- Aggregator Issuances
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'AggregatorIssuance'
    AND    t.status           = 'Recorded'
)

SELECT
    transaction_id,
    transaction_type,
    compliance_period,
    organization_id,
    compliance_units,
    SUM(compliance_units) OVER (
        PARTITION BY organization_id
        ORDER BY update_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS available_balance,
    create_date,
    update_date
FROM base;

CREATE INDEX mv_credit_ledger_org_year_idx ON mv_credit_ledger (organization_id, compliance_period);
CREATE INDEX mv_credit_ledger_org_date_idx ON mv_credit_ledger (organization_id, update_date DESC);
CREATE UNIQUE INDEX mv_credit_ledger_tx_org_idx ON mv_credit_ledger (transaction_id, transaction_type, organization_id);
"""

# The definitions this migration replaces, verbatim from
# 2026-07-16-12-00_d4e5f6a7b8c9.py.
DOWNGRADE_SQL = r"""
DROP MATERIALIZED VIEW IF EXISTS mv_credit_ledger CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_transaction_aggregate CASCADE;

CREATE MATERIALIZED VIEW mv_transaction_aggregate AS
    WITH all_transactions AS (
        ------------------------------------------------------------------------
        -- Transfers
        ------------------------------------------------------------------------
        SELECT
            t.transfer_id AS transaction_id,
            'Transfer' AS transaction_type,
            NULL AS description,
            org_from.organization_id AS from_organization_id,
            org_from.name AS from_organization,
            org_to.organization_id AS to_organization_id,
            org_to.name AS to_organization,
            t.quantity,
            t.price_per_unit,
            ts.status::text AS status,
            CASE
                WHEN ts.status = 'Recorded' THEN
                    EXTRACT(YEAR FROM (
                        COALESCE(t.transaction_effective_date, (
                            SELECT th.create_date
                            FROM transfer_history th
                            WHERE th.transfer_id = t.transfer_id
                            AND th.transfer_status_id = 6  -- Recorded
                            LIMIT 1
                        )) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'
                    ))::text
                ELSE 'N/A'
            END AS compliance_period,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'FROM_ORG'
                LIMIT 1
            ) AS from_org_comment,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'TO_ORG'
                LIMIT 1
            ) AS to_org_comment,
            (
                SELECT tc.comment
                FROM transfer_comment tc
                WHERE tc.transfer_id = t.transfer_id
                AND tc.comment_source = 'GOVERNMENT'
                LIMIT 1
            ) AS government_comment,
            tc.category,
            (
                SELECT (th.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
                FROM transfer_history th
                WHERE th.transfer_id = t.transfer_id
                AND th.transfer_status_id = 6  -- Recorded
                LIMIT 1
            ) AS recorded_date,
            NULL AS approved_date,
            (t.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
            t.update_date AS update_date,
            t.create_date AS create_date
        FROM transfer t
        JOIN organization org_from
            ON t.from_organization_id = org_from.organization_id
        JOIN organization org_to
            ON t.to_organization_id = org_to.organization_id
        JOIN transfer_status ts
            ON t.current_status_id = ts.transfer_status_id
        LEFT JOIN transfer_category tc
            ON t.transfer_category_id = tc.transfer_category_id
        UNION ALL
        ------------------------------------------------------------------------
        -- Initiative Agreements
        ------------------------------------------------------------------------
        SELECT
            ia.initiative_agreement_id AS transaction_id,
            'InitiativeAgreement' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            ia.compliance_units AS quantity,
            NULL AS price_per_unit,
            ias.status::text AS status,
            EXTRACT(YEAR FROM (ia.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            null as from_org_comment,
            null as to_org_comment,
            ia.gov_comment AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT (iah.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
                FROM initiative_agreement_history iah
                WHERE iah.initiative_agreement_id = ia.initiative_agreement_id
                AND iah.initiative_agreement_status_id = 3 -- Approved
                LIMIT 1
            ) AS approved_date,
            (ia.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
            ia.update_date AS update_date,
            ia.create_date AS create_date
        FROM initiative_agreement ia
        JOIN organization org
            ON ia.to_organization_id = org.organization_id
        JOIN initiative_agreement_status ias
            ON ia.current_status_id = ias.initiative_agreement_status_id
        UNION ALL
        ------------------------------------------------------------------------
        -- Admin Adjustments
        ------------------------------------------------------------------------
        SELECT
            aa.admin_adjustment_id AS transaction_id,
            'AdminAdjustment' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            aa.compliance_units AS quantity,
            NULL AS price_per_unit,
            aas.status::text AS status,
            EXTRACT(YEAR FROM (aa.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            null as from_org_comment,
            null as to_org_comment,
            aa.gov_comment AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            (
                SELECT (aah.create_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date
                FROM admin_adjustment_history aah
                WHERE aah.admin_adjustment_id = aa.admin_adjustment_id
                AND aah.admin_adjustment_status_id = 3 -- Approved
                LIMIT 1
            ) AS approved_date,
            (aa.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
            aa.update_date AS update_date,
            aa.create_date AS create_date
        FROM admin_adjustment aa
        JOIN organization org
            ON aa.to_organization_id = org.organization_id
        JOIN admin_adjustment_status aas
            ON aa.current_status_id = aas.admin_adjustment_status_id
        UNION ALL
        ------------------------------------------------------------------------
        -- Aggregator Issuances
        ------------------------------------------------------------------------
        SELECT
            ag.aggregator_issuance_id AS transaction_id,
            'AggregatorIssuance' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            ag.compliance_units AS quantity,
            NULL AS price_per_unit,
            'Recorded' AS status,
            EXTRACT(YEAR FROM (ag.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            NULL AS from_org_comment,
            NULL AS to_org_comment,
            ag.gov_comment AS government_comment,
            NULL AS category,
            (ag.recorded_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS recorded_date,
            NULL AS approved_date,
            (ag.transaction_effective_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
            ag.update_date AS update_date,
            ag.create_date AS create_date
        FROM aggregator_issuance ag
        JOIN organization org
            ON ag.to_organization_id = org.organization_id
        WHERE COALESCE(ag.effective_status, TRUE) = TRUE
        UNION ALL
        ------------------------------------------------------------------------
        -- Compliance Reports
        ------------------------------------------------------------------------
        SELECT
            cr.compliance_report_id AS transaction_id,
            'ComplianceReport' AS transaction_type,
            cr.nickname AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            tr.compliance_units AS quantity,
            NULL AS price_per_unit,
            crs.status::text AS status,
            cp.description AS compliance_period,
            NULL as from_org_comment,
            NULL as to_org_comment,
            NULL AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            NULL AS transaction_effective_date,
            cr.update_date AS update_date,
            cr.create_date AS create_date
        FROM compliance_report cr
        JOIN organization org
            ON cr.organization_id = org.organization_id
        JOIN compliance_report_status crs
            ON cr.current_status_id = crs.compliance_report_status_id
        JOIN compliance_period cp
            ON cr.compliance_period_id = cp.compliance_period_id
        JOIN "transaction" tr
            ON cr.transaction_id = tr.transaction_id
        AND cr.transaction_id IS NOT NULL
        WHERE crs.status IN ('Assessed', 'Reassessed')
        UNION ALL
        ------------------------------------------------------------------------
        -- Standalone Transactions (legacy / unassociated)
        ------------------------------------------------------------------------
        SELECT
            t.transaction_id,
            'StandaloneTransaction' AS transaction_type,
            NULL AS description,
            NULL AS from_organization_id,
            NULL AS from_organization,
            org.organization_id AS to_organization_id,
            org.name AS to_organization,
            t.compliance_units AS quantity,
            NULL AS price_per_unit,
            CASE WHEN COALESCE(t.effective_status, TRUE) THEN 'Recorded' ELSE 'Inactive' END AS status,
            EXTRACT(YEAR FROM (COALESCE(t.effective_date, t.create_date) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver'))::text AS compliance_period,
            NULL AS from_org_comment,
            NULL AS to_org_comment,
            NULL AS government_comment,
            NULL AS category,
            NULL AS recorded_date,
            NULL AS approved_date,
            (COALESCE(t.effective_date, t.create_date) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Vancouver')::date AS transaction_effective_date,
            COALESCE(t.update_date, t.create_date) AS update_date,
            t.create_date AS create_date
        FROM "transaction" t
        JOIN organization org
            ON t.organization_id = org.organization_id
        LEFT JOIN compliance_report cr
            ON cr.transaction_id = t.transaction_id
        LEFT JOIN admin_adjustment aa
            ON aa.transaction_id = t.transaction_id
        LEFT JOIN initiative_agreement ia
            ON ia.transaction_id = t.transaction_id
        LEFT JOIN transfer tf_from
            ON tf_from.from_transaction_id = t.transaction_id
        LEFT JOIN transfer tf_to
            ON tf_to.to_transaction_id = t.transaction_id
        LEFT JOIN aggregator_issuance ag
            ON ag.transaction_id = t.transaction_id
        WHERE cr.transaction_id IS NULL
          AND aa.transaction_id IS NULL
          AND ia.transaction_id IS NULL
          AND tf_from.from_transaction_id IS NULL
          AND tf_to.to_transaction_id IS NULL
          AND ag.transaction_id IS NULL
          AND COALESCE(t.effective_status, TRUE) = TRUE
    )
    , deduped AS (
        SELECT
            *,
            ROW_NUMBER() OVER (
                PARTITION BY transaction_id, transaction_type
                ORDER BY update_date DESC NULLS LAST, create_date DESC NULLS LAST
            ) AS rn
        FROM all_transactions
    )
    SELECT * FROM deduped WHERE rn = 1;

CREATE UNIQUE INDEX mv_transaction_aggregate_unique_idx
    ON mv_transaction_aggregate (transaction_id, transaction_type);

-- ==========================================
-- mv_credit_ledger
-- Source: 2025-12-02-12-00_b71c1d2e3f45.py
-- Depends on: mv_transaction_aggregate
-- ==========================================
CREATE MATERIALIZED VIEW mv_credit_ledger AS
WITH base AS (
    -- Transfers: from_org loses units
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.from_organization_id                       AS organization_id,
        -ABS(t.quantity)                             AS compliance_units,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'Transfer'
    AND    t.status           = 'Recorded'

    UNION ALL

    -- Transfers: to_org gains units
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id,
        ABS(t.quantity),
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'Transfer'
    AND    t.status           = 'Recorded'

    UNION ALL

    -- Admin Adjustments
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'AdminAdjustment'
    AND    t.status           = 'Approved'

    UNION ALL

    -- Initiative Agreements
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'InitiativeAgreement'
    AND    t.status           = 'Approved'

    UNION ALL

    -- Compliance Reports
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'ComplianceReport'
    AND    t.status           = 'Assessed'

    UNION ALL

    -- Standalone Transactions
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'StandaloneTransaction'
    AND    t.status           = 'Recorded'

    UNION ALL

    -- Aggregator Issuances
    SELECT
        t.transaction_id,
        t.transaction_type,
        t.compliance_period,
        t.to_organization_id                       AS organization_id,
        t.quantity,
        t.create_date,
        t.update_date
    FROM   mv_transaction_aggregate t
    WHERE  t.transaction_type = 'AggregatorIssuance'
    AND    t.status           = 'Recorded'
)

SELECT
    transaction_id,
    transaction_type,
    compliance_period,
    organization_id,
    compliance_units,
    SUM(compliance_units) OVER (
        PARTITION BY organization_id
        ORDER BY update_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS available_balance,
    create_date,
    update_date
FROM base;

CREATE INDEX mv_credit_ledger_org_year_idx ON mv_credit_ledger (organization_id, compliance_period);
CREATE INDEX mv_credit_ledger_org_date_idx ON mv_credit_ledger (organization_id, update_date DESC);
CREATE UNIQUE INDEX mv_credit_ledger_tx_org_idx ON mv_credit_ledger (transaction_id, transaction_type, organization_id);
"""


def _exec_script(ddl: str) -> None:
    """Execute a multi-statement DDL script one statement at a time.

    The migrations run over asyncpg, which rejects multiple commands in a
    single prepared statement, so each statement is sent on its own (matching
    the helper in 2026-07-16-12-00_d4e5f6a7b8c9.py).
    """
    for statement in ddl.split(";"):
        statement = statement.strip()
        if statement:
            op.execute(statement + ";")


def _run_data_fix(description: str, sql: str) -> None:
    rowcount = op.get_bind().execute(sa.text(sql)).rowcount
    log.info("%s: %s row(s) corrected", description, rowcount)


def upgrade() -> None:
    # Correct the stored dates before rebuilding: the refresh triggers on these
    # tables refresh mv_transaction_aggregate, so it has to exist meanwhile.
    _run_data_fix("Transfer effective dates", NORMALIZE_TRANSFER_EFFECTIVE_DATES)
    _run_data_fix(
        "Initiative agreement effective dates", FIX_INITIATIVE_AGREEMENT_DATES
    )
    _run_data_fix("Admin adjustment effective dates", FIX_ADMIN_ADJUSTMENT_DATES)
    _exec_script(UPGRADE_SQL)


def downgrade() -> None:
    _exec_script(DOWNGRADE_SQL)
