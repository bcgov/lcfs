"""Fix transaction status view to include compliance report assessed statuse

Revision ID: 2e2f6f7ff391
Revises: fcba2790c890
Create Date: 2025-06-27 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2e2f6f7ff391"
down_revision = "fcba2790c890"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing transaction_status_view
    op.execute("DROP VIEW IF EXISTS transaction_status_view CASCADE;")

    # Create the updated transaction_status_view that includes compliance report statuses
    op.execute(
        """
        CREATE OR REPLACE VIEW transaction_status_view AS
        SELECT DISTINCT status::text, create_date, update_date
        FROM initiative_agreement_status
        UNION
        SELECT DISTINCT status::text, create_date, update_date
        FROM admin_adjustment_status
        UNION
        SELECT DISTINCT status::text, create_date, update_date
        FROM transfer_status
        UNION
        SELECT DISTINCT status::text, create_date, update_date
        FROM compliance_report_status
        WHERE status = 'Assessed';
        """
    )


def downgrade() -> None:
    # Drop the updated view
    op.execute("DROP VIEW IF EXISTS transaction_status_view CASCADE;")

    # Recreate the original transaction_status_view without compliance report statuses
    op.execute(
        """
        CREATE OR REPLACE VIEW transaction_status_view AS
        SELECT status::text, create_date, update_date
        FROM initiative_agreement_status
        UNION
        SELECT status::text, create_date, update_date
        FROM admin_adjustment_status
        UNION
        SELECT status::text, create_date, update_date
        FROM transfer_status;
        """
    )
