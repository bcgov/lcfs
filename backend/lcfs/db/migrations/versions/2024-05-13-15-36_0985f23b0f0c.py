"""issuance field updates

Revision ID: 0985f23b0f0c
Revises: f141c1431961
Create Date: 2024-05-13 15:36:40.362106

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "0985f23b0f0c"
down_revision = "f141c1431961"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "admin_adjustment",
        sa.Column(
            "gov_comment",
            sa.String(length=1500),
            nullable=True,
            comment="Comment from the government to organization",
        ),
    )
    op.drop_constraint(
        "admin_adjustment_comment_id_fkey", "admin_adjustment", type_="foreignkey"
    )
    op.drop_column("admin_adjustment", "comment_id")
    op.add_column(
        "admin_adjustment_history",
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
    )
    op.create_foreign_key(
        None,
        "admin_adjustment_history",
        "user_profile",
        ["user_profile_id"],
        ["user_profile_id"],
    )
    op.add_column(
        "initiative_agreement",
        sa.Column(
            "gov_comment",
            sa.String(length=1500),
            nullable=True,
            comment="Comment from the government to organization",
        ),
    )
    op.drop_constraint(
        "initiative_agreement_comment_id_fkey",
        "initiative_agreement",
        type_="foreignkey",
    )
    op.drop_column("initiative_agreement", "comment_id")
    op.add_column(
        "initiative_agreement_history",
        sa.Column(
            "user_profile_id",
            sa.Integer(),
            nullable=True,
            comment="Foreign key to user_profile",
        ),
    )
    op.create_foreign_key(
        None,
        "initiative_agreement_history",
        "user_profile",
        ["user_profile_id"],
        ["user_profile_id"],
    )
    op.drop_table("comment")


def downgrade() -> None:
    op.create_table(
        "comment",
        sa.Column(
            "comment_id",
            sa.INTEGER(),
            autoincrement=True,
            nullable=False,
            comment="Unique identifier for comment",
        ),
        sa.Column(
            "comment",
            sa.VARCHAR(length=500),
            autoincrement=False,
            nullable=True,
            comment="Comment",
        ),
        sa.Column(
            "create_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was created in the database.",
        ),
        sa.Column(
            "update_date",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            autoincrement=False,
            nullable=True,
            comment="Date and time (UTC) when the physical record was updated in the database. It will be the same as the create_date until the record is first updated after creation.",
        ),
        sa.Column(
            "create_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who created this record in the database.",
        ),
        sa.Column(
            "update_user",
            sa.VARCHAR(),
            autoincrement=False,
            nullable=True,
            comment="The user who last updated this record in the database.",
        ),
        sa.Column(
            "effective_date",
            sa.DATE(),
            autoincrement=False,
            nullable=True,
            comment="The calendar date the value became valid.",
        ),
        sa.Column(
            "expiration_date",
            sa.DATE(),
            autoincrement=False,
            nullable=True,
            comment="The calendar date the value is no longer valid.",
        ),
        sa.PrimaryKeyConstraint("comment_id", name="comment_pkey"),
        comment="Comment for transaction",
    )
    op.drop_constraint(None, "initiative_agreement_history", type_="foreignkey")
    op.drop_column("initiative_agreement_history", "user_profile_id")
    op.add_column(
        "initiative_agreement",
        sa.Column("comment_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.create_foreign_key(
        "initiative_agreement_comment_id_fkey",
        "initiative_agreement",
        "comment",
        ["comment_id"],
        ["comment_id"],
    )
    op.drop_column("initiative_agreement", "gov_comment")
    op.drop_constraint(None, "admin_adjustment_history", type_="foreignkey")
    op.drop_column("admin_adjustment_history", "user_profile_id")
    op.add_column(
        "admin_adjustment",
        sa.Column("comment_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.create_foreign_key(
        "admin_adjustment_comment_id_fkey",
        "admin_adjustment",
        "comment",
        ["comment_id"],
        ["comment_id"],
    )
    op.drop_column("admin_adjustment", "gov_comment")
