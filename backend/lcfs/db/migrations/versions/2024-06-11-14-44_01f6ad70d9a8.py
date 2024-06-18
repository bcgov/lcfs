"""Add received_or_transferred enum to notional_transfer

Revision ID: 01f6ad70d9a8
Revises: r42e3c9va810
Create Date: 2024-06-10 15:44:17.109905

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "01f6ad70d9a8"
down_revision = "r42e3c9va810"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sa.Enum("Received", "Transferred", name="receivedortransferredenum").create(
        op.get_bind()
    )
    op.alter_column(
        "notional_transfer",
        "received_or_transferred",
        existing_type=sa.VARCHAR(),
        type_=sa.Enum("Received", "Transferred", name="receivedortransferredenum"),
        comment="Indicates whether the transfer is Received or Transferred",
        existing_comment="Indicates if the fuel was received or transferred",
        existing_nullable=False,
        postgresql_using="received_or_transferred::receivedortransferredenum",
    )


def downgrade() -> None:
    op.alter_column(
        "notional_transfer",
        "received_or_transferred",
        existing_type=sa.Enum(
            "Received", "Transferred", name="receivedortransferredenum"
        ),
        type_=sa.VARCHAR(),
        comment="Indicates if the fuel was received or transferred",
        existing_comment="Indicates whether the transfer is Received or Transferred",
        existing_nullable=False,
    )
    sa.Enum("Received", "Transferred", name="receivedortransferredenum").drop(
        op.get_bind()
    )
