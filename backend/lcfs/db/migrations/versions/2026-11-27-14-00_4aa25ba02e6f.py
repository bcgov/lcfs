"""Add EOC additional-information requests (#5545).

Revision ID: 4aa25ba02e6f
Revises: 5454e0c00002
Create Date: 2026-11-27 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "4aa25ba02e6f"
down_revision = "5454e0c00002"
branch_labels = None
depends_on = None

_TABLES = (
    "da_eoc_information_request",
    "da_eoc_information_request_document_association",
)

_NOTIFICATION_TYPES = (
    (
        "BCEID__INITIATIVE_AGREEMENT__EOC_INFORMATION_REQUESTED",
        "Government requested additional information for an evidence of completion item",
    ),
    (
        "IDIR_ANALYST__INITIATIVE_AGREEMENT__EOC_INFORMATION_SUBMITTED",
        "A proponent submitted additional information for an evidence of completion item",
    ),
)


def audit_columns():
    return [
        sa.Column(
            "create_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column(
            "update_date", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")
        ),
        sa.Column("create_user", sa.String()),
        sa.Column("update_user", sa.String()),
    ]


def upgrade():
    op.create_table(
        "da_eoc_information_request",
        sa.Column("da_eoc_information_request_id", sa.Integer(), primary_key=True),
        sa.Column(
            "da_eoc_submission_id",
            sa.Integer(),
            sa.ForeignKey("da_eoc_submission.da_eoc_submission_id"),
            nullable=False,
            comment="The submitted DA/EOC submission the request was raised on",
        ),
        sa.Column(
            "evidence_requirement_id",
            sa.Integer(),
            sa.ForeignKey("evidence_requirement.evidence_requirement_id"),
            nullable=False,
            comment="The EOC the request is for",
        ),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="Requested",
            comment="Requested | Submitted | Superseded",
        ),
        sa.Column(
            "missing_information",
            sa.Text(),
            nullable=False,
            comment="The analyst's Missing information text, as sent",
        ),
        sa.Column(
            "requested_by_user_id",
            sa.Integer(),
            sa.ForeignKey("user_profile.user_profile_id"),
            nullable=False,
            comment="The analyst who requested the information",
        ),
        sa.Column(
            "requested_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            comment="When the information was requested",
        ),
        sa.Column(
            "review_snapshot",
            postgresql.JSONB(),
            comment="The EOC's analyst review when the request was made",
        ),
        sa.Column(
            "previous_response",
            postgresql.JSONB(),
            comment="The EOC's response before this cycle",
        ),
        sa.Column(
            "response",
            postgresql.JSONB(),
            comment="The proponent's response: a working copy while Requested, then final",
        ),
        sa.Column(
            "submitted_by_user_id",
            sa.Integer(),
            sa.ForeignKey("user_profile.user_profile_id"),
            nullable=True,
            comment="The proponent who submitted the additional information",
        ),
        sa.Column(
            "submitted_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            comment="When the additional information was submitted",
        ),
        sa.Column(
            "documents",
            postgresql.JSONB(),
            comment="The files submitted with the additional information",
        ),
        *audit_columns(),
        sa.CheckConstraint(
            "status IN ('Requested', 'Submitted', 'Superseded')",
            name=op.f("ck_da_eoc_information_request_status"),
        ),
        comment=(
            "Requests for additional information on one EOC of a DA/EOC "
            "submission, with the proponent's answers (#5545)."
        ),
    )
    op.create_index(
        "ix_da_eoc_information_request_da_eoc_submission_id",
        "da_eoc_information_request",
        ["da_eoc_submission_id"],
    )
    op.create_index(
        "ix_da_eoc_information_request_evidence_requirement_id",
        "da_eoc_information_request",
        ["evidence_requirement_id"],
    )
    op.create_index(
        "uq_da_eoc_information_request_open",
        "da_eoc_information_request",
        ["da_eoc_submission_id", "evidence_requirement_id"],
        unique=True,
        postgresql_where=sa.text("status = 'Requested'"),
    )
    op.create_table(
        "da_eoc_information_request_document_association",
        sa.Column(
            "da_eoc_information_request_id",
            sa.Integer(),
            sa.ForeignKey(
                "da_eoc_information_request.da_eoc_information_request_id",
                ondelete="CASCADE",
            ),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("document.document_id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_index(
        "ix_da_eoc_information_request_document_association_document_id",
        "da_eoc_information_request_document_association",
        ["document_id"],
    )

    # Row-level audit, attached to these two tables only. A blanket
    # ensure_audit_triggers() would also reach tables the audit function
    # can't handle.
    for table in _TABLES:
        op.execute(f"""
            CREATE TRIGGER audit_{table}_insert_update_delete
            AFTER INSERT OR UPDATE OR DELETE ON {table}
            FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
            """)

    op.execute("""
        SELECT setval(
            pg_get_serial_sequence('notification_type', 'notification_type_id'),
            COALESCE((SELECT MAX(notification_type_id) FROM notification_type), 0) + 1,
            false
        );
        """)
    for name, description in _NOTIFICATION_TYPES:
        op.execute(f"""
            INSERT INTO notification_type (name, description, email_content, create_user, update_user)
            SELECT '{name}', '{description}', 'Email content', 'system', 'system'
            WHERE NOT EXISTS (
                SELECT 1 FROM notification_type WHERE name = '{name}'
            );
            """)


def downgrade():
    for name, _ in _NOTIFICATION_TYPES:
        op.execute(f"""
            DELETE FROM notification_message
            WHERE notification_type_id IN (
                SELECT notification_type_id FROM notification_type WHERE name = '{name}'
            );
            """)
        op.execute(f"DELETE FROM notification_type WHERE name = '{name}';")
    for table in _TABLES:
        op.execute(
            f"DROP TRIGGER IF EXISTS audit_{table}_insert_update_delete ON {table};"
        )
    op.drop_table("da_eoc_information_request_document_association")
    op.drop_table("da_eoc_information_request")
