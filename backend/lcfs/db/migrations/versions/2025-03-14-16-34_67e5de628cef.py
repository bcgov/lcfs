"""Remove fuel codes with default ci

Revision ID: 67e5de628cef
Revises: fd8ee994668c
Create Date: 2025-03-14 16:34:17.478471

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "67e5de628cef"
down_revision = "ffe9e3da563b"
branch_labels = None
depends_on = None

def upgrade() -> None:
    """Print records to be changed and update fuel_export to clear fuel_code_id
       when provision_of_the_act_id = 3 and fuel_code_id is not NULL."""
    conn = op.get_bind()

    # Query records that will be updated
    records = conn.execute(sa.text("""
        SELECT fuel_export_id, fuel_code_id
        FROM fuel_export
        WHERE provision_of_the_act_id = 3 AND fuel_code_id IS NOT NULL
    """)).fetchall()

    # Print out the records
    print("Records to be updated:")
    for row in records:
        print(f"fuel_export_id: {row.fuel_export_id}, fuel_code_id: {row.fuel_code_id}")

    # Update the records in fuel_export table
    result = conn.execute(sa.text("""
        UPDATE fuel_export
        SET fuel_code_id = NULL
        WHERE provision_of_the_act_id = 3 AND fuel_code_id IS NOT NULL
    """))
    print(f"Updated {result.rowcount} fuel export records to clear fuel_code_id")


def downgrade() -> None:
    """Downgrade not supported because this migration is not reversible."""
    print("Downgrade is applied manually.")