"""assessment statement

Revision ID: 6c427c10a63d
Revises: 937c793bf7b8
Create Date: 2025-03-11 19:53:16.260428

"""

import sqlalchemy as sa
from alembic import op
from alembic_postgresql_enum import TableReference
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "6c427c10a63d"
down_revision = "937c793bf7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column(
        "compliance_report",
        sa.Column(
            "assessment_statement",
            sa.String(),
            nullable=True,
            comment="Assessment statement for the compliance report",
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column("compliance_report", "assessment_statement")
    # ### end Alembic commands ###
