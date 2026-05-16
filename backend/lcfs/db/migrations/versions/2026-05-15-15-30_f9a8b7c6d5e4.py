"""Add organization_id FK to fuel_code

Scopes "My Fuel Codes" by FK rather than the brittle company text match.
Nullable: foreign producers have no registered organisation.

Revision ID: f9a8b7c6d5e4
Revises: b8f9c0d1e2a3
Create Date: 2026-05-15 15:30:00.000000
"""

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "f9a8b7c6d5e4"
down_revision = "b8f9c0d1e2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fuel_code",
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=True,
            comment="Owning organisation; NULL for non-registered producers.",
        ),
    )
    op.create_foreign_key(
        op.f("fk_fuel_code_organization_id_organization"),
        "fuel_code",
        "organization",
        ["organization_id"],
        ["organization_id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_fuel_code_organization_id"),
        "fuel_code",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_fuel_code_organization_id"),
        table_name="fuel_code",
    )
    op.drop_constraint(
        op.f("fk_fuel_code_organization_id_organization"),
        "fuel_code",
        type_="foreignkey",
    )
    op.drop_column("fuel_code", "organization_id")
