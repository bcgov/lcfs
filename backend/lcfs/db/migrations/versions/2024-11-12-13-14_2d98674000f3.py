"""Prepare Notification endpoints

Revision ID: 2d98674000f3
Revises: b659816d0a86
Create Date: 2024-11-01 17:28:20.854410

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

# Revision identifiers, used by Alembic.
revision = "2d98674000f3"
down_revision = "b659816d0a86"
branch_labels = None
depends_on = None

# Define the new ENUM type with a different name
notification_type_enum_v2 = ENUM(
    "TRANSFER_PARTNER_UPDATE",
    "TRANSFER_DIRECTOR_REVIEW",
    "INITIATIVE_APPROVED",
    "INITIATIVE_DA_REQUEST",
    "SUPPLEMENTAL_REQUESTED",
    "DIRECTOR_ASSESSMENT",
    name="notification_type_enum_v2",
)

# Define enums if they haven’t been created earlier in the migration
channel_enum = ENUM("EMAIL", "IN_APP", name="channel_enum")


def upgrade():
    op.add_column("notification_message", sa.Column("message", sa.Text, nullable=False))

    op.create_unique_constraint(
        "uq_user_channel_type",
        "notification_channel_subscription",
        ["user_profile_id", "notification_channel_id", "notification_type_id"],
    )

    # Step 1: Create the new enum type with a different name
    notification_type_enum_v2.create(op.get_bind(), checkfirst=False)

    # Step 2: Alter the `name` column in `notification_type` to use the new enum
    with op.batch_alter_table("notification_type") as batch_op:
        batch_op.alter_column(
            "name",
            type_=notification_type_enum_v2,
            postgresql_using="name::text::notification_type_enum_v2",
        )

    # Insert rows into the `notification_type` table
    op.execute(
        """
        INSERT INTO notification_type (name, description, email_content, create_user, update_user)
        VALUES 
            ('TRANSFER_PARTNER_UPDATE', 'Transfer partner update notification', 'Email content for transfer partner update', 'system', 'system'),
            ('TRANSFER_DIRECTOR_REVIEW', 'Director review notification', 'Email content for director review', 'system', 'system'),
            ('INITIATIVE_APPROVED', 'Initiative approved notification', 'Email content for initiative approval', 'system', 'system'),
            ('INITIATIVE_DA_REQUEST', 'DA request notification', 'Email content for DA request', 'system', 'system'),
            ('SUPPLEMENTAL_REQUESTED', 'Supplemental requested notification', 'Email content for supplemental request', 'system', 'system'),
            ('DIRECTOR_ASSESSMENT', 'Director assessment notification', 'Email content for director assessment', 'system', 'system');
    """
    )

    # Create the enum if needed
    channel_enum.create(op.get_bind(), checkfirst=True)

    # Create necessary records in the notification_channel table
    op.execute(
        """
        INSERT INTO notification_channel (channel_name, enabled, subscribe_by_default)
        VALUES
            ('EMAIL', TRUE, TRUE),
            ('IN_APP', TRUE, FALSE)
        ON CONFLICT DO NOTHING;
    """
    )


def downgrade():
    # Remove the unique constraint from `notification_channel_subscription` table
    op.drop_constraint(
        "uq_user_channel_type", "notification_channel_subscription", type_="unique"
    )

    # Drop the `message` column from `notification_message` table
    op.drop_column("notification_message", "message")

    # Step 1: Revert the `name` column to the original enum type
    with op.batch_alter_table("notification_type") as batch_op:
        batch_op.alter_column(
            "name",
            type_=sa.Enum(
                "CREDIT_TRANSFER_CREATED",  # include all original values here
                "CREDIT_TRANSFER_SIGNED_1OF2",
                "CREDIT_TRANSFER_SIGNED_2OF2",
                "CREDIT_TRANSFER_PROPOSAL_REFUSED",
                "CREDIT_TRANSFER_PROPOSAL_ACCEPTED",
                "CREDIT_TRANSFER_RECOMMENDED_FOR_APPROVAL",
                "CREDIT_TRANSFER_RECOMMENDED_FOR_DECLINATION",
                "CREDIT_TRANSFER_DECLINED",
                "CREDIT_TRANSFER_APPROVED",
                "CREDIT_TRANSFER_RESCINDED",
                "CREDIT_TRANSFER_COMMENT",
                "CREDIT_TRANSFER_INTERNAL_COMMENT",
                "PVR_CREATED",
                "PVR_RECOMMENDED_FOR_APPROVAL",
                "PVR_RESCINDED",
                "PVR_PULLED_BACK",
                "PVR_DECLINED",
                "PVR_APPROVED",
                "PVR_COMMENT",
                "PVR_INTERNAL_COMMENT",
                "PVR_RETURNED_TO_ANALYST",
                "DOCUMENT_PENDING_SUBMISSION",
                "DOCUMENT_SUBMITTED",
                "DOCUMENT_SCAN_FAILED",
                "DOCUMENT_RECEIVED",
                "DOCUMENT_ARCHIVED",
                "COMPLIANCE_REPORT_DRAFT",
                "COMPLIANCE_REPORT_SUBMITTED",
                "COMPLIANCE_REPORT_RECOMMENDED_FOR_ACCEPTANCE_ANALYST",
                "COMPLIANCE_REPORT_RECOMMENDED_FOR_REJECTION_ANALYST",
                "COMPLIANCE_REPORT_RECOMMENDED_FOR_ACCEPTANCE_MANAGER",
                "COMPLIANCE_REPORT_RECOMMENDED_FOR_REJECTION_MANAGER",
                "COMPLIANCE_REPORT_ACCEPTED",
                "COMPLIANCE_REPORT_REJECTED",
                "COMPLIANCE_REPORT_REQUESTED_SUPPLEMENTAL",
                "EXCLUSION_REPORT_DRAFT",
                "EXCLUSION_REPORT_SUBMITTED",
                "EXCLUSION_REPORT_RECOMMENDED_FOR_ACCEPTANCE_ANALYST",
                "EXCLUSION_REPORT_RECOMMENDED_FOR_REJECTION_ANALYST",
                "EXCLUSION_REPORT_RECOMMENDED_FOR_ACCEPTANCE_MANAGER",
                "EXCLUSION_REPORT_RECOMMENDED_FOR_REJECTION_MANAGER",
                "EXCLUSION_REPORT_ACCEPTED",
                "EXCLUSION_REPORT_REJECTED",
                "EXCLUSION_REPORT_REQUESTED_SUPPLEMENTAL",
                name="notification_type_enum",
            ),
            postgresql_using="name::text::notification_type_enum",
        )

    # Step 2: Drop the new enum type created in the upgrade
    op.execute("DROP TYPE IF EXISTS notification_type_enum_v2")

    # Delete rows from the `notification_type` table based on the inserted names
    op.execute(
        """
        DELETE FROM notification_type
        WHERE name IN (
            'TRANSFER_PARTNER_UPDATE', 
            'TRANSFER_DIRECTOR_REVIEW', 
            'INITIATIVE_APPROVED', 
            'INITIATIVE_DA_REQUEST', 
            'SUPPLEMENTAL_REQUESTED', 
            'DIRECTOR_ASSESSMENT'
        );
    """
    )
    # Remove inserted records if downgrading
    op.execute(
        "DELETE FROM notification_channel WHERE channel_name IN ('EMAIL', 'IN_APP')"
    )

    # Drop the enum if needed
    channel_enum.drop(op.get_bind(), checkfirst=True)
