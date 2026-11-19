"""Give existing organization link keys an expiry date.

Link keys without an expiry date are no longer accepted. Keys that predate the
change get a 90-day grace period from the time of this migration so links already
shared with suppliers keep working until they are regenerated.

Revision ID: a4c7d2e9b1f3
Revises: 5499daec0001
Create Date: 2026-11-18 09:00:00.000000
"""

from alembic import op

revision = "a4c7d2e9b1f3"
down_revision = "5499daec0001"
branch_labels = None
depends_on = None

_OLD_COMMENT = (
    "Optional expiry date for the link key. When not null and in the past, "
    "the link key is considered expired and should not grant access."
)
_NEW_COMMENT = (
    "Expiry date (UTC) for the link key. A link key with no expiry date, "
    "or one in the past, is considered expired and does not grant access."
)


def upgrade() -> None:
    op.execute("""
        UPDATE organization_link_keys
        SET expiry_date = (now() AT TIME ZONE 'utc') + interval '90 days'
        WHERE expiry_date IS NULL
        """)
    op.execute(
        f"COMMENT ON COLUMN organization_link_keys.expiry_date IS '{_NEW_COMMENT}'"
    )


def downgrade() -> None:
    # The backfilled expiry dates are left in place: they cannot be told apart
    # from dates set deliberately.
    op.execute(
        f"COMMENT ON COLUMN organization_link_keys.expiry_date IS '{_OLD_COMMENT}'"
    )
