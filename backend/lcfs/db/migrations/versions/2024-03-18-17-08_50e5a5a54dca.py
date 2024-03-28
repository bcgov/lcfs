"""migrations for internal comments and associations

Revision ID: 50e5a5a54dca
Revises: 4f19e1f5efba
Create Date: 2024-03-11 17:08:35.133449

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "50e5a5a54dca"
down_revision = "5674d1e61df6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ENUM type for audience scope
    audience_scope_enum = postgresql.ENUM('Director', 'Analyst', name='audience_scope', create_type=False)
    audience_scope_enum.create(op.get_bind(), checkfirst=False)

    # internal_comment table
    op.create_table(
        'internal_comment',
        sa.Column('internal_comment_id', sa.Integer(), primary_key=True, autoincrement=True, comment='Primary key, unique identifier for each internal comment.'),
        sa.Column('comment', sa.Text(), nullable=True, comment='Text of the comment.'),
        sa.Column('audience_scope', audience_scope_enum, nullable=False, comment='Defines the audience scope for the comment, e.g., Director, Analyst.'),
        sa.Column('create_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Timestamp when the record was created.'),
        sa.Column('update_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Timestamp when the record was last updated.'),
        sa.Column('create_user', sa.String(length=255), nullable=True, comment='Username of the creator of the record.'),
        sa.Column('update_user', sa.String(length=255), nullable=True, comment='Username of the last updater of the record.'),
        sa.PrimaryKeyConstraint('internal_comment_id'),
        sa.Index('ix_internal_comment_id', 'internal_comment_id', unique=True)
    )

    # transfer_internal_comment table
    op.create_table(
        'transfer_internal_comment',
        sa.Column('transfer_id', sa.Integer(), nullable=False, comment='Foreign key to transfer, part of the composite primary key.'),
        sa.Column('internal_comment_id', sa.Integer(), sa.ForeignKey('internal_comment.internal_comment_id'), nullable=False, comment='Foreign key to internal_comment, part of the composite primary key.'),
        sa.Column('create_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Timestamp when the record was created.'),
        sa.Column('update_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Timestamp when the record was last updated.'),
        sa.PrimaryKeyConstraint('transfer_id', 'internal_comment_id'),
        sa.Index('ix_transfer_internal_comment', 'transfer_id', 'internal_comment_id', unique=True)
    )

    # initiative_agreement_internal_comment table
    op.create_table(
        'initiative_agreement_internal_comment',
        sa.Column('initiative_agreement_id', sa.Integer(), nullable=False, comment='Foreign key to initiative_agreement, part of the composite primary key.'),
        sa.Column('internal_comment_id', sa.Integer(), sa.ForeignKey('internal_comment.internal_comment_id'), nullable=False, comment='Foreign key to internal_comment, part of the composite primary key.'),
        sa.Column('create_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Timestamp when the record was created.'),
        sa.Column('update_date', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=True, comment='Timestamp when the record was last updated.'),
        sa.PrimaryKeyConstraint('initiative_agreement_id', 'internal_comment_id'),
        sa.Index('ix_initiative_agreement_internal_comment', 'initiative_agreement_id', 'internal_comment_id', unique=True)
    )

def downgrade() -> None:
    # Drop tables and ENUM type
    op.drop_table('initiative_agreement_internal_comment')
    op.drop_table('transfer_internal_comment')
    op.drop_table('internal_comment')
    postgresql.ENUM(name='audience_scope').drop(op.get_bind(), checkfirst=False)
