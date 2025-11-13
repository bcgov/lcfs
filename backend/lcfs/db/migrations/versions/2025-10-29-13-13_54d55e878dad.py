"""compliance summary historical update

Revision ID: 54d55e878dad
Revises: a3290902296b
Create Date: 2025-04-04 13:52:08.981318

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql
from lcfs.db.dependencies import (
    create_role_if_not_exists,
    execute_sql_sections,
    find_and_read_sql_file,
    parse_sql_sections,
)

# revision identifiers, used by Alembic.
revision = "54d55e878dad"
down_revision = "a3290902296b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Get all dependent views that need to be dropped
    dependent_views = [
        "vw_allocation_agreement_chained",
        "vw_compliance_report_chained",
        "vw_compliance_report_fuel_supply_base",
        "vw_allocation_agreement_base",
        "vw_compliance_report_base",
    ]

    # Drop all dependent views in reverse dependency order
    for view in dependent_views:
        try:
            op.execute(f"DROP VIEW IF EXISTS {view} CASCADE")
        except Exception as e:
            print(f"Note: Could not drop view {view} (may not exist): {e}")

    # Add new column
    op.add_column(
        "compliance_report_summary",
        sa.Column(
            "historical_snapshot",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
            comment="Contains historical data from pre-2024 TFRS system for data retention and analysis purposes.",
        ),
    )

    # Drop the columns
    op.drop_column("compliance_report_summary", "credits_offset_b")
    op.drop_column("compliance_report_summary", "credits_offset_c")
    op.drop_column("compliance_report_summary", "credits_offset_a")

    # Ensure role exists before recreating views
    create_role_if_not_exists()

    # Recreate all the views
    try:
        content = find_and_read_sql_file(sqlFile="metabase.sql")
        sections = parse_sql_sections(content)

        # Recreate views in dependency order
        views_to_recreate = [
            "Compliance Report Base View",
            "Allocation Agreement Base View",
            "Compliance Report Fuel Supply Base View",
            "Compliance Report Chained View",
            "Allocation Agreement Chained View",
        ]

        for view in views_to_recreate:
            try:
                execute_sql_sections(sections, [view])
            except Exception as e:
                print(f"Warning: Could not recreate view '{view}': {e}")

    except Exception as e:
        print(f"Error recreating views: {e}")


def downgrade() -> None:
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_a", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_c", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "compliance_report_summary",
        sa.Column("credits_offset_b", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.drop_column("compliance_report_summary", "historical_snapshot")
