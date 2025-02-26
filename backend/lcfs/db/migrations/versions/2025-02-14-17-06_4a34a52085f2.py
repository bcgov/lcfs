"""Add default_carbon_intensity table

Revision ID: 4a34a52085f2
Revises: 44c6f23b71d3
Create Date: 2025-02-14 17:06:48.262364

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4a34a52085f2"
down_revision = "9e1da9e38f20"
branch_labels = None
depends_on = None


def upgrade():
    # Create table
    op.create_table(
        "default_carbon_intensity",
        sa.Column(
            "default_carbon_intensity_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("compliance_period_id", sa.Integer(), nullable=False),
        sa.Column("fuel_type_id", sa.Integer(), nullable=False),
        sa.Column("default_carbon_intensity", sa.Numeric(10, 2), nullable=False),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column("create_user", sa.String(length=500), nullable=True),
        sa.Column("update_user", sa.String(length=500), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column("expiration_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"], ["compliance_period.compliance_period_id"]
        ),
        sa.ForeignKeyConstraint(["fuel_type_id"], ["fuel_type.fuel_type_id"]),
        sa.PrimaryKeyConstraint("default_carbon_intensity_id"),
        sa.UniqueConstraint(
            "compliance_period_id",
            "fuel_type_id",
            name="uq_default_carbon_intensity_compliance_fueltype",
        ),
    )

    # Create category_carbon_intensity table
    op.create_table(
        "category_carbon_intensity",
        sa.Column(
            "category_carbon_intensity_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column("compliance_period_id", sa.Integer(), nullable=False),
        sa.Column("fuel_category_id", sa.Integer(), nullable=False),
        sa.Column("category_carbon_intensity", sa.Numeric(10, 2), nullable=False),
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column("create_user", sa.String(length=500), nullable=True),
        sa.Column("update_user", sa.String(length=500), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column("expiration_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"], ["compliance_period.compliance_period_id"]
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"], ["fuel_category.fuel_category_id"]
        ),
        sa.PrimaryKeyConstraint("category_carbon_intensity_id"),
        sa.UniqueConstraint(
            "compliance_period_id",
            "fuel_category_id",
            name="uq_category_carbon_intensity_compliance_fuelcategory",
        ),
    )

    # Insert data into default_carbon_intensity table for compliance periods 2013-2026
    op.execute(
        """
        WITH carbon_intensity_values AS (
            SELECT
                ft.fuel_type_id,
                cp.compliance_period_id,
                CASE
                    WHEN ft.fuel_type = 'CNG' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 62.14
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 63.64
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 63.91 
                        END
                    WHEN ft.fuel_type = 'Electricity' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 11
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 19.73
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 12.14
                        END
                    WHEN ft.fuel_type = 'Hydrogen' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 95.51
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 96.82
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 123.96
                        END
                    WHEN ft.fuel_type = 'LNG' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 63.26
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 112.65
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 90.11
                        END
                    WHEN ft.fuel_type = 'Propane' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 14 THEN 75.35
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 79.87
                        END
                    WHEN ft.fuel_type = 'Natural gas-based gasoline' AND cp.compliance_period_id BETWEEN 4 AND 14 THEN 90.07
                    WHEN ft.fuel_type = 'Renewable Fuel- Diesel' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 93.55
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 98.96
                        END
                    WHEN ft.fuel_type = 'Petroleum CI- Diesel' THEN
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 93.55
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 94.76
                        END
                    WHEN ft.fuel_type = 'Renewable Fuel- Gasoline' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 87.29
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 88.14
                        END
                    WHEN ft.fuel_type = 'Petroleum CI- Gasoline' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 87.29
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 88.14
                        END
                    WHEN ft.fuel_type = 'Fossil-derived diesel' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 94.38
                    WHEN ft.fuel_type = 'Fossil-derived gasoline' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 93.67
                    WHEN ft.fuel_type = 'Fossil-derived jet fuel' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 88.83
                    WHEN ft.fuel_type = 'Alternative jet fuel' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 88.83
                    WHEN ft.fuel_type = 'Biodiesel' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 100.21
                    WHEN ft.fuel_type = 'Ethanol' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 93.67
                    WHEN ft.fuel_type = 'HDRD' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 100.21
                    WHEN ft.fuel_type = 'Other diesel fuel' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 100.21
                    WHEN ft.fuel_type = 'Renewable gasoline' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 93.67
                    WHEN ft.fuel_type = 'Renewable naphtha' AND cp.compliance_period_id BETWEEN 15 AND 17 THEN 93.67
                END AS default_carbon_intensity,
                cp.description
            FROM fuel_type ft
            CROSS JOIN compliance_period cp
            WHERE cp.compliance_period_id BETWEEN 4 AND 17
            AND ft.fuel_type IN (
                'CNG', 'Electricity', 'Hydrogen', 'LNG', 'Propane', 'Natural gas-based gasoline',
                'Renewable Fuel- Diesel', 'Petroleum CI- Diesel', 'Renewable Fuel- Gasoline',
                'Petroleum CI- Gasoline', 'Fossil-derived diesel', 'Fossil-derived gasoline',
                'Fossil-derived jet fuel', 'Alternative jet fuel', 'Biodiesel', 'Ethanol',
                'HDRD', 'Other diesel fuel', 'Renewable gasoline', 'Renewable naphtha'
            )
        )
        INSERT INTO default_carbon_intensity (
            fuel_type_id,
            compliance_period_id,
            default_carbon_intensity,
            create_user,
            update_user,
            effective_date,
            expiration_date
        )
        SELECT 
            fuel_type_id,
            compliance_period_id,
            default_carbon_intensity,
            'admin',
            'admin',
            date(description || '-01-01'),
            date(description || '-12-31')
        FROM carbon_intensity_values
        WHERE default_carbon_intensity IS NOT NULL;

    """
    )

    # Insert data into category_carbon_intensity table for compliance periods 2013-2026
    op.execute(
        """
        WITH category_carbon_intensity_values AS (
            SELECT
                fc.fuel_category_id,
                cp.compliance_period_id,
                cp.description,
                CASE
                    WHEN fc.category = 'Gasoline' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 87.29
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 88.14
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 93.67
                        END
                    WHEN fc.category = 'Diesel' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 4 AND 7 THEN 93.55
                            WHEN cp.compliance_period_id BETWEEN 8 AND 14 THEN 94.76
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 100.21
                        END
                    WHEN fc.category = 'Jet fuel' THEN 
                        CASE 
                            WHEN cp.compliance_period_id BETWEEN 15 AND 17 THEN 88.83
                        END
                END AS category_carbon_intensity
            FROM fuel_category fc
            CROSS JOIN compliance_period cp
            WHERE fc.category IN ('Gasoline', 'Diesel', 'Jet fuel')
        )

        INSERT INTO category_carbon_intensity (
            compliance_period_id,
            fuel_category_id,
            category_carbon_intensity,
            create_user,
            update_user,
            effective_date,
            expiration_date
        )
        SELECT 
            compliance_period_id,
            fuel_category_id,
            category_carbon_intensity,
            'admin',
            'admin',
            DATE(description || '-01-01'),
            DATE(description || '-12-31')
        FROM category_carbon_intensity_values
        WHERE category_carbon_intensity IS NOT NULL;

    """
    )

    # Insert data into energy_effectiveness_ratio table for compliance periods 2025 and 2026
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
            e.fuel_category_id,
            e.fuel_type_id,
            e.end_use_type_id,
            new_cp.compliance_period_id,  -- Assign new compliance period ID (16, 17)
            e.ratio,
            'admin' AS create_user,
            'admin' AS update_user,
            TRUE AS effective_status
        FROM energy_effectiveness_ratio e
        JOIN compliance_period new_cp
            ON new_cp.compliance_period_id IN (16, 17)  -- New compliance periods
        WHERE e.compliance_period_id = 15  -- Copy only records from compliance period 15
        AND EXISTS (
            SELECT 1 FROM energy_effectiveness_ratio e15
            WHERE e15.compliance_period_id = 15
            AND e15.fuel_type_id = e.fuel_type_id  -- Ensure fuel_type exists in CP 15
        )
    """
    )
    # Insert data into additional_carbon_intensity table for compliance periods 2025 and 2026
    op.execute(
        """
        INSERT INTO additional_carbon_intensity (
            fuel_type_id,
            end_use_type_id,
            uom_id,
            intensity,
            create_user,
            update_user,
            compliance_period_id
        )
        SELECT 
            aci.fuel_type_id,
            aci.end_use_type_id,
            aci.uom_id,
            aci.intensity,
            'admin',  -- Assigning admin as creator
            'admin',  -- Assigning admin as updater
            cp.compliance_period_id
        FROM additional_carbon_intensity aci
        CROSS JOIN (SELECT 16 AS compliance_period_id UNION ALL SELECT 17) cp
        WHERE aci.compliance_period_id = 15;
    """
    )


def downgrade():

    # Delete inserted records from energy_effectiveness_ratio for compliance periods 16 and 17
    op.execute(
        """
        DELETE FROM energy_effectiveness_ratio 
        WHERE compliance_period_id IN (16, 17);
        """
    )

    # Delete inserted records from additional_carbon_intensity for compliance periods 16 and 17
    op.execute(
        """
        DELETE FROM additional_carbon_intensity 
        WHERE compliance_period_id IN (16, 17);
        """
    )

    op.drop_table("default_carbon_intensity")
    op.drop_table("category_carbon_intensity")
