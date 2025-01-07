"""
Add is_legacy to Provisions and insert data

Revision ID: 94306eca5261
Revises: ca7200152130
Create Date: 2025-01-06 19:01:53.418638
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "94306eca5261"
down_revision = "ca7200152130"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add the new column
    op.add_column(
        "provision_of_the_act",
        sa.Column(
            "is_legacy",
            sa.Boolean(),
            server_default=sa.text("FALSE"),
            nullable=False,
            comment="Indicates if the provision is legacy and should not be used for new reports",
        ),
    )

    # 2) Insert or update data to populate is_legacy, etc.
    #    For demonstration, we'll use bulk_insert here. If your table already
    #    has data, you might prefer an UPDATE or a combination of both.
    provision_of_the_act = sa.Table(
        "provision_of_the_act",
        sa.MetaData(),
        sa.Column("provision_of_the_act_id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String),
        sa.Column("description", sa.String),
        sa.Column("create_user", sa.String),
        sa.Column("update_user", sa.String),
        sa.Column("display_order", sa.Integer),
        sa.Column("effective_date", sa.Date),
        sa.Column("effective_status", sa.Boolean),
        sa.Column("expiration_date", sa.Date),
        sa.Column("is_legacy", sa.Boolean),
    )

    op.bulk_insert(
        provision_of_the_act,
        [
            {
                "name": "Prescribed carbon intensity - Section 6 (5) (a)",
                "description": "Prescribed carbon intensity - Section 6 (5) (a)",
                "create_user": "no_user",
                "update_user": "no_user",
                "display_order": None,
                "effective_date": None,
                "effective_status": True,
                "expiration_date": None,
                "is_legacy": True,
            },
            {
                "name": "Prescribed carbon intensity - Section 6 (5) (b)",
                "description": "Prescribed carbon intensity - Section 6 (5) (b)",
                "create_user": "no_user",
                "update_user": "no_user",
                "display_order": None,
                "effective_date": None,
                "effective_status": True,
                "expiration_date": None,
                "is_legacy": True,
            },
            {
                "name": "Approved fuel code - Section 6 (5) (c)",
                "description": "Approved fuel code - Section 6 (5) (c)",
                "create_user": "no_user",
                "update_user": "no_user",
                "display_order": None,
                "effective_date": None,
                "effective_status": True,
                "expiration_date": None,
                "is_legacy": True,
            },
            {
                "name": "Default Carbon Intensity Value - Section 6 (5) (d) (i)",
                "description": "Default Carbon Intensity Value - Section 6 (5) (d) (i)",
                "create_user": "no_user",
                "update_user": "no_user",
                "display_order": None,
                "effective_date": None,
                "effective_status": True,
                "expiration_date": None,
                "is_legacy": True,
            },
            {
                "name": "GHGenius modelled - Section 6 (5) (d) (ii) (A)",
                "description": "GHGenius modelled - Section 6 (5) (d) (ii) (A)",
                "create_user": "no_user",
                "update_user": "no_user",
                "display_order": None,
                "effective_date": None,
                "effective_status": True,
                "expiration_date": None,
                "is_legacy": True,
            },
            {
                "name": "Alternative Method - Section 6 (5) (d) (ii) (B)",
                "description": "Alternative Method - Section 6 (5) (d) (ii) (B)",
                "create_user": "no_user",
                "update_user": "no_user",
                "display_order": None,
                "effective_date": None,
                "effective_status": True,
                "expiration_date": None,
                "is_legacy": True,
            },
        ],
    )


def downgrade() -> None:
    # Remove is_legacy column. (Data removal is optional or up to you.)
    op.drop_column("provision_of_the_act", "is_legacy")
