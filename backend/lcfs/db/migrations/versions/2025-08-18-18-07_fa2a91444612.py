"""Enable audit logging for obfuscated link key feature

Revision ID: fa2a91444612
Revises: 18ca1084ea82
Create Date: 2025-08-11 18:07:59.958645

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "fa2a91444612"
down_revision = "18ca1084ea82"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN SELECT tablename
                     FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN (
                         'organization_link_keys', 'forms'
                       )
            LOOP
                EXECUTE format('
                    CREATE TRIGGER audit_%I_insert_update_delete
                    AFTER INSERT OR UPDATE OR DELETE ON %I
                    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();',
                    r.tablename, r.tablename);
            END LOOP;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN SELECT tablename
                     FROM pg_tables
                     WHERE schemaname = 'public'
                       AND tablename IN (
                          'organization_link_keys', 'forms'
                       )
            LOOP
                EXECUTE format('
                    DROP TRIGGER IF EXISTS audit_%I_insert_update_delete ON %I;',
                    r.tablename, r.tablename);
            END LOOP;
        END $$;
        """
    )
