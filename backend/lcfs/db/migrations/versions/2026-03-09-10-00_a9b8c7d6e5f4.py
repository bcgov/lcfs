"""Add IA Signer BCeID role

Revision ID: a9b8c7d6e5f4
Revises: f5a8c3d7e2b4
Create Date: 2026-03-09 10:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a9b8c7d6e5f4"
down_revision = "f5a8c3d7e2b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'IA_SIGNER'")

    op.execute(
        """
        INSERT INTO role (
            role_id, name, description, is_government_role, display_order
        )
        VALUES
            (
                17,
                'IA_SIGNER',
                'Can sign and submit IA submissions, designated actions and evidence to government. This role can only be assigned by government users.',
                FALSE,
                17
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
