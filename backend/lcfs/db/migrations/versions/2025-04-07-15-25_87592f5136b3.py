"""historical target carbon intensities

Revision ID: 87592f5136b3
Revises: 54d55e878dad
Create Date: 2025-04-07 15:25:24.384935

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "87592f5136b3"
down_revision = "54d55e878dad"
branch_labels = None
depends_on = None


def upgrade():
    # Insert historical gasoline values
    op.execute(
        sa.text(
            """
        INSERT INTO target_carbon_intensity (
            compliance_period_id,
            fuel_category_id,
            target_carbon_intensity,
            reduction_target_percentage,
            effective_status,
            create_date,
            update_date
        ) VALUES
        -- 2013 Gasoline
        (4, 2, 92.38, 0, true, NOW(), NOW()),
        -- 2014 Gasoline
        (5, 2, 92.38, 0, true, NOW(), NOW()),
        -- 2015 Gasoline
        (6, 2, 91.21, 0, true, NOW(), NOW()),
        -- 2016 Gasoline
        (7, 2, 90.28, 0, true, NOW(), NOW()),
        -- 2017 Gasoline
        (8, 2, 90.02, 0, true, NOW(), NOW()),
        -- 2018 Gasoline
        (9, 2, 88.60, 0, true, NOW(), NOW()),
        -- 2019 Gasoline
        (10, 2, 87.18, 0, true, NOW(), NOW()),
        -- 2020 Gasoline
        (11, 2, 85.28, 0, true, NOW(), NOW()),
        -- 2021 Gasoline
        (12, 2, 85.11, 0, true, NOW(), NOW()),
        -- 2022 Gasoline
        (13, 2, 84.00, 0, true, NOW(), NOW()),
        -- 2023 Gasoline
        (14, 2, 81.86, 0, true, NOW(), NOW());
    """
        )
    )

    # Insert historical diesel values
    op.execute(
        sa.text(
            """
        INSERT INTO target_carbon_intensity (
            compliance_period_id,
            fuel_category_id,
            target_carbon_intensity,
            reduction_target_percentage,
            effective_status,
            create_date,
            update_date
        ) VALUES
        -- 2013 Diesel
        (4, 1, 86.20, 0, true, NOW(), NOW()),
        -- 2014 Diesel
        (5, 1, 86.20, 0, true, NOW(), NOW()),
        -- 2015 Diesel
        (6, 1, 85.11, 0, true, NOW(), NOW()),
        -- 2016 Diesel
        (7, 1, 84.23, 0, true, NOW(), NOW()),
        -- 2017 Diesel
        (8, 1, 83.74, 0, true, NOW(), NOW()),
        -- 2018 Diesel
        (9, 1, 82.41, 0, true, NOW(), NOW()),
        -- 2019 Diesel
        (10, 1, 81.09, 0, true, NOW(), NOW()),
        -- 2020 Diesel
        (11, 1, 79.33, 0, true, NOW(), NOW()),
        -- 2021 Diesel
        (12, 1, 79.17, 0, true, NOW(), NOW()),
        -- 2022 Diesel
        (13, 1, 78.00, 0, true, NOW(), NOW()),
        -- 2023 Diesel
        (14, 1, 76.14, 0, true, NOW(), NOW());
    """
        )
    )


def downgrade():
    # Remove the imported historical values
    op.execute(
        sa.text(
            """
        DELETE FROM target_carbon_intensity
        WHERE compliance_period_id IN (4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14);
    """
        )
    )
