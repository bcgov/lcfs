"""add fuel class table

Revision ID: ca01318d5925
Revises: fa4e3c9fa855
Create Date: 2024-06-11 12:48:56.882951

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "ca01318d5925"
down_revision = "fa4e3c9fa855"
branch_labels = None
depends_on = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_table("fuel_class")
