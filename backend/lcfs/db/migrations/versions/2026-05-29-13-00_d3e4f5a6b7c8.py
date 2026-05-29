"""Switch report_opening from supplemental_report_role enum to create_supplemental_enabled boolean.

The new boolean is a BCeID-only visibility toggle. Existing rows are migrated from the
old enum: BCeID -> true, IDIR -> false.

Revision ID: d3e4f5a6b7c8
Revises: c2a4f6b8d9e1
Create Date: 2026-05-29 13:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d3e4f5a6b7c8"
down_revision = "c2a4f6b8d9e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable first so we can populate from the existing enum values.
    op.add_column(
        "report_opening",
        sa.Column(
            "create_supplemental_enabled",
            sa.Boolean(),
            nullable=True,
            comment=(
                "If True, the Create supplemental report button is shown to BCeID "
                "users for this year (when it is otherwise eligible to appear)"
            ),
        ),
    )

    # Only BCeID years remain enabled; IDIR years are disabled for BCeID users.
    op.execute(
        """
        UPDATE report_opening
        SET create_supplemental_enabled = (supplemental_report_role = 'BCeID')
        """
    )

    op.alter_column(
        "report_opening",
        "create_supplemental_enabled",
        nullable=False,
        server_default=sa.text("true"),
    )

    op.drop_column("report_opening", "supplemental_report_role")
    op.execute("DROP TYPE IF EXISTS supplemental_report_access_role_enum")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE supplemental_report_access_role_enum AS ENUM ('BCeID', 'IDIR')"
    )

    op.add_column(
        "report_opening",
        sa.Column(
            "supplemental_report_role",
            sa.Enum("BCeID", "IDIR", name="supplemental_report_access_role_enum"),
            nullable=False,
            server_default=sa.text("'BCeID'"),
            comment="Which role (BCeID or IDIR) may create supplemental reports for the year",
        ),
    )

    op.execute(
        """
        UPDATE report_opening
        SET supplemental_report_role = CASE
            WHEN create_supplemental_enabled = true
                THEN 'BCeID'::supplemental_report_access_role_enum
            ELSE 'IDIR'::supplemental_report_access_role_enum
        END
        """
    )

    op.drop_column("report_opening", "create_supplemental_enabled")
