"""Create credit market audit log table

Revision ID: 8e9f1a2b3c4d
Revises: f3b1b9f03c9a
Create Date: 2026-02-11 10:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8e9f1a2b3c4d"
down_revision = "f3b1b9f03c9a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credit_market_audit_log",
        sa.Column(
            "credit_market_audit_log_id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for each credit market audit log entry.",
        ),
        sa.Column(
            "organization_id",
            sa.Integer(),
            nullable=False,
            comment="Organization associated with the credit market listing change.",
        ),
        sa.Column(
            "credits_to_sell",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
            comment="Credits to sell at the time of the change.",
        ),
        sa.Column(
            "credit_market_is_seller",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether the organization was marked as seller.",
        ),
        sa.Column(
            "credit_market_is_buyer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether the organization was marked as buyer.",
        ),
        sa.Column(
            "contact_person",
            sa.String(length=500),
            nullable=True,
            comment="Credit market contact person name.",
        ),
        sa.Column(
            "phone",
            sa.String(length=50),
            nullable=True,
            comment="Credit market contact phone.",
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
            comment="Credit market contact email.",
        ),
        sa.Column(
            "changed_by",
            sa.String(length=255),
            nullable=True,
            comment="BCeID/IDIR username that performed the listing change.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.PrimaryKeyConstraint(
            "credit_market_audit_log_id", name=op.f("pk_credit_market_audit_log")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.organization_id"],
            name=op.f("fk_credit_market_audit_log_organization_id_organization"),
        ),
        comment="Captures historical snapshots of credit trading market listings after each change.",
    )

    op.create_index(
        "idx_credit_market_audit_log_create_date",
        "credit_market_audit_log",
        ["create_date"],
        unique=False,
    )
    op.create_index(
        "idx_credit_market_audit_log_changed_by",
        "credit_market_audit_log",
        ["changed_by"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_credit_market_audit_log_changed_by",
        table_name="credit_market_audit_log",
    )
    op.drop_index(
        "idx_credit_market_audit_log_create_date",
        table_name="credit_market_audit_log",
    )
    op.drop_table("credit_market_audit_log")
