"""Store missing information on each evidence requirement.

Backfill the current DA-level text to every active EOC. Keep legacy text on
actions that do not yet have an active EOC; the first EOC created for such an
action receives that text in the application service.

Revision ID: 5f7a5242e0c1
Revises: c4d6e8f0a2b5
Create Date: 2026-10-16 09:00:00
"""

from alembic import op
import sqlalchemy as sa

revision = "5f7a5242e0c1"
down_revision = "c4d6e8f0a2b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evidence_requirement",
        sa.Column(
            "missing_information",
            sa.Text(),
            nullable=True,
            comment=(
                "Information requested from the proponent for this evidence "
                "requirement"
            ),
        ),
    )

    op.execute(
        """
        UPDATE evidence_requirement AS requirement
           SET missing_information = designated_action.missing_information
          FROM designated_action
         WHERE requirement.designated_action_id =
                   designated_action.designated_action_id
           AND requirement.is_active IS TRUE
           AND NULLIF(BTRIM(designated_action.missing_information), '') IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE designated_action
           SET missing_information = NULL
         WHERE EXISTS (
             SELECT 1
               FROM evidence_requirement
              WHERE evidence_requirement.designated_action_id =
                        designated_action.designated_action_id
                AND evidence_requirement.is_active IS TRUE
         )
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE designated_action AS action
           SET missing_information = aggregated.missing_information
          FROM (
              SELECT designated_action_id,
                     string_agg(
                         'EOC ' || requirement_number || ' - ' ||
                         COALESCE(NULLIF(title, ''), description) || ': ' ||
                         missing_information,
                         E'\\n\\n'
                         ORDER BY requirement_number, evidence_requirement_id
                     ) AS missing_information
                FROM evidence_requirement
               WHERE is_active IS TRUE
                 AND NULLIF(BTRIM(missing_information), '') IS NOT NULL
               GROUP BY designated_action_id
          ) AS aggregated
         WHERE action.designated_action_id = aggregated.designated_action_id
        """
    )
    op.drop_column("evidence_requirement", "missing_information")
