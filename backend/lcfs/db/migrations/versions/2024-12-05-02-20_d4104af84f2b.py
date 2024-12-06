"""Update Notification Types and remove data

Revision ID: d4104af84f2b
Revises: b69a33bbd135
Create Date: 2024-12-05 02:20:33.898150

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM

# Revision identifiers, used by Alembic.
revision = "d4104af84f2b"
down_revision = "b69a33bbd135"
branch_labels = None
depends_on = None


def upgrade():
    # Remove the notification types added in the previous migration
    op.execute("DELETE FROM notification_type;")

    # Alter the `name` column in `notification_type` to be a VARCHAR
    with op.batch_alter_table("notification_type") as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=ENUM(
                "TRANSFER_PARTNER_UPDATE",
                "TRANSFER_DIRECTOR_REVIEW",
                "INITIATIVE_APPROVED",
                "INITIATIVE_DA_REQUEST",
                "SUPPLEMENTAL_REQUESTED",
                "DIRECTOR_ASSESSMENT",
                name="notification_type_enum_v2",
            ),
            type_=sa.String(length=255),
            existing_nullable=False,
        )

    # Drop the old enum types
    op.execute("DROP TYPE IF EXISTS notification_type_enum_v2;")


def downgrade():
    # Re-create the old enum type
    notification_type_enum_v2 = ENUM(
        "TRANSFER_PARTNER_UPDATE",
        "TRANSFER_DIRECTOR_REVIEW",
        "INITIATIVE_APPROVED",
        "INITIATIVE_DA_REQUEST",
        "SUPPLEMENTAL_REQUESTED",
        "DIRECTOR_ASSESSMENT",
        name="notification_type_enum_v2",
    )
    notification_type_enum_v2.create(op.get_bind(), checkfirst=False)

    # Alter the `name` column back to the old enum
    with op.batch_alter_table("notification_type") as batch_op:
        batch_op.alter_column(
            "name",
            type_=notification_type_enum_v2,
            existing_type=sa.String(length=255),
            postgresql_using="name::text::notification_type_enum_v2",
            existing_nullable=False,
        )

    # Re-insert the previous notification types
    op.execute(
        """
        INSERT INTO notification_type (notification_type_id, name, description, email_content, create_user, update_user)
        VALUES
            (1, 'TRANSFER_PARTNER_UPDATE', 'Transfer partner update notification', 'Email content for transfer partner update', 'system', 'system'),
            (2, 'TRANSFER_DIRECTOR_REVIEW', 'Director review notification', 'Email content for director review', 'system', 'system'),
            (3, 'INITIATIVE_APPROVED', 'Initiative approved notification', 'Email content for initiative approval', 'system', 'system'),
            (4, 'INITIATIVE_DA_REQUEST', 'DA request notification', 'Email content for DA request', 'system', 'system'),
            (5, 'SUPPLEMENTAL_REQUESTED', 'Supplemental requested notification', 'Email content for supplemental request', 'system', 'system'),
            (6, 'DIRECTOR_ASSESSMENT', 'Director assessment notification', 'Email content for director assessment', 'system', 'system');
    """
    )

    # Reset the sequence for the id column
    op.execute(
        """
        SELECT setval('notification_type_id_seq', (SELECT MAX(notification_type_id) FROM notification_type));
    """
    )
