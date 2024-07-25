"""Add organization_code to organization table

Revision ID: 123456789abc
Revises: 77cedc7696b3
Create Date: 2024-07-18 00:11:00.018679

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "123456789abc"
down_revision = "77cedc7696b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('organization', sa.Column(
        'organization_code',
        sa.String(length=4),
        nullable=False,
        unique=True,
        comment="Unique 4-character alphanumeric ID"
    ))
    op.create_index(op.f('ix_organization_organization_code'), 'organization', ['organization_code'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_organization_organization_code'), table_name='organization')
    op.drop_column('organization', 'organization_code')
