"""Widen organization address postal/ZIP fields for international formats.

Revision ID: c7d8e9f0a1b2
Revises: b7a04f59fdf3
Create Date: 2026-11-24 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "c7d8e9f0a1b2"
down_revision = "b7a04f59fdf3"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "organization_address",
        "postalCode_zipCode",
        existing_type=sa.String(length=10),
        type_=sa.String(length=30),
        existing_nullable=True,
    )
    op.alter_column(
        "organization_attorney_address",
        "postalCode_zipCode",
        existing_type=sa.String(length=10),
        type_=sa.String(length=30),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        "organization_address",
        "postalCode_zipCode",
        existing_type=sa.String(length=30),
        type_=sa.String(length=10),
        existing_nullable=True,
    )
    op.alter_column(
        "organization_attorney_address",
        "postalCode_zipCode",
        existing_type=sa.String(length=30),
        type_=sa.String(length=10),
        existing_nullable=True,
    )
