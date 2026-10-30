"""Add LCJFIP organization type and BCeID roles.

Revision ID: a6f1c2d3e4b5
Revises: ba06f9f3360c
Create Date: 2026-10-30 09:00:00.000000
"""

from alembic import op


revision = "a6f1c2d3e4b5"
down_revision = "ba06f9f3360c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'LCJFIP_APPLICANT'")
        op.execute(
            "ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'LCJFIP_ADMINISTRATOR'"
        )

    op.execute(
        """
        INSERT INTO role (
            role_id, name, description, is_government_role, display_order
        )
        VALUES
            (
                18,
                'LCJFIP_APPLICANT',
                'Can access the Low Carbon Jet fuel Incentive Program as a BCeID user',
                FALSE,
                18
            ),
            (
                19,
                'LCJFIP_ADMINISTRATOR',
                'Can co-administer the Low Carbon Jet fuel Incentive Program as a BCeID user',
                FALSE,
                19
            )
        ON CONFLICT (name) DO UPDATE
        SET
            description = EXCLUDED.description,
            is_government_role = EXCLUDED.is_government_role,
            display_order = EXCLUDED.display_order;
        """
    )
    op.execute(
        """
        SELECT setval(
            pg_get_serial_sequence('role', 'role_id'),
            (SELECT MAX(role_id) FROM role)
        )
        """
    )
    op.execute(
        """
        INSERT INTO organization_type
            (organization_type_id, org_type, description, is_bceid_user, display_order)
        VALUES
            (
                7,
                'lcjfip',
                'Low Carbon Jet fuel Incentive Program',
                TRUE,
                7
            )
        ON CONFLICT (organization_type_id) DO NOTHING;
        """
    )


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed while existing data may use them.
    pass
