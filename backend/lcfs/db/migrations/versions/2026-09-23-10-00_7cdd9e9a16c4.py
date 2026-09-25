"""Add the Not recommended status and a designated action's missing information

The design review (#5118) gives the analyst a negative recommendation
beside "Recommend to manager". It is a status of its own so the manager
can see and act on it; it sorts between the two recommendation statuses,
which keeps the page's progress stepper at "Underway" while it waits.

It also keeps the "Missing information" box on the page between review
rounds. Until now that text existed only inside the request dialog and,
once sent, in the activity trail. The column holds the working text; the
request still records what was actually sent.

Revision ID: 7cdd9e9a16c4
Revises: a4b6c8d0e2f4
Create Date: 2026-09-23 10:00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "7cdd9e9a16c4"
down_revision = "a4b6c8d0e2f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO designated_action_status
            (status, description, display_order, create_user, update_user)
        SELECT 'Not recommended',
               'Analyst does not recommend issuing credits; with the IA manager',
               55, 'system', 'system'
        WHERE NOT EXISTS (
            SELECT 1 FROM designated_action_status WHERE status = 'Not recommended'
        )
        """
    )

    op.add_column(
        "designated_action",
        sa.Column(
            "missing_information",
            sa.Text(),
            nullable=True,
            comment=(
                "What the analyst needs from the proponent, kept on the page "
                "between review rounds; sent as the reason when additional "
                "information is requested"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("designated_action", "missing_information")

    # The status row cannot go while anything points at it. Actions that
    # were not recommended return to Underway, and their history entries
    # are relabelled the same way, so the downgrade is lossy for them.
    op.execute(
        """
        UPDATE designated_action
           SET current_status_id = (
               SELECT designated_action_status_id FROM designated_action_status
                WHERE status = 'Underway')
         WHERE current_status_id = (
               SELECT designated_action_status_id FROM designated_action_status
                WHERE status = 'Not recommended')
        """
    )
    op.execute(
        """
        UPDATE designated_action_history
           SET status_id = (
               SELECT designated_action_status_id FROM designated_action_status
                WHERE status = 'Underway')
         WHERE status_id = (
               SELECT designated_action_status_id FROM designated_action_status
                WHERE status = 'Not recommended')
        """
    )
    op.execute("DELETE FROM designated_action_status WHERE status = 'Not recommended'")
