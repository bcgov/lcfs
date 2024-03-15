"""add recommendation column to transfer

Revision ID: 5674d1e61df6
Revises: 4f19e1f5efba
Create Date: 2024-03-15 22:09:52.323979

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

# revision identifiers, used by Alembic.
revision = "5674d1e61df6"
down_revision = "4f19e1f5efba"
branch_labels = None
depends_on = None


def upgrade() -> None:

    transfer_recommendation_enum = ENUM('Record', 'Refuse',
                                        name='transfer_recommendation_enum',
                                        metadata=sa.MetaData()
                                        )

    # Check first if the ENUM type already exists before creating it
    transfer_recommendation_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "transfer",
        sa.Column(
            "recommendation",
            sa.Enum("Record", "Refuse", name="transfer_recommendation_enum"),
            nullable=True,
            comment="Analyst recommendation for the transfer.",
        ),
    )


def downgrade() -> None:
    op.drop_column("transfer", "recommendation")

    op.execute('DROP TYPE IF EXISTS transfer_recommendation_enum')
