"""Add IA Analyst and IA Manager IDIR roles

Revision ID: f4c8a1b2d3e5
Revises: 8e9f1a2b3c4d
Create Date: 2026-02-26 12:03:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "f4c8a1b2d3e5"
down_revision = "8e9f1a2b3c4d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'IA_ANALYST'")
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'IA_MANAGER'")

    op.execute(
        """
        INSERT INTO role (
            role_id, name, description, is_government_role, display_order
        )
        VALUES
            (
                15,
                'IA_ANALYST',
                'Can access Initiative Agreements tab and review initiative agreement applications.',
                TRUE,
                15
            ),
            (
                16,
                'IA_MANAGER',
                'Can access Initiative Agreements tab and manage initiative agreement applications.',
                TRUE,
                16
            )
        ON CONFLICT (name) DO UPDATE
        SET
            description = EXCLUDED.description,
            is_government_role = EXCLUDED.is_government_role,
            display_order = EXCLUDED.display_order;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values in-place.
    pass
