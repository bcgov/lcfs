"""Add organization_code to organization table

Revision ID: 123456789abc
Revises: 77cedc7696b3
Create Date: 2024-07-18 00:11:00.018679

"""

import sqlalchemy as sa
from alembic import op
import string
import random
from sqlalchemy.sql import table, column
from sqlalchemy.exc import IntegrityError

# revision identifiers, used by Alembic.
revision = "123456789abc"
down_revision = "77cedc7696b3"
branch_labels = None
depends_on = None


def generate_unique_code(connection):
    """Generates a unique 4-character alphanumeric code."""
    characters = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choices(characters, k=4))
        result = connection.execute(
            sa.text(
                "SELECT 1 FROM organization WHERE organization_code = :code LIMIT 1"
            ),
            {"code": code},
        )
        if not result.fetchone():
            return code


def upgrade() -> None:
    # Step 1: Add the column as nullable
    op.add_column(
        "organization",
        sa.Column(
            "organization_code",
            sa.String(length=4),
            nullable=True,
            comment="Unique 4-character alphanumeric ID",
        ),
    )

    # Step 2: Update existing rows with unique codes
    connection = op.get_bind()
    organization_table = table(
        "organization",
        column("organization_id", sa.Integer),
        column("organization_code", sa.String),
    )

    # Fetch all organization IDs
    organizations = connection.execute(
        sa.select(organization_table.c.organization_id)
    ).fetchall()

    for (org_id,) in organizations:
        while True:
            try:
                unique_code = generate_unique_code(connection)
                connection.execute(
                    organization_table.update()
                    .where(organization_table.c.organization_id == org_id)
                    .values(organization_code=unique_code)
                )
                break
            except IntegrityError:
                # In the unlikely event of a collision, try again
                continue

    # Step 3: Set the column to non-nullable
    op.alter_column("organization", "organization_code", nullable=False)

    # Step 4: Add the unique constraint
    op.create_index(
        op.f("ix_organization_organization_code"),
        "organization",
        ["organization_code"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_organization_organization_code"), table_name="organization")
    op.drop_column("organization", "organization_code")
