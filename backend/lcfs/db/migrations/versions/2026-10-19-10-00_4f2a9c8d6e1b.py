"""Retire designated-action-level Missing information storage.

The prior migration moves Missing information to active evidence requirements
and keeps any value that has no EOC target. Remove the legacy column only
after every nonblank value has been accounted for.

Revision ID: 4f2a9c8d6e1b
Revises: 5f7a5242e0c1
Create Date: 2026-10-19 10:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "4f2a9c8d6e1b"
down_revision = "5f7a5242e0c1"
branch_labels = None
depends_on = None


def _unmapped_action_ids(connection):
    return (
        connection.execute(
            sa.text(
                """
                SELECT designated_action_id
                  FROM designated_action
                 WHERE missing_information IS NOT NULL
                   AND NULLIF(TRIM(missing_information), '') IS NOT NULL
                 ORDER BY designated_action_id
                """
            )
        )
        .scalars()
        .all()
    )


def upgrade() -> None:
    connection = op.get_bind()
    unmapped_action_ids = _unmapped_action_ids(connection)
    if unmapped_action_ids:
        action_ids = ", ".join(str(action_id) for action_id in unmapped_action_ids)
        raise RuntimeError(
            "Cannot safely remove designated-action Missing information while "
            "legacy values remain unmapped for designated action IDs: "
            f"{action_ids}. Move each value to its correct active EOC and rerun."
        )

    connection.execute(
        sa.text(
            """
            UPDATE designated_action
               SET missing_information = NULL
             WHERE missing_information IS NOT NULL
               AND NULLIF(TRIM(missing_information), '') IS NULL
            """
        )
    )
    op.drop_column("designated_action", "missing_information")


def downgrade() -> None:
    connection = op.get_bind()
    ambiguous_action_ids = (
        connection.execute(
            sa.text(
                """
                SELECT designated_action_id
                  FROM evidence_requirement
                 WHERE missing_information IS NOT NULL
                   AND NULLIF(TRIM(missing_information), '') IS NOT NULL
                 GROUP BY designated_action_id
                HAVING COUNT(DISTINCT missing_information) > 1
                 ORDER BY designated_action_id
                """
            )
        )
        .scalars()
        .all()
    )
    if ambiguous_action_ids:
        action_ids = ", ".join(str(action_id) for action_id in ambiguous_action_ids)
        raise RuntimeError(
            "Cannot restore designated-action Missing information because "
            "different EOC values exist for designated action IDs: "
            f"{action_ids}."
        )

    op.add_column(
        "designated_action",
        sa.Column("missing_information", sa.Text(), nullable=True),
    )
    connection.execute(
        sa.text(
            """
            UPDATE designated_action AS action
               SET missing_information = (
                   SELECT MIN(requirement.missing_information)
                     FROM evidence_requirement AS requirement
                    WHERE requirement.designated_action_id =
                              action.designated_action_id
                      AND requirement.missing_information IS NOT NULL
                      AND NULLIF(TRIM(requirement.missing_information), '') IS NOT NULL
               )
            """
        )
    )
