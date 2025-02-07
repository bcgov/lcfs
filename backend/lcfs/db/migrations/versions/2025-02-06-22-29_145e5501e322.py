"""
Add new transfer_comment table and migrate existing comment fields.

Revision ID: 145e5501e322
Revises: 6231e628ae7d
Create Date: 2025-02-06 22:29:53.919293

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "145e5501e322"
down_revision = "6231e628ae7d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the new transfer_comment_source_enum type
    sa.Enum(
        "FROM_ORG",
        "TO_ORG",
        "GOVERNMENT",
        name="transfer_comment_source_enum",
    ).create(op.get_bind())

    # Create the new transfer_comment table
    op.create_table(
        "transfer_comment",
        sa.Column(
            "transfer_comment_id",
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment="Identifier for the transfer comment.",
        ),
        sa.Column(
            "transfer_id",
            sa.Integer(),
            sa.ForeignKey("transfer.transfer_id"),
            nullable=False,
            comment="Foreign key to the transfer table.",
        ),
        sa.Column(
            "comment", sa.Text(), nullable=True, comment="Text content of the comment."
        ),
        sa.Column(
            "comment_source",
            postgresql.ENUM(
                "FROM_ORG",
                "TO_ORG",
                "GOVERNMENT",
                name="transfer_comment_source_enum",
                create_type=False,
            ),
            nullable=False,
            comment="Defines who made the comment: FROM_ORG, TO_ORG, or GOVERNMENT.",
        ),
        sa.Column(
            "create_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Timestamp for when this record was first created.",
        ),
        sa.Column(
            "update_date",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
            comment="Timestamp for the most recent update to this record.",
        ),
        sa.Column(
            "create_user",
            sa.String(),
            nullable=True,
            comment="Username or identifier of the user who created this record.",
        ),
        sa.Column(
            "update_user",
            sa.String(),
            nullable=True,
            comment="Username or identifier of the user who last updated this record.",
        ),
        sa.PrimaryKeyConstraint(
            "transfer_comment_id", name=op.f("pk_transfer_comment")
        ),
        comment="Stores comments for each transfer.",
    )

    # Insert existing comments from the transfer table into the new transfer_comment table
    op.execute(
        """
        INSERT INTO public.transfer_comment (
          transfer_id,
          "comment",
          comment_source,
          create_date,
          update_date,
          create_user,
          update_user
        )
        SELECT
          t.transfer_id,
          c.comment,
          c.comment_source,
          NULL::timestamptz AS create_date,
          NULL::timestamptz AS update_date,
          NULL AS create_user,
          NULL AS update_user
        FROM public.transfer t
        CROSS JOIN LATERAL (
          VALUES
            (t.from_org_comment, 'FROM_ORG'::transfer_comment_source_enum),
            (t.to_org_comment, 'TO_ORG'::transfer_comment_source_enum),
            (t.gov_comment, 'GOVERNMENT'::transfer_comment_source_enum)
        ) AS c("comment", comment_source)
        WHERE c.comment IS NOT NULL
          AND LENGTH(TRIM(c.comment)) > 0
        ORDER BY
          t.transfer_id,
          CASE c.comment_source
            WHEN 'FROM_ORG' THEN 1
            WHEN 'TO_ORG' THEN 2
            WHEN 'GOVERNMENT' THEN 3
          END;
        """
    )


def downgrade() -> None:
    # Drop the new transfer_comment table
    op.drop_table("transfer_comment")

    # Drop the new transfer_comment_source_enum type
    sa.Enum(
        "GOVERNMENT",
        "TO_ORG",
        "FROM_ORG",
        name="transfer_comment_source_enum",
    ).drop(op.get_bind())
