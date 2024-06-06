"""add target carbon intensity

Revision ID: fa4e3c9fa855
Revises: 2b64a18af91d
Create Date: 2024-06-06 11:54:38.443607

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "fa4e3c9fa855"
down_revision = "2b64a18af91d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "target_carbon_intensity",
        sa.Column("target_carbon_intensity_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "compliance_period_id",
            sa.Integer(),
            nullable=False,
            comment="Compliance period ID",
        ),
        sa.Column(
            "fuel_category_id", sa.Integer(), nullable=False, comment="Fuel category ID"
        ),
        sa.Column(
            "target_carbon_intensity",
            sa.Float(),
            nullable=False,
            comment="Target Carbon Intensity (gCO2e/MJ)",
        ),
        sa.Column(
            "reduction_target_percentage",
            sa.Float(),
            nullable=False,
            comment="Reduction target percentage",
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
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
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
        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.Date(),
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.ForeignKeyConstraint(
            ["compliance_period_id"],
            ["compliance_period.compliance_period_id"],
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
        ),
        sa.PrimaryKeyConstraint("target_carbon_intensity_id"),
        comment="Target carbon intensity values for various fuel categories",
    )
    op.alter_column(
        "additional_carbon_intensity",
        "intensity",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_nullable=False,
    )
    op.alter_column(
        "energy_density",
        "density",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_nullable=False,
    )
    op.alter_column(
        "energy_effectiveness_ratio",
        "ratio",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=3, asdecimal=2),
        existing_comment="Energy effectiveness ratio constant",
        existing_nullable=False,
    )
    op.alter_column(
        "fuel_type",
        "default_carbon_intensity",
        existing_type=sa.REAL(),
        type_=sa.Float(precision=10, asdecimal=2),
        existing_comment="Carbon intensities: default & prescribed (gCO2e/MJ)",
        existing_nullable=True,
    )
    op.create_table_comment(
        "provision_of_the_act",
        "List of provisions within Greenhouse Gas Reduction\n         (Renewable and Low Carbon Fuel Requirement) Act. e.g. Section 6 (5) (a).\n         Used in determining carbon intensity needed for for compliance reporting calculation.",
        existing_comment="List of provisions within Greenhouse Gas Reduction (Renewable and Low Carbon Fuel Requirement) Act. e.g. Section 6 (5) (a). Used in determining carbon intensity needed for for compliance reporting calculation.",
        schema=None,
    )
    op.create_index(op.f('ix_target_carbon_intensity_compliance_period_id'), 'target_carbon_intensity', ['compliance_period_id'], unique=False)
    op.create_index(op.f('ix_target_carbon_intensity_fuel_category_id'), 'target_carbon_intensity', ['fuel_category_id'], unique=False)


def downgrade() -> None:
    op.create_table_comment(
        "provision_of_the_act",
        "List of provisions within Greenhouse Gas Reduction (Renewable and Low Carbon Fuel Requirement) Act. e.g. Section 6 (5) (a). Used in determining carbon intensity needed for for compliance reporting calculation.",
        existing_comment="List of provisions within Greenhouse Gas Reduction\n         (Renewable and Low Carbon Fuel Requirement) Act. e.g. Section 6 (5) (a).\n         Used in determining carbon intensity needed for for compliance reporting calculation.",
        schema=None,
    )
    op.alter_column(
        "fuel_type",
        "default_carbon_intensity",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_comment="Carbon intensities: default & prescribed (gCO2e/MJ)",
        existing_nullable=True,
    )
    op.alter_column(
        "energy_effectiveness_ratio",
        "ratio",
        existing_type=sa.Float(precision=3, asdecimal=2),
        type_=sa.REAL(),
        existing_comment="Energy effectiveness ratio constant",
        existing_nullable=False,
    )
    op.alter_column(
        "energy_density",
        "density",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_nullable=False,
    )
    op.alter_column(
        "additional_carbon_intensity",
        "intensity",
        existing_type=sa.Float(precision=10, asdecimal=2),
        type_=sa.REAL(),
        existing_nullable=False,
    )
    op.drop_index(op.f('ix_target_carbon_intensity_fuel_category_id'), table_name='target_carbon_intensity')
    op.drop_index(op.f('ix_target_carbon_intensity_compliance_period_id'), table_name='target_carbon_intensity')
    op.drop_table("target_carbon_intensity")
