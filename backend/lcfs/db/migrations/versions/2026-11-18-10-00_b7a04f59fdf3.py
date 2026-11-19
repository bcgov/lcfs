"""Add scheduled_job_lease so one pod at a time runs a maintenance job.

Revision ID: b7a04f59fdf3
Revises: 9b3e5c7a1d24
Create Date: 2026-11-18 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "b7a04f59fdf3"
down_revision = "9b3e5c7a1d24"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "scheduled_job_lease",
        sa.Column(
            "job_name",
            sa.String(100),
            primary_key=True,
            comment="Scheduled job the lease belongs to",
        ),
        sa.Column(
            "holder",
            sa.String(255),
            nullable=False,
            comment="Run that holds or last held the lease: pod name, process id and run id",
        ),
        sa.Column(
            "lease_until",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            comment="The lease is free once this time has passed",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        comment=(
            "Leases that let one backend pod at a time run a scheduled maintenance "
            "job that cannot hold a transaction-scoped advisory lock, such as "
            "REINDEX CONCURRENTLY."
        ),
    )


def downgrade():
    op.drop_table("scheduled_job_lease")
