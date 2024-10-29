"""Create audit_log table

Revision ID: f44f01a35fc6
Revises: bb5504e743a0
Create Date: 2024-10-21 10:00:27.605949

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f44f01a35fc6"
down_revision = "bb5504e743a0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
        sa.Column("table_name", sa.Text(), nullable=False),
        sa.Column("operation", sa.Text(), nullable=False),
        sa.Column("row_id", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("old_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("delta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),

        sa.ForeignKeyConstraint(
            ["user_profile_id"],
            ["user_profile.user_profile_id"],
            name=op.f("fk_audit_log_user_profile_id_user_profile"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )
    op.create_index(
        "idx_audit_log_table_name", "audit_log", ["table_name"], unique=False
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("audit_log")
    # ### end Alembic commands ###