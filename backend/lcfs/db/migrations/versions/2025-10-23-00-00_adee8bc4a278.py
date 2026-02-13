"""Move allocating organization to charging site and remove site intended users

Revision ID: adee8bc4a278
Revises: 995ba109ca8d
Create Date: 2025-10-23 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "adee8bc4a278"
down_revision = "995ba109ca8d"
branch_labels = None
depends_on = None


def column_exists(table_name, column_name):
    """Check if a column exists in a table"""
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns


def table_exists(table_name):
    """Check if a table exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def index_exists(index_name, table_name):
    """Check if an index exists"""
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        indexes = inspector.get_indexes(table_name)
        return any(idx['name'] == index_name for idx in indexes)
    except:
        return False


def upgrade() -> None:
    # Step 1: Add allocating_organization_id FK to charging_site (only if it doesn't exist)
    if not column_exists("charging_site", "allocating_organization_id"):
        op.add_column(
            "charging_site",
        sa.Column(
            "allocating_organization_id",
            sa.Integer(),
            sa.ForeignKey("organization.organization_id"),
            nullable=True,
            comment="FK to allocating organization (null if not matched)",
            ),
        )

    # Step 2: Add allocating_organization_name to charging_site (hybrid approach, only if it doesn't exist)
    if not column_exists("charging_site", "allocating_organization_name"):
        op.add_column(
            "charging_site",
            sa.Column(
                "allocating_organization_name",
                sa.Text(),
                nullable=True,
                comment="Name of the allocating organization (text field, used when ID cannot be matched)",
            ),
        )

    # Step 3: Create index for allocating_organization_id (only if it doesn't exist)
    if not index_exists("ix_charging_site_allocating_org_id", "charging_site"):
        op.create_index(
            "ix_charging_site_allocating_org_id",
            "charging_site",
            ["allocating_organization_id"],
        )

    # Step 4: Migrate organization_name data from charging_equipment before it's dropped
    # Only run if BOTH source columns still exist (the SQL needs both)
    op.execute(
        """
        DO $$
        DECLARE
            ce_org_name_exists BOOLEAN;
            ce_allocating_org_id_exists BOOLEAN;
        BEGIN
            -- Check if organization_name column exists in charging_equipment
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'charging_equipment'
                AND column_name = 'organization_name'
            ) INTO ce_org_name_exists;

            -- Check if allocating_organization_id column exists in charging_equipment
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'charging_equipment'
                AND column_name = 'allocating_organization_id'
            ) INTO ce_allocating_org_id_exists;

            -- Only migrate data if BOTH source columns exist (the query needs both)
            IF ce_org_name_exists AND ce_allocating_org_id_exists THEN
                EXECUTE '
                    UPDATE charging_site cs
                    SET allocating_organization_name = (
                        SELECT COALESCE(
                            ce.organization_name,
                            o.name
                        )
                        FROM charging_equipment ce
                        LEFT JOIN organization o ON ce.allocating_organization_id = o.organization_id
                        WHERE ce.charging_site_id = cs.charging_site_id
                          AND (ce.organization_name IS NOT NULL OR ce.allocating_organization_id IS NOT NULL)
                        ORDER BY ce.charging_equipment_id
                        LIMIT 1
                    )
                    WHERE EXISTS (
                        SELECT 1
                        FROM charging_equipment ce
                        WHERE ce.charging_site_id = cs.charging_site_id
                          AND (ce.organization_name IS NOT NULL OR ce.allocating_organization_id IS NOT NULL)
                    )
                ';

                EXECUTE '
                    UPDATE charging_site cs
                    SET allocating_organization_id = o.organization_id
                    FROM organization o
                    WHERE LOWER(TRIM(cs.allocating_organization_name)) = LOWER(TRIM(o.name))
                      AND cs.allocating_organization_name IS NOT NULL
                      AND cs.allocating_organization_id IS NULL
                ';
            END IF;
        END $$;
        """
    )

    # Step 6: Drop indexes for charging_equipment.allocating_organization_id (if exists)
    op.execute(
        """
        DROP INDEX IF EXISTS ix_charging_equipment_allocating_org_id
    """
    )

    # Step 7: Drop allocating_organization_id column from charging_equipment
    # Drop the foreign key constraint if it exists (handle different naming conventions)
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_charging_equipment_allocating_organization_id'
                  AND conrelid = 'charging_equipment'::regclass
            ) THEN
                ALTER TABLE charging_equipment DROP CONSTRAINT fk_charging_equipment_allocating_organization_id;
            END IF;
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'charging_equipment_allocating_organization_id_fkey'
                  AND conrelid = 'charging_equipment'::regclass
            ) THEN
                ALTER TABLE charging_equipment DROP CONSTRAINT charging_equipment_allocating_organization_id_fkey;
            END IF;
        END $$;
    """
    )
    op.drop_column("charging_equipment", "allocating_organization_id", if_exists=True)

    # Step 8: Drop organization_name column from charging_equipment (related field)
    op.drop_column("charging_equipment", "organization_name", if_exists=True)

    # Step 9: Drop indexes for charging_site_intended_user_association (if exist)
    op.execute(
        """
        DROP INDEX IF EXISTS ix_cs_intended_user_site_id
    """
    )
    op.execute(
        """
        DROP INDEX IF EXISTS ix_cs_intended_user_user_type_id
    """
    )

    # Step 10: Drop charging_site_intended_user_association table
    op.drop_table("charging_site_intended_user_association", if_exists=True)


def downgrade() -> None:
    # Step 1: Recreate charging_site_intended_user_association table
    op.create_table(
        "charging_site_intended_user_association",
        sa.Column(
            "charging_site_id",
            sa.Integer(),
            sa.ForeignKey("charging_site.charging_site_id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "end_user_type_id",
            sa.Integer(),
            sa.ForeignKey("end_user_type.end_user_type_id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        comment="Association table linking charging sites to their intended user types",
    )

    # Step 2: Recreate indexes for charging_site_intended_user_association
    op.create_index(
        "ix_cs_intended_user_site_id",
        "charging_site_intended_user_association",
        ["charging_site_id"],
    )
    op.create_index(
        "ix_cs_intended_user_user_type_id",
        "charging_site_intended_user_association",
        ["end_user_type_id"],
    )

    # Step 3: Add organization_name column back to charging_equipment
    op.add_column(
        "charging_equipment",
        sa.Column(
            "organization_name",
            sa.Text(),
            nullable=True,
            comment="Optional organization name for allocating organization",
        ),
    )

    # Step 4: Add allocating_organization_id column back to charging_equipment
    op.add_column(
        "charging_equipment",
        sa.Column(
            "allocating_organization_id",
            sa.Integer(),
            sa.ForeignKey("organization.organization_id", ondelete="SET NULL"),
            nullable=True,
            comment="Organization that the equipment's reporting obligation is allocated to",
        ),
    )

    # Step 5: Recreate index for charging_equipment.allocating_organization_id
    op.create_index(
        "ix_charging_equipment_allocating_org_id",
        "charging_equipment",
        ["allocating_organization_id"],
    )

    # Step 6: Migrate data back from site to equipment
    # First migrate the FK if it exists
    op.execute(
        """
        UPDATE charging_equipment ce
        SET allocating_organization_id = (
            SELECT cs.allocating_organization_id
            FROM charging_site cs
            WHERE cs.charging_site_id = ce.charging_site_id
        )
        WHERE EXISTS (
            SELECT 1
            FROM charging_site cs
            WHERE cs.charging_site_id = ce.charging_site_id
              AND cs.allocating_organization_id IS NOT NULL
        )
        """
    )

    # Then migrate the name field
    op.execute(
        """
        UPDATE charging_equipment ce
        SET organization_name = (
            SELECT cs.allocating_organization_name
            FROM charging_site cs
            WHERE cs.charging_site_id = ce.charging_site_id
        )
        WHERE EXISTS (
            SELECT 1
            FROM charging_site cs
            WHERE cs.charging_site_id = ce.charging_site_id
              AND cs.allocating_organization_name IS NOT NULL
        )
        """
    )

    # Step 7: Drop index for allocating_organization_id
    op.drop_index("ix_charging_site_allocating_org_id", "charging_site", if_exists=True)

    # Step 8: Drop allocating_organization_name from charging_site
    op.drop_column("charging_site", "allocating_organization_name", if_exists=True)

    # Step 9: Drop allocating_organization_id from charging_site
    op.drop_column("charging_site", "allocating_organization_id", if_exists=True)
