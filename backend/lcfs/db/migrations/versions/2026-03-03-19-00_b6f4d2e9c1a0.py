"""Add System admin IDIR role

Revision ID: b6f4d2e9c1a0
Revises: a1b2c3d4e5f9
Create Date: 2026-02-17 12:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b6f4d2e9c1a0"
down_revision = "a1b2c3d4e5f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'SYSTEM_ADMIN'")

    op.execute(
        """
        INSERT INTO role (
            role_id, name, description, is_government_role, display_order
        )
        VALUES
            (
                14,
                'SYSTEM_ADMIN',
                'Can manage system-level configuration controls and feature administration.',
                TRUE,
                14
            )
        ON CONFLICT (name) DO UPDATE
        SET
            description = EXCLUDED.description,
            is_government_role = EXCLUDED.is_government_role,
            display_order = EXCLUDED.display_order;
        """
    )


def downgrade() -> None:
    # This migration is not reversible.
    pass
