"""Add action, changes and display flag to credit market audit log

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-09-04 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d9e0f1a2b3c4"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "credit_market_audit_log",
        sa.Column(
            "display_in_credit_market",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether the listing was displayed in the credit market after the change.",
        ),
    )
    op.add_column(
        "credit_market_audit_log",
        sa.Column(
            "action",
            sa.String(length=20),
            nullable=True,
            comment="Type of listing change: Added, Updated or Removed.",
        ),
    )
    op.add_column(
        "credit_market_audit_log",
        sa.Column(
            "changes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Field-level diff of the change: {field: {from, to}}.",
        ),
    )

    # Existing rows were only ever written while the listing was displayed,
    # so backfill the flag and classify the first entry per organization as
    # the listing being added and every later entry as an update.
    op.execute(
        sa.text(
            """
            UPDATE credit_market_audit_log SET display_in_credit_market = true
            """
        )
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT credit_market_audit_log_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY organization_id
                           ORDER BY create_date, credit_market_audit_log_id
                       ) AS rn
                FROM credit_market_audit_log
            )
            UPDATE credit_market_audit_log a
            SET action = CASE WHEN r.rn = 1 THEN 'Added' ELSE 'Updated' END
            FROM ranked r
            WHERE a.credit_market_audit_log_id = r.credit_market_audit_log_id
              AND a.action IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_column("credit_market_audit_log", "changes")
    op.drop_column("credit_market_audit_log", "action")
    op.drop_column("credit_market_audit_log", "display_in_credit_market")
