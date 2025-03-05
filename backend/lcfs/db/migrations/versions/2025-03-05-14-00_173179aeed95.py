"""Add versioning to allocation agreement

Revision ID: 173179aeed95
Revises: 9e1da9e38f20
Create Date: 2025-03-05 14:00:17.134309

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "173179aeed95"
down_revision = "4a34a52085f2"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Ensure the uuid-ossp extension is enabled
    conn.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))

    op.add_column(
        "allocation_agreement",
        sa.Column("group_uuid", sa.String(length=36), nullable=True),
    )
    op.add_column(
        "allocation_agreement", sa.Column("version", sa.Integer(), nullable=True)
    )
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "user_type",
            postgresql.ENUM(
                "SUPPLIER", "GOVERNMENT", name="usertypeenum", create_type=False
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "allocation_agreement",
        sa.Column(
            "action_type",
            postgresql.ENUM(
                "CREATE", "UPDATE", "DELETE", name="actiontypeenum", create_type=False
            ),
            nullable=True,
        ),
    )

    # Create index on group_uuid
    op.create_index(
        "ix_allocation_agreement_group_uuid", "allocation_agreement", ["group_uuid"]
    )

    # Update existing records to have default values
    conn.execute(
        sa.text(
            "UPDATE allocation_agreement SET group_uuid = uuid_generate_v4(), version = 1, "
            "user_type = 'SUPPLIER', action_type = 'CREATE' "
            "WHERE group_uuid IS NULL"
        )
    )

    # Make columns non-nullable after populating data
    op.alter_column("allocation_agreement", "group_uuid", nullable=False)
    op.alter_column("allocation_agreement", "version", nullable=False)
    op.alter_column("allocation_agreement", "user_type", nullable=False)
    op.alter_column("allocation_agreement", "action_type", nullable=False)


def downgrade():
    # Drop columns in reverse order
    op.drop_index("ix_allocation_agreement_group_uuid", "allocation_agreement")
    op.drop_column("allocation_agreement", "action_type")
    op.drop_column("allocation_agreement", "user_type")
    op.drop_column("allocation_agreement", "version")
    op.drop_column("allocation_agreement", "group_uuid")

