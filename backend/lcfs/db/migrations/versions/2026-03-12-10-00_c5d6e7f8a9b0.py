"""Add missing EER records for Biodiesel, Ethanol, HDRD, Renewable gasoline, Renewable naphtha (2019-2023)

These fuel types all have EER=1.0 in TFRS (they fall under "Petroleum-based diesel/gasoline"
categories). They were omitted from the original EER backfill migration (a7c9e2f8b3d1).

Revision ID: c5d6e7f8a9b0
Revises: b4e7f1a2c9d6
Create Date: 2026-03-02 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c5d6e7f8a9b0"
down_revision = "b4e7f1a2c9d6"
branch_labels = None
depends_on = None

# Fuel Types: 1=Biodiesel, 4=Ethanol, 5=HDRD, 14=Renewable gasoline, 15=Renewable naphtha
# Fuel Categories: 1=Gasoline, 2=Diesel
# Compliance Periods: 10=2019, 11=2020, 12=2021, 13=2022, 14=2023

# EER records to add: (fuel_type_id, fuel_category_id, ratio)
# All have EER=1.0 and end_use_type_id=NULL for pre-2024
MISSING_EER_DATA = [
    (1, 2, 1.0),   # Biodiesel - Diesel
    (4, 1, 1.0),   # Ethanol - Gasoline
    (5, 2, 1.0),   # HDRD - Diesel
    (14, 1, 1.0),  # Renewable gasoline - Gasoline
    (15, 1, 1.0),  # Renewable naphtha - Gasoline
]

COMPLIANCE_PERIOD_IDS = [10, 11, 12, 13, 14]  # 2019-2023


def upgrade() -> None:
    for cp_id in COMPLIANCE_PERIOD_IDS:
        for fuel_type_id, fuel_category_id, ratio in MISSING_EER_DATA:
            op.execute(
                sa.text("""
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
                        :fuel_category_id,
                        :fuel_type_id,
                        NULL,
                        :cp_id,
                        :ratio,
                        'migration_backfill',
                        'migration_backfill',
                        true
                    )
                    ON CONFLICT (compliance_period_id, fuel_type_id, fuel_category_id, end_use_type_id)
                    DO NOTHING
                """).bindparams(
                    fuel_category_id=fuel_category_id,
                    fuel_type_id=fuel_type_id,
                    cp_id=cp_id,
                    ratio=ratio,
                )
            )


def downgrade() -> None:
    for cp_id in COMPLIANCE_PERIOD_IDS:
        for fuel_type_id, fuel_category_id, ratio in MISSING_EER_DATA:
            op.execute(
                sa.text("""
                    DELETE FROM energy_effectiveness_ratio
                    WHERE fuel_type_id = :fuel_type_id
                      AND fuel_category_id = :fuel_category_id
                      AND compliance_period_id = :cp_id
                      AND end_use_type_id IS NULL
                      AND create_user = 'migration_backfill'
                """).bindparams(
                    fuel_type_id=fuel_type_id,
                    fuel_category_id=fuel_category_id,
                    cp_id=cp_id,
                )
            )
