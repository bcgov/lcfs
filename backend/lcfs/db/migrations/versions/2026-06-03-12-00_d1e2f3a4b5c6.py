"""Backfill fuel_code.organization_id from company name match.

Revision ID: d1e2f3a4b5c6
Revises: f9a8b7c6d5e4
Create Date: 2026-05-25 12:00:00.000000
"""

from alembic import op

revision = "d1e2f3a4b5c6"
down_revision = "f9a8b7c6d5e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE fuel_code fc
        SET    organization_id = o.organization_id
        FROM   organization o
        WHERE  fc.organization_id IS NULL
          AND  (
                LOWER(fc.company) = LOWER(o.name)
             OR LOWER(fc.company) = LOWER(o.operating_name)
               )
        """)


def downgrade() -> None:
    pass
