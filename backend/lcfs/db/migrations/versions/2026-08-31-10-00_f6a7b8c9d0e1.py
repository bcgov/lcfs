"""Multi-select organization types and per-organization available roles (#4565).

Creates organization_type_association (an organization may hold several types)
and organization_available_role (which org-controllable roles the organization
may assign to its BCeID users). Relabels/reorders the organization_type rows to
the #4565 checkbox wording, backfills each organization's current single type
into the association table, and backfills available roles from per-type
defaults unioned with the controllable roles the organization's users already
hold — so no existing role assignment becomes invalid.

organization.organization_type_id remains in place and is dual-written with the
primary type (reporting views still project the FK); it is dropped in a
follow-up once those views are reworked.

Revision ID: f6a7b8c9d0e1
Revises: c8d9e0f1a2b3
Create Date: 2026-08-31 10:00:00.000000
"""

import sqlalchemy as sa
from alembic import op


revision = "f6a7b8c9d0e1"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None

# Role ids fixed by the role seed migrations:
# 8 TRANSFER, 9 COMPLIANCE_REPORTING, 12 CI_APPLICANT, 13 IA_PROPONENT
TYPE_DEFAULT_ROLES = [
    ("fuel_supplier", 9),
    ("fuel_supplier", 8),
    ("exempted_supplier", 9),
    ("credit_trader", 8),
    ("aggregator", 8),
    ("fuel_producer", 12),
    ("initiative_agreement_holder", 13),
]


def _audit_columns():
    return [
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment=(
                "Date and time (UTC) when the physical record was updated in "
                "the database. It will be the same as the create_date until "
                "the record is first updated after creation."
            ),
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "organization_type_association",
        *_audit_columns(),
        sa.Column(
            "organization_type_association_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the organization type association",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Organization assigned this type",
        ),
        sa.Column(
            "organization_type_id",
            sa.Integer(),
            nullable=False,
            comment="Organization type assigned to the organization",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_organization_type_association_organization_id_organization"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_type_id"],
            ["organization_type.organization_type_id"],
            name=op.f(
                "fk_organization_type_association_organization_type_id_organization_type"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "organization_type_association_id",
            name=op.f("pk_organization_type_association"),
        ),
        sa.UniqueConstraint(
            "organization_id",
            "organization_type_id",
            name=op.f("uq_organization_type_association_organization_id"),
        ),
        comment="Associates organizations with one or more organization types.",
    )
    op.create_index(
        op.f("ix_organization_type_association_organization_id"),
        "organization_type_association",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_type_association_organization_type_id"),
        "organization_type_association",
        ["organization_type_id"],
        unique=False,
    )

    op.create_table(
        "organization_available_role",
        *_audit_columns(),
        sa.Column(
            "organization_available_role_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the organization available role",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Organization the role is available to",
        ),
        sa.Column(
            "role_id",
            sa.Integer(),
            nullable=False,
            comment="Role available for assignment within the organization",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_organization_available_role_organization_id_organization"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["role.role_id"],
            name=op.f("fk_organization_available_role_role_id_role"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "organization_available_role_id",
            name=op.f("pk_organization_available_role"),
        ),
        sa.UniqueConstraint(
            "organization_id",
            "role_id",
            name=op.f("uq_organization_available_role_organization_id"),
        ),
        comment=(
            "Roles that BCeID users of the organization may be assigned. "
            "Only org-controllable roles are stored here; base roles such "
            "as Manage Users and Signing Authority are always available."
        ),
    )
    op.create_index(
        op.f("ix_organization_available_role_organization_id"),
        "organization_available_role",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_available_role_role_id"),
        "organization_available_role",
        ["role_id"],
        unique=False,
    )

    # Relabel and reorder the type catalogue to the #4565 checkbox wording.
    op.execute(
        """
        UPDATE organization_type
        SET description = CASE org_type
                WHEN 'fuel_producer' THEN 'Fuel producer'
                WHEN 'initiative_agreement_holder' THEN 'Initiative agreement holder/applicant'
                WHEN 'credit_trader' THEN 'Credit transfer'
                ELSE description
            END,
            display_order = CASE org_type
                WHEN 'fuel_supplier' THEN 1
                WHEN 'exempted_supplier' THEN 2
                WHEN 'credit_trader' THEN 3
                WHEN 'aggregator' THEN 4
                WHEN 'fuel_producer' THEN 5
                WHEN 'initiative_agreement_holder' THEN 6
                ELSE display_order
            END;
        """
    )

    # Backfill: each organization keeps its current single type.
    op.execute(
        """
        INSERT INTO organization_type_association (organization_id, organization_type_id)
        SELECT organization_id, organization_type_id
        FROM organization
        WHERE organization_type_id IS NOT NULL
        ON CONFLICT DO NOTHING;
        """
    )

    # Backfill available roles: per-type defaults ...
    values = ", ".join(f"('{t}', {r})" for t, r in TYPE_DEFAULT_ROLES)
    op.execute(
        f"""
        INSERT INTO organization_available_role (organization_id, role_id)
        SELECT o.organization_id, m.role_id
        FROM organization o
        JOIN organization_type ot ON ot.organization_type_id = o.organization_type_id
        JOIN (VALUES {values}) AS m(org_type, role_id) ON m.org_type = ot.org_type
        ON CONFLICT DO NOTHING;
        """
    )

    # ... unioned with controllable roles the organization's users already hold,
    # so existing assignments stay valid whatever the defaults say.
    op.execute(
        """
        INSERT INTO organization_available_role (organization_id, role_id)
        SELECT DISTINCT up.organization_id, ur.role_id
        FROM user_role ur
        JOIN user_profile up ON up.user_profile_id = ur.user_profile_id
        WHERE up.organization_id IS NOT NULL
          AND ur.role_id IN (8, 9, 12, 13)
        ON CONFLICT DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_available_role_role_id"),
        table_name="organization_available_role",
    )
    op.drop_index(
        op.f("ix_organization_available_role_organization_id"),
        table_name="organization_available_role",
    )
    op.drop_table("organization_available_role")
    op.drop_index(
        op.f("ix_organization_type_association_organization_type_id"),
        table_name="organization_type_association",
    )
    op.drop_index(
        op.f("ix_organization_type_association_organization_id"),
        table_name="organization_type_association",
    )
    op.drop_table("organization_type_association")

    op.execute(
        """
        UPDATE organization_type
        SET description = CASE org_type
                WHEN 'fuel_producer' THEN 'Fuel producer, fuel code applicant'
                WHEN 'initiative_agreement_holder' THEN 'Initiative agreement holder'
                WHEN 'credit_trader' THEN 'Credit Trader'
                ELSE description
            END,
            display_order = CASE org_type
                WHEN 'fuel_supplier' THEN 1
                WHEN 'aggregator' THEN 2
                WHEN 'fuel_producer' THEN 3
                WHEN 'exempted_supplier' THEN 4
                WHEN 'initiative_agreement_holder' THEN 5
                WHEN 'credit_trader' THEN 6
                ELSE display_order
            END;
        """
    )
