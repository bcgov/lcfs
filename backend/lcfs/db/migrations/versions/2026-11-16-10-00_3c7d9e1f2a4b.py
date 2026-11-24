"""Let each admin adjustment claim its ledger transaction only once.

Initiative agreements already carry the same partial unique index
(uq_initiative_agreement_transaction_id, migration d7e2f4a9b1c6).

Revision ID: 3c7d9e1f2a4b
Revises: 8b3e6a1c5d90
Create Date: 2026-11-16 10:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "3c7d9e1f2a4b"
down_revision = "8b3e6a1c5d90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    shared = op.get_bind().scalar(sa.text("""
            SELECT count(*) FROM (
                SELECT transaction_id
                FROM admin_adjustment
                WHERE transaction_id IS NOT NULL
                GROUP BY transaction_id
                HAVING count(*) > 1
            ) shared
            """))
    if shared:
        # Which record keeps the transaction is a data decision, not one
        # for a migration to make silently.
        raise RuntimeError(
            f"{shared} ledger transaction(s) are linked to more than one admin "
            "adjustment; resolve them before applying this migration."
        )
    op.create_index(
        "uq_admin_adjustment_transaction_id",
        "admin_adjustment",
        ["transaction_id"],
        unique=True,
        postgresql_where=sa.text("transaction_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_admin_adjustment_transaction_id", table_name="admin_adjustment")
