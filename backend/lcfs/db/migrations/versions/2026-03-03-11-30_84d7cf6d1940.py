"""Alter unique constraints on Charging site

Revision ID: 84d7cf6d1940
Revises: f4c8a1b2d3e5
Create Date: 2026-03-03 11:30:47.227193

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "84d7cf6d1940"
down_revision = "f4c8a1b2d3e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index(
        op.f("idx_charging_equipment_charging_site_id"), table_name="charging_equipment"
    )
    op.drop_index(op.f("ix_charging_site_site_code"), table_name="charging_site")
    op.drop_constraint(op.f("uq_charging_site_org_name"), "charging_site", type_="unique")
    op.drop_constraint(
        op.f("uq_charging_site_site_code"), "charging_site", type_="unique"
    )
    op.create_index(
        op.f("ix_charging_site_site_code"), "charging_site", ["site_code"], unique=False
    )
    op.create_unique_constraint(
        "uq_charging_site_id_version", "charging_site", ["charging_site_id", "version"]
    )
    op.create_unique_constraint(
        "uq_charging_site_org_name",
        "charging_site",
        ["organization_id", "site_name", "site_code", "version"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_charging_site_org_name", "charging_site", type_="unique"
    )
    op.drop_constraint(
        "uq_charging_site_id_version", "charging_site", type_="unique"
    )
    op.drop_index(
        op.f("ix_charging_site_site_code"), table_name="charging_site"
    )
    op.create_index(
        op.f("ix_charging_site_site_code"), "charging_site", ["site_code"], unique=False
    )
    op.create_unique_constraint(
        op.f("uq_charging_site_site_code"), "charging_site", ["site_code"]
    )
    op.create_unique_constraint(
        "uq_charging_site_org_name",
        "charging_site",
        ["organization_id", "site_name", "site_code"],
    )
    op.create_index(
        op.f("idx_charging_equipment_charging_site_id"),
        "charging_equipment",
        ["charging_site_id"],
        unique=False,
    )