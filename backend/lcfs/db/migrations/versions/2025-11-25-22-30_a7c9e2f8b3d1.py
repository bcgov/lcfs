"""Backfill EER, Energy Density, and TCI data for 2019-2023

This migration adds historical Energy Effectiveness Ratio (EER), Energy Density,
and Target Carbon Intensity data for compliance periods 2019-2023 to support
historical supplemental reports.

NOTE: Values from business area spreadsheet - verify before running.

Revision ID: a7c9e2f8b3d1
Revises: 8e530edb155f
Create Date: 2025-11-25 22:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a7c9e2f8b3d1"
down_revision = "8e530edb155f"
branch_labels = None
depends_on = None

# =============================================================================
# Reference IDs from database:
# =============================================================================
# Fuel Types:
#   2=CNG, 3=Electricity, 6=Hydrogen, 7=LNG, 13=Propane,
#   21=Natural gas-based gasoline, 22=Petroleum-based diesel,
#   23=Petroleum-based gasoline
#   (Biodiesel=1, Ethanol=4, HDRD=5 are 2024+ only for EER)
#
# Fuel Categories: 1=Gasoline, 2=Diesel, 3=Jet fuel
#
# Compliance Periods: 10=2019, 11=2020, 12=2021, 13=2022, 14=2023, 15=2024
#
# UOM: 1=MJ/L, 2=MJ/kWh, 3=MJ/m³, 4=MJ/kg
# =============================================================================

# EER values for 2019-2023 (from spreadsheet)
# Format: (fuel_type_id, fuel_category_id, end_use_type_id, ratio)
# end_use_type_id = NULL for pre-2024 (no end-use type breakdown)
EER_DATA_2019_2023 = [
    # CNG - diesel class: 0.9
    (2, 2, None, 0.9),
    # CNG - gasoline class: 1.0 (NOTE: 2024 changed to 0.9)
    (2, 1, None, 1.0),
    # Electricity - diesel class: 2.7 (no end-use type in pre-2024)
    (3, 2, None, 2.7),
    # Electricity - gasoline class: 3.4 (no end-use type in pre-2024)
    (3, 1, None, 3.4),
    # Hydrogen - diesel class: 1.9 (no end-use type in pre-2024)
    (6, 2, None, 1.9),
    # Hydrogen - gasoline class: 2.5 (no end-use type in pre-2024)
    (6, 1, None, 2.5),
    # LNG - diesel class: 1.0 (no end-use type in pre-2024)
    (7, 2, None, 1.0),
    # Petroleum-based diesel - diesel class: 1.0
    (22, 2, None, 1.0),
    # Petroleum-based diesel - gasoline class: N/A in old data, adding for completeness
    # (22, 1, None, 1.0),
    # Petroleum-based gasoline - gasoline class: 1.0
    (23, 1, None, 1.0),
    # Petroleum-based gasoline - diesel class: N/A in old data, adding for completeness
    # (23, 2, None, 1.0),
    # Natural gas-based gasoline - diesel class: appears in 2023 data
    (21, 2, None, 1.0),
    # Propane - diesel class: 1.0 (NOTE: 2024 changed to 0.9)
    (13, 2, None, 1.0),
    # Propane - gasoline class: 1.0 (NOTE: 2024 changed to 0.9)
    (13, 1, None, 1.0),
]

# Energy Density values for 2019-2023 (from spreadsheet, using 2017+ values)
# Format: (fuel_type_id, density, uom_id)
ENERGY_DENSITY_2019_2023 = [
    # Biodiesel: 35.4 MJ/L (2017-2023)
    (1, 35.4, 1),
    # CNG: 37.85 MJ/m³ (2017-2023, NOTE: 2024 is 38.27)
    (2, 37.85, 3),
    # Electricity: 3.6 MJ/kWh (same all years)
    (3, 3.6, 2),
    # Ethanol: 23.58 MJ/L (same all years)
    (4, 23.58, 1),
    # HDRD: 36.51 MJ/L (2013-2023, NOTE: 2024 is 37.89)
    (5, 36.51, 1),
    # Hydrogen: 141.24 MJ/kg (2017-2023, NOTE: 2024 is 141.76)
    (6, 141.24, 4),
    # LNG: 52.46 MJ/kg (2017-2023, NOTE: 2024 is 53.54)
    (7, 52.46, 4),
    # Propane: 25.47 MJ/L (2017-2023, NOTE: 2024 is 25.62)
    (13, 25.47, 1),
    # Renewable gasoline: 34.69 MJ/L (same as petroleum-based gasoline)
    (14, 34.69, 1),
    # Renewable naphtha: 32.76 MJ/L (2017-2023, NOTE: 2024 is 34.51)
    (15, 32.76, 1),
    # Natural gas-based gasoline: 34.69 MJ/L (same as petroleum-based gasoline)
    (21, 34.69, 1),
    # Petroleum-based diesel: 38.65 MJ/L (same all years)
    (22, 38.65, 1),
    # Petroleum-based gasoline: 34.69 MJ/L (same all years)
    (23, 34.69, 1),
    # Renewable diesel: 38.65 MJ/L (same as petroleum-based diesel)
    (24, 38.65, 1),
]

# Target Carbon Intensity by year (from spreadsheet)
# Format: {year: {fuel_category_id: target_ci}}
# fuel_category_id: 1=Gasoline, 2=Diesel
TARGET_CI_BY_YEAR = {
    2019: {2: 87.18, 1: 81.09},  # Diesel: 87.18, Gasoline: 81.09
    2020: {2: 86.15, 1: 80.13},  # Diesel: 86.15, Gasoline: 80.13
    2021: {2: 85.11, 1: 79.17},  # Diesel: 85.11, Gasoline: 79.17
    2022: {2: 84.04, 1: 78.20},  # Diesel: 84.04, Gasoline: 78.20
    2023: {2: 81.86, 1: 76.14},  # Diesel: 81.86, Gasoline: 76.14
}

# Compliance period ID mapping
YEAR_TO_CP_ID = {
    2019: 10,
    2020: 11,
    2021: 12,
    2022: 13,
    2023: 14,
}


def upgrade() -> None:
    """
    Backfill EER, Energy Density, and Target Carbon Intensity data for 2019-2023.
    Uses historical values from business area spreadsheet.
    """

    # Insert EER data for each year from 2019-2023
    for year, cp_id in YEAR_TO_CP_ID.items():
        for fuel_type_id, fuel_category_id, end_use_type_id, ratio in EER_DATA_2019_2023:
            if end_use_type_id is None:
                op.execute(f"""
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
                    VALUES (
                        {fuel_category_id},
                        {fuel_type_id},
                        NULL,
                        {cp_id},
                        {ratio},
                        'migration_backfill',
                        'migration_backfill',
                        true
                    )
                    ON CONFLICT (compliance_period_id, fuel_type_id, fuel_category_id, end_use_type_id)
                    DO NOTHING;
                """)
            else:
                op.execute(f"""
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
                    VALUES (
                        {fuel_category_id},
                        {fuel_type_id},
                        {end_use_type_id},
                        {cp_id},
                        {ratio},
                        'migration_backfill',
                        'migration_backfill',
                        true
                    )
                    ON CONFLICT (compliance_period_id, fuel_type_id, fuel_category_id, end_use_type_id)
                    DO NOTHING;
                """)

    # Insert Energy Density data for each year from 2019-2023
    for year, cp_id in YEAR_TO_CP_ID.items():
        for fuel_type_id, density, uom_id in ENERGY_DENSITY_2019_2023:
            op.execute(f"""
                INSERT INTO energy_density (
                    fuel_type_id,
                    compliance_period_id,
                    density,
                    uom_id,
                    create_user,
                    update_user
                )
                VALUES (
                    {fuel_type_id},
                    {cp_id},
                    {density},
                    {uom_id},
                    'migration_backfill',
                    'migration_backfill'
                )
                ON CONFLICT (compliance_period_id, fuel_type_id)
                DO NOTHING;
            """)

    # Insert Target Carbon Intensity data for each year from 2019-2023
    for year, cp_id in YEAR_TO_CP_ID.items():
        for fuel_category_id, target_ci in TARGET_CI_BY_YEAR[year].items():
            op.execute(f"""
                INSERT INTO target_carbon_intensity (
                    fuel_category_id,
                    compliance_period_id,
                    target_carbon_intensity,
                    reduction_target_percentage,
                    create_user,
                    update_user,
                    effective_status
                )
                VALUES (
                    {fuel_category_id},
                    {cp_id},
                    {target_ci},
                    0,
                    'migration_backfill',
                    'migration_backfill',
                    true
                )
                ON CONFLICT (compliance_period_id, fuel_category_id)
                DO NOTHING;
            """)


def downgrade() -> None:
    """
    Remove the backfilled EER, energy_density, and target_carbon_intensity
    data for 2019-2023 that was created by this migration.
    """

    # Remove backfilled EER data
    op.execute("""
        DELETE FROM energy_effectiveness_ratio
        WHERE compliance_period_id BETWEEN 10 AND 14  -- 2019-2023
        AND create_user = 'migration_backfill';
    """)

    # Remove backfilled energy_density data
    op.execute("""
        DELETE FROM energy_density
        WHERE compliance_period_id BETWEEN 10 AND 14  -- 2019-2023
        AND create_user = 'migration_backfill';
    """)

    # Remove backfilled target_carbon_intensity data
    op.execute("""
        DELETE FROM target_carbon_intensity
        WHERE compliance_period_id BETWEEN 10 AND 14  -- 2019-2023
        AND create_user = 'migration_backfill';
    """)
