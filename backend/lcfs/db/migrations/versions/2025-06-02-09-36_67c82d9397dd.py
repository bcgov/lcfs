"""Metabase views

Revision ID: 67c82d9397dd
Revises: ac2cb0248135
Create Date: 2025-06-02 09:36:04.425278

"""

from lcfs.db.dependencies import clean_and_split_sql, create_role_if_not_exists, find_and_read_sql_file
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "67c82d9397dd"
down_revision = "ac2cb0248135"
branch_labels = None
depends_on = None

# Specify which sections to execute from the SQL file
SECTIONS_TO_EXECUTE = [
    "Compliance Reports Analytics View",
    "Compliance Reports Waiting review",
    "Compliance reports time per status",
    "Transfer base Analytics View",
]


def upgrade():
    """Execute entire SQL file"""
    try:
        # First, ensure the role and user exist
        create_role_if_not_exists()

        # Read SQL file
        content = find_and_read_sql_file()

        # Clean and split into statements
        statements = clean_and_split_sql(content)

        print(f"Found {len(statements)} SQL statements to execute")

        # Execute each statement
        for i, statement in enumerate(statements, 1):
            try:
                # Get first few words for logging
                first_words = " ".join(statement.split()[:5])
                print(f"Executing statement {i}/{len(statements)}: {first_words}...")

                op.execute(sa.text(statement))

            except Exception as e:
                print(f"Error executing statement {i}: {e}")
                print(f"Statement preview: {statement[:300]}...")
                print(f"Full statement:")
                print(statement)
                raise

        print("All SQL statements executed successfully!")

    except FileNotFoundError as e:
        print(f"SQL file not found: {e}")
        raise
    except Exception as e:
        print(f"Error executing SQL: {e}")
        raise


def downgrade():
    """Drop created views and objects"""
    try:
        # Drop views in reverse order
        views_to_drop = [
            "vw_transfer_base",
            "vw_compliance_reports_time_per_status",
            "vw_reports_waiting_review",
            "vw_compliance_report_base",
        ]

        for view in views_to_drop:
            try:
                print(f"Dropping view: {view}")
                op.execute(sa.text(f"DROP VIEW IF EXISTS {view}"))
            except Exception as e:
                print(f"Warning: Could not drop {view}: {e}")

        # Revoke permissions
        try:
            op.execute(
                sa.text(
                    "REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM basic_lcfs_reporting_role"
                )
            )
        except Exception as e:
            print(f"Warning: Could not revoke permissions: {e}")

    except Exception as e:
        print(f"Error during downgrade: {e}")
