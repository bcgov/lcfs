from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel

# One cycle of "Request additional information" on one EOC (#5545).
# Requested: the analyst asked and the proponent may edit only this EOC.
# Submitted: the proponent answered, and the row is frozen.
# Superseded: the whole submission was resubmitted before this was answered.
INFORMATION_REQUEST_REQUESTED = "Requested"
INFORMATION_REQUEST_SUBMITTED = "Submitted"
INFORMATION_REQUEST_SUPERSEDED = "Superseded"
INFORMATION_REQUEST_STATUSES = (
    INFORMATION_REQUEST_REQUESTED,
    INFORMATION_REQUEST_SUBMITTED,
    INFORMATION_REQUEST_SUPERSEDED,
)

# The files a proponent added while answering one request. The document
# itself also hangs off the designated action, so it shows in the DA's tree.
da_eoc_information_request_document_association = Table(
    "da_eoc_information_request_document_association",
    BaseModel.metadata,
    Column(
        "da_eoc_information_request_id",
        Integer,
        ForeignKey(
            "da_eoc_information_request.da_eoc_information_request_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Index(
        "ix_da_eoc_information_request_document_association_document_id",
        "document_id",
    ),
)


class DaEocInformationRequest(BaseModel, Auditable):
    """A request for more information on one EOC of a submitted DA/EOC
    submission, and the proponent's answer to it (#5545).

    Each cycle is its own row, so the history of requests and answers is the
    table itself. The parent submission keeps its status throughout. While a
    row is Requested, the proponent may edit that EOC's response (held in
    ``response``) and its files; once Submitted, the row never changes.
    """

    __tablename__ = "da_eoc_information_request"
    __table_args__ = (
        CheckConstraint(
            "status IN ('Requested', 'Submitted', 'Superseded')",
            name="status",
        ),
        # At most one open request per EOC of a submission: the open row is
        # the EOC's "additional information requested" state.
        Index(
            "uq_da_eoc_information_request_open",
            "da_eoc_submission_id",
            "evidence_requirement_id",
            unique=True,
            postgresql_where=text("status = 'Requested'"),
        ),
        {
            "comment": (
                "Requests for additional information on one EOC of a DA/EOC "
                "submission, with the proponent's answers (#5545)."
            )
        },
    )

    da_eoc_information_request_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    da_eoc_submission_id = Column(
        Integer,
        ForeignKey("da_eoc_submission.da_eoc_submission_id"),
        nullable=False,
        index=True,
        comment="The submitted DA/EOC submission the request was raised on",
    )
    evidence_requirement_id = Column(
        Integer,
        ForeignKey("evidence_requirement.evidence_requirement_id"),
        nullable=False,
        index=True,
        comment="The EOC the request is for",
    )
    status = Column(
        String(50),
        nullable=False,
        server_default=INFORMATION_REQUEST_REQUESTED,
        comment="Requested | Submitted | Superseded",
    )
    missing_information = Column(
        Text,
        nullable=False,
        comment="The analyst's Missing information text, as sent",
    )
    requested_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=False,
        comment="The analyst who requested the information",
    )
    requested_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="When the information was requested",
    )
    review_snapshot = Column(
        JSONB,
        comment="The EOC's analyst review when the request was made",
    )
    previous_response = Column(
        JSONB,
        comment="The EOC's response before this cycle",
    )
    response = Column(
        JSONB,
        comment="The proponent's response: a working copy while Requested, then final",
    )
    submitted_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="The proponent who submitted the additional information",
    )
    submitted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="When the additional information was submitted",
    )
    documents = Column(
        JSONB,
        comment="The files submitted with the additional information",
    )

    submission = relationship("DaEocSubmission")
    evidence_requirement = relationship("EvidenceRequirement")
    requested_by = relationship("UserProfile", foreign_keys=[requested_by_user_id])
    submitted_by = relationship("UserProfile", foreign_keys=[submitted_by_user_id])
