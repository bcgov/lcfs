"""Scheduled batch tasks

Revision ID: 2b82ade06987
Revises: 7a2c0f91a992
Create Date: 2025-07-18 08:31:38.002793

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2b82ade06987"
down_revision = "7a2c0f91a992"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scheduled_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("schedule", sa.String(length=100), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=True),
        sa.Column("last_run", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True),
        sa.Column("execution_count", sa.Integer(), nullable=True),
        sa.Column("failure_count", sa.Integer(), nullable=True),
        sa.Column("task_function", sa.String(length=200), nullable=False),
        sa.Column("parameters", sa.JSON(), nullable=True),
        sa.Column("max_retries", sa.Integer(), nullable=True),
        sa.Column("timeout_seconds", sa.Integer(), nullable=True),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scheduled_tasks")),
        comment="Represents an scheduled batch tasks",
    )
    op.create_index(
        op.f("ix_scheduled_tasks_id"), "scheduled_tasks", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_scheduled_tasks_is_enabled"),
        "scheduled_tasks",
        ["is_enabled"],
        unique=False,
    )
    op.create_index(
        op.f("ix_scheduled_tasks_name"), "scheduled_tasks", ["name"], unique=True
    )
    op.create_table(
        "task_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("execution_time_seconds", sa.Integer(), nullable=True),
        sa.Column("worker_id", sa.String(length=100), nullable=True),
        sa.Column("version", sa.String(length=50), nullable=True),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_executions")),
        comment="Represents an scheduled batch tasks",
    )
    op.create_index(
        op.f("ix_task_executions_id"), "task_executions", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_task_executions_task_id"), "task_executions", ["task_id"], unique=False
    )
    op.execute("commit")
    op.execute(
        """
        INSERT INTO scheduled_tasks (name, task_function, schedule, is_enabled) VALUES 
        ('Fuel Code Expiry Check', 'fuel_code_expiry.notify_expiring_fuel_code', '0 9 * * *', true),
        ('Auto-Submit Overdue Supplemental Reports', 'compliance_report.auto_submit_overdue_supplemental_reports', '0 2 * * *', true)
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_task_executions_task_id"), table_name="task_executions")
    op.drop_index(op.f("ix_task_executions_id"), table_name="task_executions")
    op.drop_table("task_executions")
    op.drop_index(op.f("ix_scheduled_tasks_name"), table_name="scheduled_tasks")
    op.drop_index(op.f("ix_scheduled_tasks_is_enabled"), table_name="scheduled_tasks")
    op.drop_index(op.f("ix_scheduled_tasks_id"), table_name="scheduled_tasks")
    op.drop_table("scheduled_tasks")
