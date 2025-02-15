"""Add compliance period to energy tables

Revision ID: 9e1da9e38f20
Revises: 44c6f23b71d3
Create Date: 2025-02-12 11:01:01.472659

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "9e1da9e38f20"
down_revision = "f0d95904a9dd"
branch_labels = None
depends_on = None


def upgrade():
    # Add columns
    op.add_column('energy_density',
        sa.Column('compliance_period_id', sa.Integer(), nullable=True))
    op.add_column('energy_effectiveness_ratio',
        sa.Column('compliance_period_id', sa.Integer(), nullable=True))

    # Add foreign key constraints
    op.create_foreign_key(
        'fk_energy_density_compliance_period',
        'energy_density', 'compliance_period',
        ['compliance_period_id'], ['compliance_period_id']
    )
    op.create_foreign_key(
        'fk_eer_compliance_period',
        'energy_effectiveness_ratio', 'compliance_period',
        ['compliance_period_id'], ['compliance_period_id']
    )

    # Create unique constraints
    op.create_unique_constraint(
        'uq_energy_density_compliance_fuel',
        'energy_density',
        ['compliance_period_id', 'fuel_type_id']
    )
    op.create_unique_constraint(
        'uq_eer_compliance_fuel_category_enduse',
        'energy_effectiveness_ratio',
        ['compliance_period_id', 'fuel_type_id', 'fuel_category_id', 'end_use_type_id']
    )

    # Update existing energy_density rows that have NULL compliance_period_id to '2024'
    op.execute("""
        UPDATE energy_density
        SET compliance_period_id = (
            SELECT compliance_period_id 
            FROM compliance_period
            WHERE description = '2024'
            LIMIT 1
        )
        WHERE compliance_period_id IS NULL;
    """)

    op.alter_column('energy_density', 'compliance_period_id', nullable=False)

    op.execute("""
        INSERT INTO energy_density (
            fuel_type_id,
            compliance_period_id,
            density,
            uom_id,
            create_user,
            update_user
        )
        SELECT
            ft.fuel_type_id,
            cp.compliance_period_id,
            CASE
                WHEN ft.fuel_type = 'Biodiesel' AND cp.compliance_period_id BETWEEN 4 AND 7 THEN 36.94
                WHEN ft.fuel_type = 'Biodiesel' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 35.4
                WHEN ft.fuel_type = 'CNG' AND cp.compliance_period_id BETWEEN 4 AND 7 THEN 38.26
                WHEN ft.fuel_type = 'CNG' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 37.85
                WHEN ft.fuel_type = 'Electricity' THEN 3.6
                WHEN ft.fuel_type = 'Ethanol' THEN 23.58
                WHEN ft.fuel_type = 'Hydrogen' AND cp.compliance_period_id BETWEEN 4 AND 7 THEN 120
                WHEN ft.fuel_type = 'Hydrogen' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 141.24
                WHEN ft.fuel_type = 'HDRD' THEN 36.51
                WHEN ft.fuel_type = 'LNG' AND cp.compliance_period_id BETWEEN 3 AND 7 THEN 52.87
                WHEN ft.fuel_type = 'LNG' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 52.46
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 38.65
                WHEN ft.fuel_type = 'Diesel from biomass' THEN 38.65
                WHEN ft.fuel_type = 'Fossil-derived diesel' THEN 38.65
                WHEN ft.fuel_type = 'Petroleum-based gasoline' THEN 34.69
                WHEN ft.fuel_type = 'Propane' AND cp.compliance_period_id BETWEEN 3 AND 7 THEN 25.59
                WHEN ft.fuel_type = 'Propane' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 25.47
                WHEN ft.fuel_type = 'Fossil-derived gasoline' THEN 34.69
            END AS density,
            CASE
                WHEN ft.fuel_type IN ('Biodiesel', 'HDRD', 'Ethanol', 'Petroleum-based diesel', 'Petroleum-based gasoline', 'Propane') THEN 1
                WHEN ft.fuel_type = 'Electricity' THEN 2
                WHEN ft.fuel_type = 'CNG' THEN 3
                WHEN ft.fuel_type = 'Hydrogen' THEN 4
                WHEN ft.fuel_type = 'LNG' THEN 4
                ELSE 1 -- Default unit of measure to prevent NULL values
            END AS uom_id,
            'admin',
            'admin'
        FROM fuel_type ft
        CROSS JOIN compliance_period cp
        WHERE cp.compliance_period_id BETWEEN 4 AND 14
        AND (
            CASE 
                -- Ensure we do not insert NULL densities 2013 -> 4
                WHEN ft.fuel_type = 'Biodiesel' AND cp.compliance_period_id BETWEEN 4 AND 7 THEN 36.94
                WHEN ft.fuel_type = 'Biodiesel' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 35.4
                WHEN ft.fuel_type = 'CNG' AND cp.compliance_period_id BETWEEN 4 AND 7 THEN 38.26
                WHEN ft.fuel_type = 'CNG' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 37.85
                WHEN ft.fuel_type = 'Electricity' THEN 3.6
                WHEN ft.fuel_type = 'Ethanol' THEN 23.58
                WHEN ft.fuel_type = 'Hydrogen' AND cp.compliance_period_id BETWEEN 4 AND 7 THEN 120
                WHEN ft.fuel_type = 'Hydrogen' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 141.24
                WHEN ft.fuel_type = 'HDRD' THEN 36.51
                WHEN ft.fuel_type = 'LNG' AND cp.compliance_period_id BETWEEN 3 AND 7 THEN 52.87
                WHEN ft.fuel_type = 'LNG' AND cp.compliance_period_id BETWEEN 8 AND 14 THEN 52.46
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 38.65
                WHEN ft.fuel_type = 'Diesel from biomass' THEN 38.65
                WHEN ft.fuel_type = 'Fossil-derived diesel' THEN 38.65
                WHEN ft.fuel_type = 'Petroleum-based gasoline' THEN 34.69
                WHEN ft.fuel_type = 'Propane' AND cp.compliance_period_id BETWEEN 3 AND 6 THEN 25.59
                WHEN ft.fuel_type = 'Propane' AND cp.compliance_period_id BETWEEN 7 AND 14 THEN 25.47
                WHEN ft.fuel_type = 'Fossil-derived gasoline' THEN 34.69
            END
        ) IS NOT NULL;
    """)

    op.execute("""
        UPDATE energy_effectiveness_ratio
        SET compliance_period_id = (
            SELECT compliance_period_id 
            FROM compliance_period
            WHERE description = '2024'
            LIMIT 1
        )
        WHERE compliance_period_id IS NULL;
    """)

    op.alter_column('energy_effectiveness_ratio', 'compliance_period_id', nullable=False)
    
    op.execute("""
        INSERT INTO energy_effectiveness_ratio (
            fuel_category_id,
            fuel_type_id,
            end_use_type_id,
            compliance_period_id,
            ratio,
            create_user,
            update_user,
            effective_status
        )
        SELECT 
            fc.fuel_category_id,
            ft.fuel_type_id,
            eut.end_use_type_id,
            cp.compliance_period_id,
            CASE
                -- CNG Categories
                WHEN ft.fuel_type = 'CNG' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 0.9
                WHEN ft.fuel_type = 'CNG' AND fc.category = 'Gasoline' AND eut."type" = 'Any' THEN 1.0

                -- Hydrogen - Diesel
                WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Diesel' AND eut."type" = 'Fuel cell vehicle' THEN 1.8
                WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Diesel' AND eut."type" = 'Other or unknown' THEN 0.9

                -- Hydrogen - Gasoline
                WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Gasoline' AND eut."type" = 'Fuel cell' THEN 2.4
                WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Gasoline' AND eut."type" = 'Other or unknown' THEN 0.9

                -- LNG - Diesel
                WHEN ft.fuel_type = 'LNG' AND fc.category = 'Diesel' AND eut."type" = 'Compression-ignition engine' THEN 1.0
                WHEN ft.fuel_type = 'LNG' AND fc.category = 'Diesel' AND eut."type" = 'Unknown engine type' THEN 0.9

                -- Petroleum-based Diesel / Gasoline
                WHEN ft.fuel_type = 'Petroleum-based diesel' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 1.0
                WHEN ft.fuel_type = 'Petroleum-based diesel' AND fc.category = 'Gasoline' AND eut."type" = 'Any' THEN 1.0
                WHEN ft.fuel_type = 'Petroleum-based gasoline' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 1.0
                WHEN ft.fuel_type = 'Petroleum-based gasoline' AND fc.category = 'Gasoline' AND eut."type" = 'Any' THEN 1.0

                -- Propane - Diesel / Gasoline
                WHEN ft.fuel_type = 'Propane' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 0.9
                WHEN ft.fuel_type = 'Propane' AND fc.category = 'Gasoline' AND eut."type" = 'Any' THEN 0.9

                ELSE NULL  -- Ensure NULL values are not inserted
            END AS ratio,
            'admin' AS create_user,
            'admin' AS update_user,
            TRUE AS effective_status
        FROM 
            fuel_type ft
        CROSS JOIN 
            compliance_period cp
        CROSS JOIN 
            fuel_category fc
        CROSS JOIN 
            end_use_type eut
        WHERE 
            cp.compliance_period_id BETWEEN 4 AND 14
            AND (
                (ft.fuel_type = 'CNG' AND fc.category = 'Diesel' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'CNG' AND fc.category = 'Gasoline' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'Hydrogen' AND fc.category = 'Diesel' AND eut."type" = 'Fuel cell vehicle')
                OR (ft.fuel_type = 'Hydrogen' AND fc.category = 'Diesel' AND eut."type" = 'Other or unknown')
                OR (ft.fuel_type = 'Hydrogen' AND fc.category = 'Gasoline' AND eut."type" = 'Fuel cell')
                OR (ft.fuel_type = 'Hydrogen' AND fc.category = 'Gasoline' AND eut."type" = 'Other or unknown')
                OR (ft.fuel_type = 'LNG' AND fc.category = 'Diesel' AND eut."type" = 'Compression-ignition engine')
                OR (ft.fuel_type = 'LNG' AND fc.category = 'Diesel' AND eut."type" = 'Unknown engine type')
                OR (ft.fuel_type = 'Petroleum-based diesel' AND fc.category = 'Diesel' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'Petroleum-based diesel' AND fc.category = 'Gasoline' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'Petroleum-based gasoline' AND fc.category = 'Diesel' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'Petroleum-based gasoline' AND fc.category = 'Gasoline' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'Propane' AND fc.category = 'Diesel' AND eut."type" = 'Any')
                OR (ft.fuel_type = 'Propane' AND fc.category = 'Gasoline' AND eut."type" = 'Any')
            )
            -- Filter out NULL ratio values
            AND (
                CASE
                    WHEN ft.fuel_type = 'CNG' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 0.9
                    WHEN ft.fuel_type = 'CNG' AND fc.category = 'Gasoline' AND eut."type" = 'Any' THEN 1.0
                    WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Diesel' AND eut."type" = 'Fuel cell vehicle' THEN 1.8
                    WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Diesel' AND eut."type" = 'Other or unknown' THEN 0.9
                    WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Gasoline' AND eut."type" = 'Fuel cell' THEN 2.4
                    WHEN ft.fuel_type = 'Hydrogen' AND fc.category = 'Gasoline' AND eut."type" = 'Other or unknown' THEN 0.9
                    WHEN ft.fuel_type = 'LNG' AND fc.category = 'Diesel' AND eut."type" = 'Compression-ignition engine' THEN 1.0
                    WHEN ft.fuel_type = 'LNG' AND fc.category = 'Diesel' AND eut."type" = 'Unknown engine type' THEN 0.9
                    WHEN ft.fuel_type = 'Petroleum-based diesel' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 1.0
                    WHEN ft.fuel_type = 'Propane' AND fc.category = 'Diesel' AND eut."type" = 'Any' THEN 0.9
                    ELSE NULL
                END
            ) IS NOT NULL;
    """)

def downgrade():
    # Delete only the inserted records from energy_effectiveness_ratio
    op.execute("""
        DELETE FROM energy_density 
        WHERE compliance_period_id BETWEEN 4 AND 14;
    """)
    # Delete only the inserted records from energy_effectiveness_ratio
    op.execute("""
        DELETE FROM energy_effectiveness_ratio 
        WHERE compliance_period_id BETWEEN 4 AND 14;
    """)
    op.drop_constraint('uq_eer_compliance_fuel_category_enduse',
        'energy_effectiveness_ratio', type_='unique')
    op.drop_constraint('uq_energy_density_compliance_fuel',
        'energy_density', type_='unique')
    op.drop_constraint('fk_eer_compliance_period',
        'energy_effectiveness_ratio', type_='foreignkey')
    op.drop_constraint('fk_energy_density_compliance_period',
        'energy_density', type_='foreignkey')
    op.drop_column('energy_effectiveness_ratio', 'compliance_period_id')
    op.drop_column('energy_density', 'compliance_period_id')
