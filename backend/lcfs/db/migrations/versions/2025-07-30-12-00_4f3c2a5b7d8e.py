"""Add credit market features to organization table

Revision ID: 4f3c2a5b7d8e
Revises: b1c2d3e4f5g6
Create Date: 2025-07-30 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "4f3c2a5b7d8e"
down_revision = "b1c2d3e4f5g6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add credit trading enabled flag
    op.add_column(
        "organization",
        sa.Column(
            "credit_trading_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether the organization is enabled for credit trading market participation",
        ),
    )
    
    # Add credit market contact fields
    op.add_column(
        "organization",
        sa.Column(
            "credit_market_contact_name",
            sa.String(length=500),
            nullable=True,
            comment="Contact name for credit trading market (if different from organization)",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "credit_market_contact_email",
            sa.String(length=255),
            nullable=True,
            comment="Contact email for credit trading market (if different from organization)",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "credit_market_contact_phone",
            sa.String(length=50),
            nullable=True,
            comment="Contact phone for credit trading market (if different from organization)",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "credit_market_is_seller",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether the organization is interested in selling credits",
        ),
    )
    op.add_column(
        "organization",
        sa.Column(
            "credit_market_is_buyer",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether the organization is interested in buying credits",
        ),
    )
    
    # Add credits to sell field
    op.add_column(
        "organization", 
        sa.Column(
            "credits_to_sell", 
            sa.Integer(), 
            server_default=sa.text("0"), 
            nullable=False, 
            comment="Number of credits the organization wants to sell"
        )
    )
    
    # Add display in credit market field
    op.add_column(
        "organization", 
        sa.Column(
            "display_in_credit_market", 
            sa.Boolean(), 
            server_default=sa.text("false"), 
            nullable=False, 
            comment="Whether the organization should be displayed in the credit trading market"
        )
    )


def downgrade() -> None:
    # Remove all credit market fields in reverse order
    op.drop_column("organization", "display_in_credit_market")
    op.drop_column("organization", "credits_to_sell")
    op.drop_column("organization", "credit_market_is_buyer")
    op.drop_column("organization", "credit_market_is_seller")
    op.drop_column("organization", "credit_market_contact_phone")
    op.drop_column("organization", "credit_market_contact_email")
    op.drop_column("organization", "credit_market_contact_name")
    op.drop_column("organization", "credit_trading_enabled")