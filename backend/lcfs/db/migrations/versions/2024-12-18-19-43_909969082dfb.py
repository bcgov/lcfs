"""Add Marine End Use

Revision ID: 909969082dfb
Revises: 851e09cf8661
Create Date: 2024-12-18 19:43:06.680781

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "909969082dfb"
down_revision = "851e09cf8661"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO "end_use_type" ("type", "intended_use", "create_user", "update_user") VALUES ('Marine', 't', 'no_user', 'no_user');
        """
    )

    op.execute(
        """
        INSERT INTO "public"."energy_effectiveness_ratio" ("fuel_category_id", "fuel_type_id", "end_use_type_id", "ratio", "create_user", "update_user", "effective_status") VALUES (2, 3, (SELECT end_use_type_id FROM "end_use_type" WHERE "type" = 'Marine'), 2.5, 'no_user', 'no_user', 't');
        """
    )


def downgrade() -> None:
    # Remove the inserted energy_effectiveness_ratio entry
    op.execute(
        """
        DELETE FROM "public"."energy_effectiveness_ratio"
        WHERE end_use_type_id = (SELECT end_use_type_id FROM "end_use_type" WHERE "type" = 'Marine');
        """
    )

    # Remove the inserted end_use_type entry
    op.execute(
        """
        DELETE FROM "end_use_type"
        WHERE "type" = 'Marine';
        """
    )
