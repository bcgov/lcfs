"""Allocation agreement migrations fix

Revision ID: ffe9e3da563b
Revises: fd8ee994668c
Create Date: 2025-03-14 03:38:06.163253

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "ffe9e3da563b"
down_revision = "6c427c10a63d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "quantity_not_sold",
            sa.Integer(),
            nullable=True,
            comment="Quantity not sold or supplied within the compliance period",
        ),
    )
    op.alter_column(
        "allocation_agreement",
        "transaction_partner_email",
        existing_type=sa.VARCHAR(),
        nullable=True,
        existing_comment="Transaction Partner email",
    )
    op.alter_column(
        "allocation_agreement",
        "transaction_partner_phone",
        existing_type=sa.VARCHAR(),
        nullable=True,
        existing_comment="Transaction Partner phone number",
    )
    op.alter_column(
        "allocation_agreement",
        "ci_of_fuel",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        nullable=True,
        comment="The Carbon intensity of fuel",
        existing_comment="The Carbon intensity of fuel",
    )
    op.alter_column(
        "allocation_agreement",
        "fuel_category_id",
        existing_type=sa.INTEGER(),
        nullable=True,
        existing_comment="Foreign key to the fuel category",
    )
    op.alter_column(
        "allocation_agreement",
        "provision_of_the_act_id",
        existing_type=sa.INTEGER(),
        nullable=True,
        existing_comment="Foreign key to the provision of the act",
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.alter_column(
        "allocation_agreement",
        "provision_of_the_act_id",
        existing_type=sa.INTEGER(),
        nullable=False,
        existing_comment="Foreign key to the provision of the act",
    )
    op.alter_column(
        "allocation_agreement",
        "fuel_category_id",
        existing_type=sa.INTEGER(),
        nullable=False,
        existing_comment="Foreign key to the fuel category",
    )
    op.alter_column(
        "allocation_agreement",
        "ci_of_fuel",
        existing_type=sa.NUMERIC(precision=10, scale=2),
        nullable=False,
        comment="The Carbon intesity of fuel",
        existing_comment="The Carbon intensity of fuel",
    )
    op.alter_column(
        "allocation_agreement",
        "transaction_partner_phone",
        existing_type=sa.VARCHAR(),
        nullable=False,
        existing_comment="Transaction Partner phone number",
    )
    op.alter_column(
        "allocation_agreement",
        "transaction_partner_email",
        existing_type=sa.VARCHAR(),
        nullable=False,
        existing_comment="Transaction Partner email",
    )
    op.drop_column("allocation_agreement", "quantity_not_sold")
    # ### end Alembic commands ###
