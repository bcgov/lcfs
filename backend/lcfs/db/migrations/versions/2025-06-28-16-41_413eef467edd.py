"""Supplemental Draft status update

Revision ID: 413eef467edd
Revises: d432ee9659f
Create Date: 2025-06-20 16:41:55.294035

"""

import sqlalchemy as sa
from alembic import op
from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "413eef467edd"
down_revision = "840a9375c9f2"
branch_labels = None
depends_on = None


def recreate_compliance_reports_view():
    """Recreate the v_compliance_report view from metabase.sql"""
    try:
        # Ensure role exists before creating views
        create_role_if_not_exists()
        
        # Read the metabase.sql file
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Execute only the "Compliance Reports List View" section
        execute_sql_sections(sections, ["Compliance Reports List View"])

    except Exception as e:
        print(f"Error recreating v_compliance_report view: {e}")


def upgrade() -> None:
    # Step 1: Add the new enum value and commit it
    connection = op.get_bind()

    # Add the enum value in its own transaction
    connection.execute(
        sa.text(
            "ALTER TYPE compliancereportstatusenum ADD VALUE IF NOT EXISTS 'Supplemental_requested'"
        )
    )
    connection.execute(
        sa.text(
            "ALTER TYPE supplementalinitiatortype ADD VALUE IF NOT EXISTS 'GOVERNMENT_INITIATED'"
        )
    )
    connection.commit()
    connection.execute(sa.text("insert into compliance_report_status (compliance_report_status_id, status, effective_status) values(11, 'Supplemental_requested'::compliancereportstatusenum, true);"))

    # Step 2: Recreate the view from metabase.sql
    recreate_compliance_reports_view()

    # Step 3: Update the data to use the new enum value
    op.execute(
        """
        UPDATE compliance_report cr
        SET supplemental_initiator = 'GOVERNMENT_INITIATED'::supplementalinitiatortype
        WHERE cr.compliance_report_id IN (
            SELECT DISTINCT crh.compliance_report_id
            FROM compliance_report_history crh
            JOIN user_profile up ON LOWER(up.keycloak_username) = LOWER(crh.create_user)
            JOIN user_role ur ON ur.user_profile_id = up.user_profile_id
                AND ur.role_id = 1
            WHERE crh.status_id = 1
        );
    """
    )
    op.execute(sa.text("commit;"))


def downgrade() -> None:
    # Revert the data changes first
    op.execute(
        """
        UPDATE compliance_report cr
        SET supplemental_initiator = 'SUPPLIER_SUPPLEMENTAL'::supplementalinitiatortype
        WHERE supplemental_initiator = 'GOVERNMENT_INITIATED'::supplementalinitiatortype
    """
    )
