"""Fix Energy density for fuel types

Revision ID: 46948662543b
Revises: a1b2c3d4e5f8
Create Date: 2026-01-15 06:40:38.311142

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "46948662543b"
down_revision = "a1b2c3d4e5f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # CNG
    op.execute(
        """
        UPDATE energy_density 
        SET density = 38.27 
        WHERE fuel_type_id = 2 and compliance_period_id > 15
        """
    )
    # HDRD
    op.execute(
        """
        UPDATE energy_density 
        SET density = 37.89
        WHERE fuel_type_id = 5 and compliance_period_id > 15
        """
    )
    # Hydrogen
    op.execute(
        """
        UPDATE energy_density 
        SET density = 141.76
        WHERE fuel_type_id = 6 and compliance_period_id > 15
        """
    )
    # LNG
    op.execute(
        """
        UPDATE energy_density 
        SET density = 53.54
        WHERE fuel_type_id = 7 and compliance_period_id > 15
        """
    )
    # Alternative Jet Fuel
    op.execute(
        """
        INSERT INTO energy_density (fuel_type_id, compliance_period_id, uom_id, density)
        VALUES (11, 16, 1, 36), (11, 17, 1, 36), (11, 18, 1, 36), (11, 19, 1, 36), (11, 20, 1, 36), (11, 21, 1, 36)
        """
    )
    # Propane
    op.execute(
        """
        UPDATE energy_density 
        SET density = 25.62
        WHERE fuel_type_id = 13 and compliance_period_id > 15
        """
    )
    # Renewable gasoline
    op.execute(
        """
        INSERT INTO energy_density (fuel_type_id, compliance_period_id, uom_id, density)
        VALUES (14, 16, 1, 34.69), (14, 17, 1, 34.69), (14, 18, 1, 34.69), (14, 19, 1, 34.69), (14, 20, 1, 34.69), (14, 21, 1, 34.69)
        """
    )
    # Renewable naptha
    op.execute(
        """
        INSERT INTO energy_density (fuel_type_id, compliance_period_id, uom_id, density)
        VALUES (15, 16, 1, 34.51), (15, 17, 1, 34.51), (15, 18, 1, 34.51), (15, 19, 1, 34.51), (15, 20, 1, 34.51), (15, 21, 1, 34.51)
        """
    )
    # Fossil derived jet fuel
    op.execute(
        """
        INSERT INTO energy_density (fuel_type_id, compliance_period_id, uom_id, density)
        VALUES (18, 16, 1, 37.40), (18, 17, 1, 37.40), (18, 18, 1, 37.40), (18, 19, 1, 37.40), (18, 20, 1, 37.40), (18, 21, 1, 37.40)
        """
    )
    # Other diesel
    op.execute(
        """
        INSERT INTO energy_density (fuel_type_id, compliance_period_id, uom_id, density)
        VALUES (20, 16, 1, 36.51), (20, 17, 1, 36.51), (20, 18, 1, 36.51), (20, 19, 1, 36.51), (20, 20, 1, 36.51), (20, 21, 1, 36.51)
        """
    )
    # Natural gas-based gasoline
    op.execute(
        """
        INSERT INTO energy_density (fuel_type_id, compliance_period_id, uom_id, density)
        VALUES (21, 16, 1, 34.69), (21, 17, 1, 34.69), (21, 18, 1, 34.69), (21, 19, 1, 34.69), (21, 20, 1, 34.69), (21, 21, 1, 34.69)
        """
    )


def downgrade() -> None:
    pass
