"""Add Recommended status to fuel code status enum

Revision ID: d432ee9659f
Revises: 0a5836cb1b71
Create Date: 2025-06-18 08:48:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d432ee9659f"
down_revision = "0a5836cb1b71"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if the enum value already exists
    check_enum_query = sa.text(
        "SELECT EXISTS(SELECT 1 FROM pg_enum WHERE enumlabel = :enum_value AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'fuel_code_status_enum'))"
    )
    result = op.get_bind().execute(check_enum_query, {"enum_value": "Recommended"})
    if not result.scalar():
        # Add 'Recommended' to the fuel code status enum
        op.execute("ALTER TYPE fuel_code_status_enum ADD VALUE 'Recommended'")

        # Commit the transaction to make the enum value available
        op.get_bind().commit()

    # Insert the new status into the fuel_code_status table
    # Check if the record already exists before inserting
    check_status_query = sa.text(
        "SELECT EXISTS(SELECT 1 FROM fuel_code_status WHERE status = 'Recommended')"
    )
    result = op.get_bind().execute(check_status_query)
    if not result.scalar():
        op.execute(
            """
            INSERT INTO fuel_code_status (fuel_code_status_id, status, description, display_order)
            VALUES (4, 'Recommended', 'Fuel code recommended for approval', 2)
            ON CONFLICT (fuel_code_status_id) DO NOTHING;
            """
        )

    # Update display order for existing statuses to maintain proper order
    # Draft (1), Recommended (2), Approved (3), Deleted (4)
    op.execute(
        """
        UPDATE fuel_code_status 
        SET display_order = 3 
        WHERE status = 'Approved' AND display_order != 3;
        """
    )

    op.execute(
        """
        UPDATE fuel_code_status 
        SET display_order = 4 
        WHERE status = 'Deleted' AND display_order != 4;
        """
    )


def downgrade() -> None:
    # Remove the status from the fuel_code_status table
    op.execute("DELETE FROM fuel_code_status WHERE status = 'Recommended'")

    # Restore original display orders
    # Draft (1), Approved (2), Deleted (3)
    op.execute(
        """
        UPDATE fuel_code_status 
        SET display_order = 2 
        WHERE status = 'Approved';
        """
    )

    op.execute(
        """
        UPDATE fuel_code_status 
        SET display_order = 3 
        WHERE status = 'Deleted';
        """
    )
