"""Delete Dead Links

Revision ID: e77de76bb555
Revises: 67e5de628cef
Create Date: 2025-03-17 20:44:00.115397

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e77de76bb555"
down_revision = "67e5de628cef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Delete Dead Address
    op.execute(
        """
        UPDATE organization AS o
        SET
            organization_address_id = NULL
        WHERE
            o.organization_address_id IS NOT NULL
            AND NOT EXISTS (
                SELECT
                    1
                FROM
                    organization_address AS a
                WHERE
                    a.organization_address_id = o.organization_address_id
            );
    """
    )

    # Delete Dead Attorney Address
    op.execute(
        """
        UPDATE organization AS o
        SET
            organization_attorney_address_id = NULL
        WHERE
            o.organization_attorney_address_id IS NOT NULL
            AND NOT EXISTS (
                SELECT
                    1
                FROM
                    organization_attorney_address AS a
                WHERE
                    a.organization_attorney_address_id = o.organization_attorney_address_id
            );
    """
    )


def downgrade() -> None:
    pass
