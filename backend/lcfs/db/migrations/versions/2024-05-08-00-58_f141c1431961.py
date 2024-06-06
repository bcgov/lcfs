"""Fuel code static data tables

Revision ID: f141c1431961
Revises: 6e08afd00978
Create Date: 2024-05-08 00:58:34.689078

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f141c1431961"
down_revision = "6e08afd00978"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    sa.Enum("Gasoline", "Diesel", "Jet fuel", name="fuel_category_enum").create(
        op.get_bind()
    )
    op.create_table(
        "end_use_type",
        sa.Column("end_use_type_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("sub_type", sa.Text(), nullable=True),
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
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("end_use_type_id"),
        comment="Represents a end use types for various fuel types and categories",
    )
    op.create_table(
        "fuel_category",
        sa.Column(
            "fuel_category_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the fuel category",
        ),
        sa.Column(
            "category",
            postgresql.ENUM(
                "Gasoline",
                "Diesel",
                "Jet fuel",
                name="fuel_category_enum",
                create_type=False,
            ),
            nullable=False,
            comment="Name of the fuel category",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Description of the fuel categor",
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
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
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
        sa.PrimaryKeyConstraint("fuel_category_id"),
        comment="Represents a static table for fuel categories",
    )
    op.create_table(
        "unit_of_measure",
        sa.Column("uom_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
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
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.PrimaryKeyConstraint("uom_id"),
        comment="Units used to measure energy densities",
    )
    op.create_table(
        "additional_carbon_intensity",
        sa.Column(
            "additional_uci_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=True),
        sa.Column("end_use_type_id", sa.Integer(), nullable=True),
        sa.Column("uom_id", sa.Integer(), nullable=False),
        sa.Column("intensity", sa.Float(precision=10, asdecimal=2), nullable=False),
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
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.ForeignKeyConstraint(
            ["end_use_type_id"],
            ["end_use_type.end_use_type_id"],
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
        ),
        sa.ForeignKeyConstraint(
            ["uom_id"],
            ["unit_of_measure.uom_id"],
        ),
        sa.PrimaryKeyConstraint("additional_uci_id"),
        comment="Additional carbon intensity attributable to the use of fuel. UCIs are added to the recorded carbon intensity of the fuel to account for additional carbon intensity attributed to the use of the fuel.",
    )
    op.create_table(
        "energy_density",
        sa.Column(
            "energy_density_id", sa.Integer(), autoincrement=True, nullable=False
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=False),
        sa.Column("density", sa.Float(precision=10, asdecimal=2), nullable=False),
        sa.Column("uom_id", sa.Integer(), nullable=False),
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
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
        ),
        sa.ForeignKeyConstraint(
            ["uom_id"],
            ["unit_of_measure.uom_id"],
        ),
        sa.PrimaryKeyConstraint("energy_density_id"),
        comment="Represents Energy Density data table",
    )
    op.create_table(
        "energy_effectiveness_ratio",
        sa.Column("eer_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "fuel_category_id", sa.Integer(), nullable=False, comment="Fuel category"
        ),
        sa.Column("fuel_type_id", sa.Integer(), nullable=True, comment="Fuel type"),
        sa.Column(
            "end_use_type_id", sa.Integer(), nullable=True, comment="End use type"
        ),
        sa.Column(
            "ratio",
            sa.Float(precision=3, asdecimal=2),
            nullable=False,
            comment="Energy effectiveness ratio constant",
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
            "display_order",
            sa.Integer(),
            nullable=True,
            comment="Relative rank in display sorting order",
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
            ["end_use_type_id"],
            ["end_use_type.end_use_type_id"],
        ),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"],
            ["fuel_category.fuel_category_id"],
        ),
        sa.ForeignKeyConstraint(
            ["fuel_type_id"],
            ["fuel_type.fuel_type_id"],
        ),
        sa.PrimaryKeyConstraint("eer_id"),
        comment="Energy effectiveness ratio (EERs)",
    )
    op.add_column(
        "admin_adjustment",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "admin_adjustment_history",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "comment",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "fuel_code",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "initiative_agreement_history",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "organization_address",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "organization_attorney_address",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "transaction",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "transfer",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "transfer_category",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    op.add_column(
        "transfer_history",
        sa.Column(
            "effective_status",
            sa.Boolean(),
            nullable=False,
            comment="True if the value is currently valid, False if it is no longer valid.",
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("transfer_history", "effective_status")
    op.drop_column("transfer_category", "effective_status")
    op.drop_column("transfer", "effective_status")
    op.drop_column("transaction", "effective_status")
    op.drop_column("organization_attorney_address", "effective_status")
    op.drop_column("organization_address", "effective_status")
    op.drop_column("organization", "effective_status")
    op.drop_column("initiative_agreement_history", "effective_status")
    op.drop_column("initiative_agreement", "effective_status")
    op.drop_column("fuel_code", "effective_status")
    op.drop_column("admin_adjustment_history", "effective_status")
    op.drop_column("admin_adjustment", "effective_status")
    op.drop_table("energy_effectiveness_ratio")
    op.drop_table("energy_density")
    op.drop_table("additional_carbon_intensity")
    op.drop_table("unit_of_measure")
    op.drop_table("fuel_category")
    op.drop_table("end_use_type")
    sa.Enum("Gasoline", "Diesel", "Jet fuel", name="fuel_category_enum").drop(
        op.get_bind()
    )
    # ### end Alembic commands ###
