"""Refactor organization_type table: add is_bceid_user column, convert org_type enum to VARCHAR, and seed new organization types.

Revision ID: 2f5a7b9c1d2e1
Revises: 3f5a7b9c1d2e
Create Date: 2025-02-14
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2f5a7b9c1d2e1"
down_revision = "3f5a7b9c1d2e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new boolean column
    op.add_column(
        "organization_type",
        sa.Column(
            "is_bceid_user",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Convert org_type from enum to VARCHAR and drop enum type
    op.execute(
        "ALTER TABLE organization_type ALTER COLUMN org_type TYPE VARCHAR(64) USING org_type::text;"
    )
    op.execute("DROP TYPE IF EXISTS org_type_enum;")

    # Delete all organization types except fuel supplier (ID = 1) to preserve existing data mappings
    op.execute("DELETE FROM organization_type WHERE organization_type_id != 1;")

    # Update existing fuel supplier (ID = 1) to match new requirements
    op.execute(
        """
        UPDATE organization_type 
        SET description = 'Fuel supplier',
            is_bceid_user = true, 
            display_order = 1
        WHERE organization_type_id = 1;
        """
    )

    # Insert the new organization types (IDs 2-5)
    new_org_types = [
        (2, "aggregator", "Aggregator", True, 2),
        (3, "fuel_producer", "Fuel producer, fuel code applicant", False, 3),
        (4, "exempted_supplier", "Exempted supplier", False, 4),
        (5, "initiative_agreement_holder", "Initiative agreement holder", False, 5),
    ]

    for org_id, org_type, description, is_bceid_user, display_order in new_org_types:
        op.execute(
            f"""
            INSERT INTO organization_type (organization_type_id, org_type, description, is_bceid_user, display_order)
            VALUES ({org_id}, '{org_type}', '{description}', {str(is_bceid_user).lower()}, {display_order});
            """
        )


def downgrade() -> None:
    # Remove inserted rows 2-5
    op.execute("DELETE FROM organization_type WHERE organization_type_id IN (2,3,4,5);")

    # We won't recreate the enum; leave org_type as VARCHAR for simplicity

    # Drop the boolean column
    op.drop_column("organization_type", "is_bceid_user")
