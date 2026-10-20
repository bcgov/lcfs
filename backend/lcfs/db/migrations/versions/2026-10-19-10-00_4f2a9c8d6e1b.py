"""Move Missing information from designated actions to evidence requirements

Revision ID: 4f2a9c8d6e1b
Revises: e1f2a3b4c5d6
Create Date: 2026-10-19 10:00:00

"""

import sqlalchemy as sa
from alembic import op

revision = "4f2a9c8d6e1b"
down_revision = "c4d6e8f0a2b5"
branch_labels = None
depends_on = None


def _resolve_requirement_id(requirements):
    """Return the only safe active EOC target for an action's legacy text.

    A single active EOC is unambiguous. Review outcomes do not establish
    which EOC owns the legacy action-level text when several are active.
    """
    active = [row for row in requirements if row["is_active"]]
    if len(active) == 1:
        return active[0]["evidence_requirement_id"]

    raise ValueError("No unique active evidence requirement can be selected")


def upgrade() -> None:
    connection = op.get_bind()
    legacy_actions = (
        connection.execute(
            sa.text(
                """
            SELECT designated_action_id, missing_information
              FROM designated_action
             WHERE missing_information IS NOT NULL
             ORDER BY designated_action_id
            """
            )
        )
        .mappings()
        .all()
    )

    unmapped_action_ids = []
    mapped_values = []
    for action in legacy_actions:
        requirements = (
            connection.execute(
                sa.text(
                    """
                SELECT evidence_requirement_id, is_active
                  FROM evidence_requirement
                 WHERE designated_action_id = :designated_action_id
                 ORDER BY requirement_number, evidence_requirement_id
                """
                ),
                {"designated_action_id": action["designated_action_id"]},
            )
            .mappings()
            .all()
        )
        try:
            requirement_id = _resolve_requirement_id(requirements)
        except ValueError:
            unmapped_action_ids.append(action["designated_action_id"])
            continue

        mapped_values.append(
            {
                "missing_information": action["missing_information"],
                "evidence_requirement_id": requirement_id,
            },
        )

    if unmapped_action_ids:
        action_ids = ", ".join(str(action_id) for action_id in unmapped_action_ids)
        raise RuntimeError(
            "Cannot safely map existing Missing information for designated "
            f"action IDs: {action_ids}. Review their active evidence requirements "
            "and rerun the migration; the old values have not been removed."
        )

    op.add_column(
        "evidence_requirement",
        sa.Column(
            "missing_information",
            sa.Text(),
            nullable=True,
            comment=(
                "Information requested from the proponent for this evidence "
                "requirement; retained between review rounds"
            ),
        ),
    )
    if mapped_values:
        connection.execute(
            sa.text(
                """
                UPDATE evidence_requirement
                   SET missing_information = :missing_information
                 WHERE evidence_requirement_id = :evidence_requirement_id
                """
            ),
            mapped_values,
        )
    op.drop_column("designated_action", "missing_information")


def downgrade() -> None:
    connection = op.get_bind()
    ambiguous_actions = (
        connection.execute(
            sa.text(
                """
            SELECT designated_action_id
              FROM evidence_requirement
             WHERE missing_information IS NOT NULL
             GROUP BY designated_action_id
            HAVING count(*) > 1
             ORDER BY designated_action_id
            """
            )
        )
        .scalars()
        .all()
    )
    if ambiguous_actions:
        action_ids = ", ".join(str(action_id) for action_id in ambiguous_actions)
        raise RuntimeError(
            "Cannot safely move Missing information back to designated actions "
            f"because multiple EOCs have values for action IDs: {action_ids}."
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
    connection.execute(
        sa.text(
            """
            UPDATE designated_action AS action
               SET missing_information = requirement.missing_information
              FROM evidence_requirement AS requirement
             WHERE requirement.designated_action_id = action.designated_action_id
               AND requirement.missing_information IS NOT NULL
            """
        )
    )
    op.drop_column("evidence_requirement", "missing_information")
