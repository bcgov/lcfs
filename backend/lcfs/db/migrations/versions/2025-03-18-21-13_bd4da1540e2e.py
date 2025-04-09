"""Add Analyst adjustment Status Pt. 2

Revision ID: bd4da1540e2d
Revises: 937c793bf7b8
Create Date: 2025-03-11 21:12:46.492584

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "bd4da1540e2e"
down_revision = "bd4da1540e2d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "public".
        "compliance_report_status"("compliance_report_status_id", "status",
                                   "effective_status")
        VALUES(10, 'Analyst_adjustment', 't');
        """
    )

    op.execute(
        """
        DELETE FROM "public".
        "compliance_report_status" WHERE "compliance_report_status_id" = 6
        """
    )

    # Create a view for compliance reports list
    op.execute(
        """
        CREATE OR REPLACE VIEW v_compliance_report AS
        SELECT
            cr.compliance_report_id,
            cr.compliance_report_group_uuid,
            cr.version,
            cp.compliance_period_id,
            cp.description AS compliance_period,
            o.organization_id,
            o.name AS organization_name,
            cr.nickname AS report_type,
            crs.compliance_report_status_id AS report_status_id,
            crs.status AS report_status,
            cr.update_date,
            cr.supplemental_initiator
        FROM compliance_report cr
        JOIN compliance_period cp
            ON cr.compliance_period_id = cp.compliance_period_id
        JOIN organization o
            ON cr.organization_id = o.organization_id
        JOIN compliance_report_status crs
            ON cr.current_status_id = crs.compliance_report_status_id;
        """
    )


def downgrade() -> None:
    # Create a view for compliance reports list
    op.execute(
        """
        CREATE OR REPLACE VIEW v_compliance_report AS
        WITH latest_versions AS (
            -- Get the latest version of each compliance_report_group_uuid
            SELECT
                cr.compliance_report_group_uuid,
                MAX(cr.version) AS max_version
            FROM compliance_report cr
            GROUP BY cr.compliance_report_group_uuid
        ),
        latest_with_status AS (
            -- Get the latest version with its status
            SELECT
                cr.compliance_report_group_uuid,
                cr.version,
                crs.status
            FROM compliance_report cr
            JOIN latest_versions lv
                ON cr.compliance_report_group_uuid = lv.compliance_report_group_uuid
                AND cr.version = lv.max_version
            JOIN compliance_report_status crs
                ON cr.current_status_id = crs.compliance_report_status_id
        ),
        second_latest_versions AS (
            -- Get the second latest version only for reports where the latest is Draft
            SELECT
                cr.compliance_report_group_uuid,
                MAX(cr.version) AS second_max_version
            FROM compliance_report cr
            JOIN latest_with_status lws
                ON cr.compliance_report_group_uuid = lws.compliance_report_group_uuid
            WHERE cr.version < lws.version
                AND lws.status = 'Draft'
            GROUP BY cr.compliance_report_group_uuid
        ),
        selected_reports AS (
            -- Always select the latest version
            SELECT cr.*
            FROM compliance_report cr
            JOIN latest_versions lv
                ON cr.compliance_report_group_uuid = lv.compliance_report_group_uuid
                AND cr.version = lv.max_version

            UNION ALL

            -- Select second latest version only where the latest is Draft
            SELECT cr.*
            FROM compliance_report cr
            JOIN second_latest_versions slv
                ON cr.compliance_report_group_uuid = slv.compliance_report_group_uuid
                AND cr.version = slv.second_max_version
        )
        SELECT DISTINCT
            sr.compliance_report_id,
            sr.compliance_report_group_uuid,
            sr.version,
            cp.compliance_period_id,
            cp.description AS compliance_period,
            o.organization_id,
            o.name AS organization_name,
            sr.nickname AS report_type,
            crs.compliance_report_status_id AS report_status_id,
            crs.status AS report_status,
            sr.update_date
        FROM selected_reports sr
        JOIN compliance_period cp
            ON sr.compliance_period_id = cp.compliance_period_id
        JOIN organization o
            ON sr.organization_id = o.organization_id
        JOIN compliance_report_status crs
            ON sr.current_status_id = crs.compliance_report_status_id;
        """
    )

    op.execute(
        """
        DELETE FROM "public".
        "compliance_report_status" WHERE "compliance_report_status_id" = 10
        """
    )

    op.execute(
        """
        INSERT INTO "public".
        "compliance_report_status"("compliance_report_status_id", "status",
                                   "effective_status")
        VALUES(6, 'Reassessed', 't');
        """
    )
