"""Add legacy fuel types

Revision ID: fa98709e7952
Revises: 94306eca5261
Create Date: 2025-01-06 22:09:52.936619

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "fa98709e7952"
down_revision = "94306eca5261"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO fuel_type (
            fuel_type,
            fossil_derived,
            other_uses_fossil_derived,
            default_carbon_intensity,
            units,
            unrecognized,
            create_user,
            update_user,
            is_legacy
        )
        VALUES
        -- 1) Natural gas-based gasoline
        (
            'Natural gas-based gasoline',
            FALSE,
            TRUE,
            90.07,
            'Litres',
            FALSE,
            'no_user',
            'no_user',
            TRUE
        ),
        -- 2) Petroleum-based diesel
        (
            'Petroleum-based diesel',
            FALSE,
            TRUE,
            94.76,
            'Litres',
            FALSE,
            'no_user',
            'no_user',
            TRUE
        ),
        -- 3) Petroleum-based gasoline
        (
            'Petroleum-based gasoline',
            FALSE,
            TRUE,
            88.14,
            'Litres',
            FALSE,
            'no_user',
            'no_user',
            TRUE
        );
        """
    )

    op.execute(
        """
        INSERT INTO energy_density (
            fuel_type_id,
            density,
            uom_id,
            create_user,
            update_user
        )
        SELECT
            ft.fuel_type_id,
            CASE
                WHEN ft.fuel_type = 'Natural gas-based gasoline' THEN 34.69
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 38.65
                WHEN ft.fuel_type = 'Petroleum-based gasoline' THEN 34.69
            END AS density,
            1 AS uom_id,
            'no_user' AS create_user,
            'no_user' AS update_user
        FROM fuel_type ft
        WHERE ft.fuel_type IN (
            'Natural gas-based gasoline',
            'Petroleum-based diesel',
            'Petroleum-based gasoline'
        );
        """
    )

    op.execute(
        """
        INSERT INTO energy_effectiveness_ratio (
            fuel_category_id,
            fuel_type_id,
            end_use_type_id,
            ratio,
            create_user,
            update_user,
            effective_date,
            effective_status,
            expiration_date
        )
        SELECT
            CASE
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 2
                ELSE 1
            END AS fuel_category_id,
            ft.fuel_type_id,
            NULL AS end_use_type_id,
            1.0 AS ratio,
            'no_user' AS create_user,
            'no_user' AS update_user,
            CURRENT_DATE AS effective_date,
            TRUE AS effective_status,
            NULL AS expiration_date
        FROM fuel_type ft
        WHERE ft.fuel_type IN (
            'Natural gas-based gasoline',
            'Petroleum-based diesel',
            'Petroleum-based gasoline'
        );
        """
    )


def downgrade():
    op.execute(
        """
        DELETE FROM energy_effectiveness_ratio
        WHERE fuel_type_id IN (
            SELECT fuel_type_id
            FROM fuel_type
            WHERE fuel_type IN (
                'Natural gas-based gasoline',
                'Petroleum-based diesel',
                'Petroleum-based gasoline'
            )
        );
        """
    )

    op.execute(
        """
        DELETE FROM energy_density
        WHERE fuel_type_id IN (
            SELECT fuel_type_id
            FROM fuel_type
            WHERE fuel_type IN (
                'Natural gas-based gasoline',
                'Petroleum-based diesel',
                'Petroleum-based gasoline'
            )
        );
        """
    )

    op.execute(
        """
        DELETE FROM fuel_type
        WHERE fuel_type IN (
            'Natural gas-based gasoline',
            'Petroleum-based diesel',
            'Petroleum-based gasoline'
        );
        """
    )
