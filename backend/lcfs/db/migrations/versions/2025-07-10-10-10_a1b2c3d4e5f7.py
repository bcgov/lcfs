"""Adds organization_early_issuance_by_year table, extends compliance periods to 2050, and migrates early issuance flags.

Revision ID: a1b2c3d4e5f7
Revises: 07cce665fabc
Create Date: 2025-07-10 10:10:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f7"
down_revision = "07cce665fabc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add remaining compliance periods from 2033 to 2050 (previously added until 2032)
    dates = [(year, f"{year}-01-01", f"{year}-12-31") for year in range(2033, 2051)]
    for i, (year, start_date, end_date) in enumerate(dates, 24):
        op.execute(
            f"""
            INSERT INTO compliance_period (
                compliance_period_id, description, display_order,
                effective_date, expiration_date, effective_status
            )
            VALUES (
                {i}, '{year}', {i},
                '{start_date}', '{end_date}', TRUE
            )
            ON CONFLICT (compliance_period_id) DO NOTHING;
        """
        )

    # Create organization_early_issuance_by_year table
    op.create_table(
        "organization_early_issuance_by_year",
        sa.Column(
            "early_issuance_by_year_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the early issuance by year record",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the organization",
        ),
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key to the compliance period",
        ),
        sa.Column(
            "has_early_issuance",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
            comment="True if the organization can create early issuance reports for this compliance year",
        ),
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
            comment="Date and time (UTC) when the physical record was updated in the database.",
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
        sa.PrimaryKeyConstraint("early_issuance_by_year_id"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name="fk_organization_early_issuance_by_year_organization_id",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
            name="fk_organization_early_issuance_by_year_compliance_period_id",
        ),
        sa.UniqueConstraint(
            "organization_id",
            "compliance_period_id",
            name="uq_organization_early_issuance_by_year",
        ),
        comment="Tracks early issuance reporting eligibility by organization and compliance year",
    )

    # Copy all has_early_issuance values from organization table
    # to organization_early_issuance_by_year table for the current year (2025)
    op.execute(
        """
        INSERT INTO organization_early_issuance_by_year (
            organization_id, 
            compliance_period_id, 
            has_early_issuance,
            create_user,
            update_user
        )
        SELECT 
            o.organization_id,
            cp.compliance_period_id,
            COALESCE(o.has_early_issuance, FALSE) as has_early_issuance,
            'migration_a1b2c3d4e5f7' as create_user,
            'migration_a1b2c3d4e5f7' as update_user
        FROM organization o
        CROSS JOIN compliance_period cp
        WHERE cp.description = '2025'
        ON CONFLICT (organization_id, compliance_period_id) DO UPDATE SET
            has_early_issuance = EXCLUDED.has_early_issuance,
            update_user = EXCLUDED.update_user,
            update_date = now();
        """
    )


def downgrade() -> None:
    # Note: We don't need to revert the compliance periods (2033-2050) as they are reference data
    # and may be used by other parts of the system

    # Clean up data migration: Remove records created by this migration
    op.execute(
        """
        DELETE FROM organization_early_issuance_by_year 
        WHERE create_user = 'migration_a1b2c3d4e5f7'
        """
    )

    op.drop_table("organization_early_issuance_by_year")
