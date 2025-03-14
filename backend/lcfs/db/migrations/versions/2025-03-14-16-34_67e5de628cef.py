"""Remove fuel codes with default ci

Revision ID: 67e5de628cef
Revises: fd8ee994668c
Create Date: 2025-03-14 16:34:17.478471

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative import declarative_base

# revision identifiers, used by Alembic.
revision = "67e5de628cef"
down_revision = "fd8ee994668c"
branch_labels = None
depends_on = None

# Create a temporary table to store backup data
Base = declarative_base()

class FuelExportBackup(Base):
    __tablename__ = 'fuel_export_backup_67e5de628cef'

    id = sa.Column(sa.Integer, primary_key=True)
    fuel_export_id = sa.Column(sa.Integer, nullable=False)
    fuel_code_id = sa.Column(sa.Integer, nullable=False)
    provision_of_the_act_id = sa.Column(sa.Integer, nullable=False)


def upgrade() -> None:
    """Update fuel exports to clear fuel_code_id when using default carbon intensity"""
    conn = op.get_bind()

    # Create backup table
    Base.metadata.create_all(conn)

    # Backup the data first
    conn.execute(sa.text("""
    INSERT INTO fuel_export_backup_67e5de628cef (fuel_export_id, fuel_code_id, provision_of_the_act_id)
    SELECT fuel_export_id, fuel_code_id, provision_of_the_act_id FROM fuel_export
    WHERE provision_of_the_act_id = 3 AND fuel_code_id IS NOT NULL
    """))

    # Count backup records
    count_result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM fuel_export_backup_67e5de628cef"
    )).scalar()

    print(f"Backed up {count_result} fuel export records to temporary table")

    # Now perform the update
    result = conn.execute(sa.text("""
    UPDATE fuel_export SET fuel_code_id = NULL
    WHERE provision_of_the_act_id = 3 AND fuel_code_id IS NOT NULL
    """))

    print(f"Updated {result.rowcount} fuel export records to clear fuel_code_id")


def downgrade() -> None:
    """Restore original fuel_code_id values from backup table"""
    conn = op.get_bind()

    # Check if backup table exists
    inspector = sa.inspect(conn)
    if 'fuel_export_backup_67e5de628cef' not in inspector.get_table_names():
        print("Backup table doesn't exist - cannot downgrade")
        return

    # Restore data
    result = conn.execute(sa.text("""
    UPDATE fuel_export fe
    SET fuel_code_id = bak.fuel_code_id
    FROM fuel_export_backup_67e5de628cef bak
    WHERE fe.fuel_export_id = bak.fuel_export_id
    """))

    print(f"Restored fuel_code_id for {result.rowcount} records")

    # Drop the backup table
    op.drop_table('fuel_export_backup_67e5de628cef')
    print("Dropped backup table")