"""Create forms with organization link keys

Revision ID: 18ca1084ea82
Revises: 3f5a7b9c1d2e
Create Date: 2025-08-07 14:28:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "18ca1084ea82"
down_revision = "3f5a7b9c1d2e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Create forms table
    op.create_table(
        "forms",
        sa.Column(
            "form_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the form",
        ),
        sa.Column(
            "name",
            sa.String(length=100),
            nullable=False,
            comment="Name of the form",
        ),
        sa.Column(
            "slug",
            sa.String(length=50),
            nullable=False,
            comment="URL-friendly identifier for the form",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
            comment="Detailed description of the form's purpose",
        ),
        sa.Column(
            "allows_anonymous",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="Whether the form allows anonymous access via link key",
        ),
        sa.Column(
            "create_date",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
            comment="Date and time the record was created",
        ),
        sa.Column(
            "update_date",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
            comment="Date and time the record was last updated",
        ),
        sa.PrimaryKeyConstraint("form_id"),
        sa.UniqueConstraint("slug", name="uq_forms_slug"),
        comment="Stores dynamic form definitions and configurations",
    )

    # Step 2: Create indexes for forms table
    op.create_index("idx_forms_slug", "forms", ["slug"])

    # Step 3: Create organization_link_keys table
    op.create_table(
        "organization_link_keys",
        sa.Column(
            "link_key_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for the link key record",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key reference to organization",
        ),
        sa.Column(
            "form_id",
            sa.Integer(),
            nullable=False,
            comment="Foreign key reference to form",
        ),
        sa.Column(
            "link_key",
            sa.String(length=64),
            nullable=False,
            comment="Secure link key for anonymous form access",
        ),
        sa.Column(
            "expiry_date",
            sa.DateTime(),
            nullable=True,
            comment="Optional expiry date; when set and in the past, key is invalid",
        ),
        sa.Column(
            "create_date",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
            comment="Date and time the record was created",
        ),
        sa.Column(
            "update_date",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
            comment="Date and time the record was last updated",
        ),
        sa.PrimaryKeyConstraint("link_key_id"),
        sa.UniqueConstraint("link_key", name="uq_organization_link_keys_link_key"),
        sa.UniqueConstraint(
            "organization_id", "form_id", name="uq_organization_link_keys_org_form"
        ),
        comment="Stores secure link keys for anonymous organization form access",
    )

    # Step 4: Create foreign key constraints for organization_link_keys
    op.create_foreign_key(
        "fk_organization_link_keys_organization_id",
        "organization_link_keys",
        "organization",
        ["organization_id"],
        ["organization_id"],
    )
    op.create_foreign_key(
        "fk_organization_link_keys_form_id",
        "organization_link_keys",
        "forms",
        ["form_id"],
        ["form_id"],
    )

    # Step 5: Create indexes for organization_link_keys table
    op.create_index(
        "idx_organization_link_keys_org_id",
        "organization_link_keys",
        ["organization_id"],
    )
    op.create_index(
        "idx_organization_link_keys_form_id", "organization_link_keys", ["form_id"]
    )

    # Step 6: Insert default forms data
    forms_table = sa.table(
        "forms",
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("description", sa.Text),
    )

    op.bulk_insert(
        forms_table,
        [
            {
                "name": "Exemption Request",
                "slug": "exemption-request",
                "description": "Request exemption from compliance requirements",
            },
            {
                "name": "Fuel Code Application",
                "slug": "fuel-code-application",
                "description": "Apply for new fuel code",
            },
            {
                "name": "CI Application",
                "slug": "ci-application",
                "description": "Apply for carbon intensity determination",
            },
        ],
    )


def downgrade() -> None:
    # Drop organization_link_keys table and its constraints/indexes
    op.drop_constraint(
        "fk_organization_link_keys_form_id",
        "organization_link_keys",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_organization_link_keys_organization_id",
        "organization_link_keys",
        type_="foreignkey",
    )
    op.drop_index("idx_organization_link_keys_form_id", "organization_link_keys")
    op.drop_index("idx_organization_link_keys_org_id", "organization_link_keys")
    op.drop_table("organization_link_keys")

    # Drop forms table and its indexes
    op.drop_index("idx_forms_slug", "forms")
    op.drop_table("forms")
