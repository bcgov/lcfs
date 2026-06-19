"""Add Credit Trader organization type

Adds a 'credit_trader' organization type (#4547) for organizations that trade
compliance units but have no compliance obligation.

Additive only: compliance reporting is gated by user role (SUPPLIER), not by
organization type, so this new type does not create any compliance obligation
and does not affect existing organization types.

Revision ID: d9c8b7a6e5f4
Revises: e5f7a9b1c3d4
Create Date: 2026-06-16 00:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d9c8b7a6e5f4"
down_revision = "e5f7a9b1c3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO organization_type
            (organization_type_id, org_type, description, is_bceid_user, display_order)
        VALUES
            (6, 'credit_trader', 'Credit Trader', true, 6)
        ON CONFLICT (organization_type_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM organization_type WHERE org_type = 'credit_trader';")
