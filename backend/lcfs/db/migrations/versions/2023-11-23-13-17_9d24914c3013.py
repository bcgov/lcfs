"""fix unique constraints and enums

Revision ID: 9d24914c3013
Revises: 4bf9af8c64f9
Create Date: 2023-11-23 13:17:53.957485

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9d24914c3013"
down_revision = "4bf9af8c64f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_category_id", "category", ["category_id"])
    op.create_unique_constraint("uq_comment_id", "comment", ["comment_id"])
    op.create_unique_constraint("uq_issuance_id", "issuance", ["issuance_id"])
    op.create_unique_constraint("uq_issuance_history_id", "issuance_history", ["issuance_history_id"])
    op.create_unique_constraint("uq_transaction_id", "transaction", ["transaction_id"])
    op.create_unique_constraint("uq_transfer_id", "transfer", ["transfer_id"])


def downgrade() -> None:
    op.drop_constraint("uq_transfer_id", "transfer", type_="unique")
    op.drop_constraint("uq_transaction_id", "transaction", type_="unique")
    op.drop_constraint("uq_issuance_history_id", "issuance_history", type_="unique")
    op.drop_constraint("uq_issuance_id", "issuance", type_="unique")
    op.drop_constraint("uq_comment_id", "comment", type_="unique")
    op.drop_constraint("uq_category_id", "category", type_="unique")

    # Manually drop ENUM types
    op.execute('DROP TYPE IF EXISTS channel_enum CASCADE;')
    op.execute('DROP TYPE IF EXISTS notification_type_enum CASCADE;')
    op.execute('DROP TYPE IF EXISTS org_status_enum CASCADE;')
    op.execute('DROP TYPE IF EXISTS org_type_enum CASCADE;')
    op.execute('DROP TYPE IF EXISTS role_enum CASCADE;')
    op.execute('DROP TYPE IF EXISTS transaction_type_enum CASCADE;')
    op.execute('DROP TYPE IF EXISTS transfer_type_enum CASCADE;')


