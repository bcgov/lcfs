"""rename `fuel_class` table to fuel_instance

Revision ID: 2282cf279767
Revises: c8a2dbd4ccd7
Create Date: 2024-09-06 18:00:38.695353

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "2282cf279767"
down_revision = "c8a2dbd4ccd7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("fuel_class")

    op.create_table(
        "fuel_instance",
        sa.Column("fuel_instance_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fuel_type_id", sa.Integer(), nullable=False, comment="Fuel type ID"),
        sa.Column(
            "fuel_category_id", sa.Integer(), nullable=False, comment="Fuel category ID"
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
        sa.ForeignKeyConstraint(["fuel_type_id"], ["fuel_type.fuel_type_id"]),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"], ["fuel_category.fuel_category_id"]
        ),
        sa.PrimaryKeyConstraint("fuel_instance_id"),
        comment="Fuel instance details linking fuel type and fuel category",
    )


def downgrade() -> None:
    op.drop_table("fuel_instance")

    op.create_table(
        "fuel_class",
        sa.Column("fuel_class_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fuel_type_id", sa.Integer(), nullable=False, comment="Fuel type ID"),
        sa.Column(
            "fuel_category_id", sa.Integer(), nullable=False, comment="Fuel category ID"
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
        sa.ForeignKeyConstraint(["fuel_type_id"], ["fuel_type.fuel_type_id"]),
        sa.ForeignKeyConstraint(
            ["fuel_category_id"], ["fuel_category.fuel_category_id"]
        ),
        sa.PrimaryKeyConstraint("fuel_class_id"),
        comment="Fuel class details linking fuel type and fuel category",
    )
