"""add compliance period to uci

Revision ID: 44c6f23b71d3
Revises: f0d95904a9dd
Create Date: 2025-02-11 23:51:48.841478

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "44c6f23b71d3"
down_revision = "f0d95904a9dd"
branch_labels = None
depends_on = None


def upgrade():
    # Add new column (initially nullable) to store compliance period
    op.add_column(
        'additional_carbon_intensity',
        sa.Column('compliance_period_id', sa.Integer(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_additional_ci_compliance_period',
        'additional_carbon_intensity',
        'compliance_period',
        ['compliance_period_id'],
        ['compliance_period_id']
    )

    connection = op.get_bind()

    # Get the compliance period for 2024 when the UCI was first introduced
    target_year = "2024"
    result = connection.execute(
        text("""
            SELECT compliance_period_id 
            FROM compliance_period 
            WHERE description = :year
        """),
        {"year": target_year}
    )
    compliance_period_id = result.scalar_one()

    if not compliance_period_id:
        raise Exception(f"Compliance period for year {target_year} not found")

    # Update all existing UCI records with the compliance period
    connection.execute(
        text("""
            UPDATE additional_carbon_intensity
            SET compliance_period_id = :period_id
            WHERE compliance_period_id IS NULL
        """),
        {"period_id": compliance_period_id}
    )

    # Verify the update
    null_count = connection.execute(
        text("""
            SELECT COUNT(*) 
            FROM additional_carbon_intensity 
            WHERE compliance_period_id IS NULL
        """)
    ).scalar()

    if null_count > 0:
        raise Exception(
            f"Migration failed: {null_count} records still have null compliance_period_id"
        )

    # Make column not nullable only after verification
    op.alter_column(
        'additional_carbon_intensity',
        'compliance_period_id',
        existing_type=sa.Integer(),
        nullable=False
    )

    # Create unique constraint
    op.create_unique_constraint(
        'uq_additional_ci_compliance_fuel_enduse',
        'additional_carbon_intensity',
        ['compliance_period_id', 'fuel_type_id', 'end_use_type_id']
    )


def downgrade():
    op.drop_constraint(
        'uq_additional_ci_compliance_fuel_enduse',
        'additional_carbon_intensity',
        type_='unique'
    )
    op.drop_constraint(
        'fk_additional_ci_compliance_period',
        'additional_carbon_intensity',
        type_='foreignkey'
    )
    op.drop_column('additional_carbon_intensity', 'compliance_period_id')