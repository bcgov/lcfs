"""Add final_supply_equipment_reg_numbers table to track the highest sequence numbers for final_supply_equipment

Revision ID: 77cedc7696b3
Revises: c87bf3db0117
Create Date: 2024-07-16 00:11:00.018679

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "77cedc7696b3"
down_revision = "c87bf3db0117"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "final_supply_equipment_reg_numbers",
        sa.Column(
            "postal_code",
            sa.String(),
            primary_key=True,
            comment="Postal code"
        ),
        sa.Column(
            "current_sequence_number",
            sa.Integer,
            nullable=False,
            comment="Current sequence number used for the postal code"
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
        )
    )


def downgrade() -> None:
    op.drop_table("final_supply_equipment_reg_numbers")
