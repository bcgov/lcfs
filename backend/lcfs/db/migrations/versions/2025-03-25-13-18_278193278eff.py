"""
Add is_user_safe_to_remove function that checks references in create_user/update_user columns

Revision ID: 278193278eff
Revises: 594e7a7af9f1
Create Date: 2025-03-25 13:18:24.603159
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "278193278eff"
down_revision = "594e7a7af9f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION is_user_safe_to_remove(the_username TEXT)
        RETURNS BOOLEAN AS
        $$
        DECLARE
            rec RECORD;
            references_found BIGINT;
        BEGIN
            FOR rec IN
                SELECT table_name, column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_name IN ('create_user', 'update_user')
            LOOP
                EXECUTE format(
                    'SELECT COUNT(*) FROM %I WHERE LOWER(%I) = LOWER($1)',
                    rec.table_name,
                    rec.column_name
                )
                INTO references_found
                USING the_username;

                IF references_found > 0 THEN
                    -- Found at least one reference, so it's not safe to remove
                    RETURN FALSE;
                END IF;
            END LOOP;

            -- If we found no references in any table/column, it's safe to remove
            RETURN TRUE;
        END;
        $$
        LANGUAGE plpgsql;
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS is_user_safe_to_remove(TEXT);")
