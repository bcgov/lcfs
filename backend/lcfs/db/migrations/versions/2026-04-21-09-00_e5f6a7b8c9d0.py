"""Add co_processed to fuel code

Revision ID: e5f6a7b8c9d0
Revises: d4f5e6a7b8c9
Create Date: 2026-04-21 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e5f6a7b8c9d0"
down_revision = "d4f5e6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fuel_code",
        sa.Column(
            "co_processed",
            sa.String(length=50),
            nullable=False,
            server_default="No",
            comment="Whether the fuel is co-processed",
        ),
    )

    op.execute("""
        UPDATE fuel_code
        SET co_processed = CASE
            WHEN feedstock_misc IS NULL OR btrim(feedstock_misc) = '' THEN 'No'
            WHEN lower(feedstock_misc) LIKE '%dht%' THEN 'Yes - DHT'
            WHEN lower(feedstock_misc) LIKE '%fcc%' THEN 'Yes - FCC'
            ELSE 'No'
        END;
        """)

def downgrade() -> None:
    op.drop_column("fuel_code", "co_processed")
