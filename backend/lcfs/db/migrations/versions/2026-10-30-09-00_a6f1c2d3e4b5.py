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

    # LCJFIP Applicant is an org-controllable "Roles available" option (like
    # CI Applicant / IA Proponent). Backfill availability for organizations
    # already carrying the LCJFIP type or whose users already hold an LCJFIP
    # role, so existing assignments remain valid under the available-role check.
    op.execute(
        """
        INSERT INTO organization_available_role (organization_id, role_id)
        SELECT ota.organization_id, 18
        FROM organization_type_association ota
        JOIN organization_type ot
            ON ot.organization_type_id = ota.organization_type_id
        WHERE ot.org_type = 'lcjfip'
        ON CONFLICT DO NOTHING;
        """
    )
    # LCJFIP Administrator (19) holders imply LCJFIP Applicant (18) availability.
    op.execute(
        """
        INSERT INTO organization_available_role (organization_id, role_id)
        SELECT DISTINCT up.organization_id, 18
        FROM user_role ur
        JOIN user_profile up ON up.user_profile_id = ur.user_profile_id
        WHERE up.organization_id IS NOT NULL
          AND ur.role_id IN (18, 19)
        ON CONFLICT DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM organization_available_role WHERE role_id = 18;")
    # PostgreSQL enum values cannot be removed while existing data may use them.
