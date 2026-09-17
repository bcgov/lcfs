"""Merge the Initiative Agreements chain with develop

The Initiative Agreements chain and develop's recent migrations both
branch from d9e0f1a2b3c4. Joining them by re-parenting the chain onto
develop's head slid develop's migrations underneath revisions some
databases had already applied, so on those databases `upgrade head`
was a no-op and the tables never appeared. A merge revision joins the
two lineages instead: a database on either branch upgrades through
whichever revisions it is missing.

No schema change of its own.

Revision ID: 0120c7fb5896
Revises: a4b6c8d0e2f4, aee96beadb45
Create Date: 2026-09-17 15:26:29

"""

# revision identifiers, used by Alembic.
revision = "0120c7fb5896"
down_revision = ("a4b6c8d0e2f4", "aee96beadb45")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
