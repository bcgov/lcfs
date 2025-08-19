"""Extend lookup tables to 2030

Revision ID: 988aeb471e14
Revises: e5799ecd8dda
Create Date: 2025-08-19 10:52:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "988aeb471e14"
down_revision = "e5799ecd8dda"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend energy_density table from 2024 (id=15) to 2030 (id=21)
    # Using the same values from latest year
    op.execute(
        """
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
                WHEN ft.fuel_type = 'Biodiesel' THEN 35.4
                WHEN ft.fuel_type = 'CNG' THEN 37.85
                WHEN ft.fuel_type = 'Electricity' THEN 3.6
                WHEN ft.fuel_type = 'Ethanol' THEN 23.58
                WHEN ft.fuel_type = 'Hydrogen' THEN 141.24
                WHEN ft.fuel_type = 'HDRD' THEN 36.51
                WHEN ft.fuel_type = 'LNG' THEN 52.46
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 38.65
                WHEN ft.fuel_type = 'Diesel from biomass' THEN 38.65
                WHEN ft.fuel_type = 'Fossil-derived diesel' THEN 38.65
                WHEN ft.fuel_type = 'Petroleum-based gasoline' THEN 34.69
                WHEN ft.fuel_type = 'Propane' THEN 25.47
                WHEN ft.fuel_type = 'Fossil-derived gasoline' THEN 34.69
            END AS density,
            CASE
                WHEN ft.fuel_type IN ('Biodiesel', 'HDRD', 'Ethanol', 'Petroleum-based diesel', 
                                      'Petroleum-based gasoline', 'Propane', 'Diesel from biomass',
                                      'Fossil-derived diesel', 'Fossil-derived gasoline') THEN 1
                WHEN ft.fuel_type = 'Electricity' THEN 2
                WHEN ft.fuel_type = 'CNG' THEN 3
                WHEN ft.fuel_type IN ('Hydrogen', 'LNG') THEN 4
                ELSE 1
            END AS uom_id,
            'migration_extend_2030',
            'migration_extend_2030'
        FROM fuel_type ft
        CROSS JOIN compliance_period cp
        WHERE cp.compliance_period_id BETWEEN 16 AND 21
        AND ft.fuel_type IN (
            'Biodiesel', 'CNG', 'Electricity', 'Ethanol', 'Hydrogen', 'HDRD', 'LNG',
            'Petroleum-based diesel', 'Diesel from biomass', 'Fossil-derived diesel',
            'Petroleum-based gasoline', 'Propane', 'Fossil-derived gasoline'
        )
        AND NOT EXISTS (
            SELECT 1 FROM energy_density ed
            WHERE ed.fuel_type_id = ft.fuel_type_id
            AND ed.compliance_period_id = cp.compliance_period_id
        );
    """
    )

    # Extend energy_effectiveness_ratio table from 2026 (id=17) to 2030 (id=21)
    op.execute(
        """
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
                
                ELSE NULL
            END AS ratio,
            'migration_extend_2030' AS create_user,
            'migration_extend_2030' AS update_user,
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
            cp.compliance_period_id BETWEEN 18 AND 21
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
            AND NOT EXISTS (
                SELECT 1 FROM energy_effectiveness_ratio eer
                WHERE eer.fuel_type_id = ft.fuel_type_id
                AND eer.fuel_category_id = fc.fuel_category_id
                AND eer.end_use_type_id = eut.end_use_type_id
                AND eer.compliance_period_id = cp.compliance_period_id
            );
    """
    )

    # Extend default_carbon_intensity table from 2026 (id=17) to 2030 (id=21)
    # Using the same values as 2025-2026 period
    op.execute(
        """
        INSERT INTO default_carbon_intensity (
            compliance_period_id,
            fuel_type_id,
            default_carbon_intensity,
            effective_date,
            expiration_date,
            effective_status,
            create_user,
            update_user
        )
        SELECT
            cp.compliance_period_id,
            ft.fuel_type_id,
            CASE
                WHEN ft.fuel_type = 'CNG' THEN 63.91
                WHEN ft.fuel_type = 'Electricity' THEN 12.14
                WHEN ft.fuel_type = 'Hydrogen' THEN 123.96
                WHEN ft.fuel_type = 'LNG' THEN 90.11
                WHEN ft.fuel_type = 'Propane' THEN 79.87
                WHEN ft.fuel_type = 'Fossil-derived diesel' THEN 94.38
                WHEN ft.fuel_type = 'Fossil-derived gasoline' THEN 93.67
                WHEN ft.fuel_type = 'Fossil-derived jet fuel' THEN 88.83
                WHEN ft.fuel_type = 'Alternative jet fuel' THEN 88.83
                WHEN ft.fuel_type = 'Biodiesel' THEN 100.21
                WHEN ft.fuel_type = 'Ethanol' THEN 93.67
                WHEN ft.fuel_type = 'HDRD' THEN 100.21
                WHEN ft.fuel_type = 'Other diesel fuel' THEN 100.21
                WHEN ft.fuel_type = 'Renewable gasoline' THEN 93.67
                WHEN ft.fuel_type = 'Renewable naphtha' THEN 93.67
            END AS default_carbon_intensity,
            cp.effective_date,
            cp.expiration_date,
            TRUE,
            'migration_extend_2030',
            'migration_extend_2030'
        FROM fuel_type ft
        CROSS JOIN compliance_period cp
        WHERE cp.compliance_period_id BETWEEN 18 AND 21
        AND ft.fuel_type IN (
            'CNG', 'Electricity', 'Hydrogen', 'LNG', 'Propane',
            'Fossil-derived diesel', 'Fossil-derived gasoline',
            'Fossil-derived jet fuel', 'Alternative jet fuel', 'Biodiesel', 'Ethanol',
            'HDRD', 'Other diesel fuel', 'Renewable gasoline', 'Renewable naphtha'
        )
        AND NOT EXISTS (
            SELECT 1 FROM default_carbon_intensity dci
            WHERE dci.fuel_type_id = ft.fuel_type_id
            AND dci.compliance_period_id = cp.compliance_period_id
        );
    """
    )

    # Extend category_carbon_intensity table from 2026 (id=17) to 2030 (id=21)
    # Using the same values as 2025-2026 period
    op.execute(
        """
        INSERT INTO category_carbon_intensity (
            compliance_period_id,
            fuel_category_id,
            category_carbon_intensity,
            effective_date,
            expiration_date,
            effective_status,
            create_user,
            update_user
        )
        SELECT
            cp.compliance_period_id,
            fc.fuel_category_id,
            CASE
                WHEN fc.category = 'Gasoline' THEN 93.67
                WHEN fc.category = 'Diesel' THEN 100.21
                WHEN fc.category = 'Jet fuel' THEN 88.83
            END AS category_carbon_intensity,
            cp.effective_date,
            cp.expiration_date,
            TRUE,
            'migration_extend_2030',
            'migration_extend_2030'
        FROM fuel_category fc
        CROSS JOIN compliance_period cp
        WHERE cp.compliance_period_id BETWEEN 18 AND 21
        AND fc.category IN ('Gasoline', 'Diesel', 'Jet fuel')
        AND NOT EXISTS (
            SELECT 1 FROM category_carbon_intensity cci
            WHERE cci.fuel_category_id = fc.fuel_category_id
            AND cci.compliance_period_id = cp.compliance_period_id
        );
    """
    )

    print("Successfully extended lookup tables to 2030 (compliance_period_id 21)")


def downgrade() -> None:
    # Remove the records added by this migration
    op.execute(
        """
        DELETE FROM energy_density 
        WHERE create_user = 'migration_extend_2030';
    """
    )

    op.execute(
        """
        DELETE FROM energy_effectiveness_ratio 
        WHERE create_user = 'migration_extend_2030';
    """
    )

    op.execute(
        """
        DELETE FROM default_carbon_intensity 
        WHERE create_user = 'migration_extend_2030';
    """
    )

    op.execute(
        """
        DELETE FROM category_carbon_intensity 
        WHERE create_user = 'migration_extend_2030';
    """
    )

    print("Successfully rolled back lookup table extensions")
