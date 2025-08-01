"""Remove EffectiveDates mixin from Transfer

Revision ID: 8cb65fb3418e
Revises: b1c2d3e4f5g6
Create Date: 2025-07-31 06:10:12.758949

"""

from lcfs.db.dependencies import (
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)
import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "8cb65fb3418e"
down_revision = "b1c2d3e4f5g6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # update transfer base view to not use EffectiveDates
    content = find_and_read_sql_file(sqlFile="metabase.sql")
    sections = parse_sql_sections(content)
    execute_sql_sections(sections, ["Transfer base Analytics View"])
    op.execute(
        """
        UPDATE transfer t
        SET transaction_effective_date = COALESCE(t.effective_date, th.update_date)
        FROM transfer_history th
        WHERE t.transfer_id = th.transfer_id 
        AND t.current_status_id = th.transfer_status_id
        AND t.transaction_effective_date is null
        AND t.current_status_id = 6;
    """
    )
    op.execute(sa.text("commit;"))

    op.drop_column("transfer", "expiration_date")
    op.drop_column("transfer", "effective_status")
    op.drop_column("transfer", "effective_date")

    op.drop_column("transfer_history", "expiration_date")
    op.drop_column("transfer_history", "effective_status")
    op.drop_column("transfer_history", "effective_date")


def downgrade() -> None:
    op.add_column(
        "transfer_history",
        sa.Column(
            "effective_date",
            sa.DATE(),
            autoincrement=False,
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
    )
    op.add_column(
        "transfer_history",
        sa.Column(
            "effective_status",
            sa.BOOLEAN(),
            autoincrement=False,
            nullable=False,
            server_default=sa.text('true'),
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "transfer_history",
        sa.Column(
            "expiration_date",
            sa.DATE(),
            autoincrement=False,
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
    )

    op.add_column(
        "transfer",
        sa.Column(
            "effective_date",
            sa.DATE(),
            autoincrement=False,
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
    )
    op.add_column(
        "transfer",
        sa.Column(
            "effective_status",
            sa.BOOLEAN(),
            autoincrement=False,
            nullable=False,
            server_default=sa.text('true'),
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "transfer",
        sa.Column(
            "expiration_date",
            sa.DATE(),
            autoincrement=False,
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
    )
