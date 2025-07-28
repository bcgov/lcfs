"""Fix Compliance report types for Government adjustments

Revision ID: 33ec14737b15
Revises: ae2306fa8d72
Create Date: 2025-07-28 10:12:17.288846

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "33ec14737b15"
down_revision = "ae2306fa8d72"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE compliance_report cr
        SET nickname = replace(nickname, 'Supplemental report', 'Government adjustment')
        where 
            cr.supplemental_initiator = 'GOVERNMENT_REASSESSMENT'::supplementalinitiatortype;
    """
    )
    op.execute(sa.text("commit;"))


def downgrade() -> None:
    pass
