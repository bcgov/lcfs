"""Add A1 flag to credit transfers.

Revision ID: f8e9d0c1b2a3
Revises: c1a2b3c4d5e6
Create Date: 2026-05-25 12:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

revision = "f8e9d0c1b2a3"
down_revision = "c1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transfer",
        sa.Column(
            "is_a1_category",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="Flag for credit transfers completed in less than 30 days.",
        ),
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS vw_transfer_base CASCADE;")
    op.drop_column("transfer", "is_a1_category")
    op.execute(
        """
        CREATE OR REPLACE VIEW vw_transfer_base AS
        SELECT
            transfer.transfer_id,
            transfer_status.status,
            (coalesce(transfer.transaction_effective_date AT TIME ZONE 'UTC', transfer_history.update_date) AT TIME ZONE 'America/Vancouver')::date AS calculated_effective_date,
            from_organization.name AS from_organization,
            to_organization.name AS to_organization,
            price_per_unit,
            quantity,
            price_per_unit * quantity::float AS transfer_value,
            transfer_category.category::text AS transfer_category
        FROM
            transfer
            INNER JOIN transfer_status ON transfer.current_status_id = transfer_status.transfer_status_id
            LEFT JOIN organization from_organization ON transfer.from_organization_id = from_organization.organization_id
            LEFT JOIN organization to_organization ON transfer.to_organization_id = to_organization.organization_id
            LEFT JOIN TRANSACTION ON transaction.transaction_id = transfer.from_transaction_id
            LEFT JOIN TRANSACTION t2 ON t2.transaction_id = transfer.to_transaction_id
            LEFT JOIN transfer_history ON transfer_history.transfer_id = transfer.transfer_id
                AND transfer_history.transfer_status_id = 6
            LEFT JOIN transfer_category ON transfer.transfer_category_id = transfer_category.transfer_category_id
        WHERE
            price_per_unit != 0
            AND status = 'Recorded';

        GRANT SELECT ON vw_transfer_base TO basic_lcfs_reporting_role;
        """
    )
