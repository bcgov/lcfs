"""Add CI Applicant and IA Proponent BCeID roles

Revision ID: a1b2c3d4e5f9
Revises: f3b1b9f03c9a
Create Date: 2026-02-10 12:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f9"
down_revision = "f3b1b9f03c9a"
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'CI_APPLICANT'")
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'IA_PROPONENT'")

    op.execute(
        """
        INSERT INTO role (
            role_id, name, description, is_government_role, display_order
        )
        VALUES
            (
                12,
                'CI_APPLICANT',
                'Can access Fuel code tab and CI application subtab for BCeID users',
                FALSE,
                12
            ),
            (
                13,
                'IA_PROPONENT',
                'Can access Initiative agreement tab for BCeID users',
                FALSE,
                13
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
