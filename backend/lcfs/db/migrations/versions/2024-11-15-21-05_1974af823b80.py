"""Enhance audit_log: Rename id, add comments, enforce uniqueness, and create indexes.

Revision ID: 1974af823b80
Revises: b659816d0a86
Create Date: 2024-11-15 21:05:06.629584

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "1974af823b80"
down_revision = "b659816d0a86"
branch_labels = None
depends_on = None


def upgrade():
    # Step 1: Rename 'id' column to 'audit_log_id'
    op.alter_column("audit_log", "id", new_column_name="audit_log_id")

    # Step 2: Add comments to the table and columns
    op.execute(
        "COMMENT ON TABLE audit_log IS 'Audit log capturing changes to database tables.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.audit_log_id IS 'Unique identifier for each audit log entry.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.table_name IS 'Name of the table where the action occurred.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.operation IS 'Type of operation: ''INSERT'', ''UPDATE'', or ''DELETE''.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.row_id IS 'Primary key of the affected row, stored as JSONB to support composite keys.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.old_values IS 'Previous values before the operation.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.new_values IS 'New values after the operation.';"
    )
    op.execute("COMMENT ON COLUMN audit_log.delta IS 'JSONB delta of the changes.';")
    op.execute(
        "COMMENT ON COLUMN audit_log.create_date IS 'Timestamp when the audit log entry was created.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.create_user IS 'User who created the audit log entry.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.update_date IS 'Timestamp when the audit log entry was last updated.';"
    )
    op.execute(
        "COMMENT ON COLUMN audit_log.update_user IS 'User who last updated the audit log entry.';"
    )

    # Step 3: Add unique constraint on 'audit_log_id'
    op.create_unique_constraint(
        "uq_audit_log_audit_log_id", "audit_log", ["audit_log_id"]
    )

    # Step 4: Create new indexes
    op.create_index("idx_audit_log_operation", "audit_log", ["operation"])
    op.create_index("idx_audit_log_create_date", "audit_log", ["create_date"])
    op.create_index("idx_audit_log_create_user", "audit_log", ["create_user"])
    op.create_index(
        "idx_audit_log_delta", "audit_log", ["delta"], postgresql_using="gin"
    )


def downgrade():
    # Reverse the above operations

    # Step 4: Drop new indexes
    op.drop_index("idx_audit_log_delta", table_name="audit_log")
    op.drop_index("idx_audit_log_create_user", table_name="audit_log")
    op.drop_index("idx_audit_log_create_date", table_name="audit_log")
    op.drop_index("idx_audit_log_operation", table_name="audit_log")

    # Step 3: Drop unique constraint on 'audit_log_id'
    op.drop_constraint("uq_audit_log_audit_log_id", "audit_log", type_="unique")

    # Step 2: Remove comments
    op.execute("COMMENT ON COLUMN audit_log.update_user IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.update_date IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.create_user IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.create_date IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.delta IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.new_values IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.old_values IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.row_id IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.operation IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.table_name IS NULL;")
    op.execute("COMMENT ON COLUMN audit_log.audit_log_id IS NULL;")
    op.execute("COMMENT ON TABLE audit_log IS NULL;")

    # Step 1: Rename 'audit_log_id' column back to 'id'
    op.alter_column("audit_log", "audit_log_id", new_column_name="id")
