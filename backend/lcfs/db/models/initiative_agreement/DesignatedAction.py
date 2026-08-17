from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, Versioning


class DesignatedAction(BaseModel, Auditable, Versioning):
    """
    Designated action within an initiative agreement (Schedule B) (#4805).

    Change orders: an amendment appends a new row sharing group_uuid with an
    incremented version (action_type records CREATE/UPDATE/DELETE). Child
    records (evidence requirements/submissions, internal comments) reference
    a specific designated_action_id, so change-order-aware queries must
    resolve children across every row id in the group_uuid group — mirror
    the charging_site -> charging_equipment repository pattern.
    """

    __tablename__ = "designated_action"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_id",
            "action_number",
            "version",
            name="uq_designated_action_agreement_number_version",
        ),
        Index("ix_designated_action_group_uuid", "group_uuid"),
        {
            "comment": (
                "Designated actions defined in Schedule B of an initiative "
                "agreement: milestones with credit allocations, completion "
                "and determination tracking."
            )
        },
    )

    designated_action_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the designated action",
    )
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id"),
        nullable=False,
        index=True,
        comment="Parent initiative agreement",
    )
    action_number = Column(
        Integer,
        nullable=False,
        comment=(
            "Action number within the agreement; displayed as " "DA{n}-IA{agreement id}"
        ),
    )
    name = Column(String(500), nullable=False, comment="Designated action name/title")
    description = Column(
        Text,
        nullable=True,
        comment="Detailed description of the designated action",
    )
    specified_date = Column(
        Date,
        nullable=True,
        comment="Specified completion date from Schedule B",
    )
    completed_date = Column(Date, nullable=True, comment="Actual completion date")
    determination_date = Column(
        Date, nullable=True, comment="Date the determination was made"
    )
    credit_allocation = Column(
        BigInteger,
        nullable=False,
        server_default="0",
        comment="Compliance units allocated to this action ('up to' amount)",
    )
    current_status_id = Column(
        Integer,
        ForeignKey("designated_action_status.designated_action_status_id"),
        nullable=False,
        index=True,
        comment="Current completion status",
    )
    determination = Column(
        String(100),
        nullable=True,
        comment=(
            "Determination result (e.g. Compliant, Non-Compliant, Waived); "
            "validated at the API layer"
        ),
    )
    assigned_analyst_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        index=True,
        comment="IDIR analyst assigned to this designated action",
    )

    initiative_agreement = relationship(
        "InitiativeAgreement", back_populates="designated_actions"
    )
    current_status = relationship(
        "DesignatedActionStatus", back_populates="designated_actions"
    )
    assigned_analyst = relationship("UserProfile", foreign_keys=[assigned_analyst_id])
    evidence_requirements = relationship(
        "EvidenceRequirement", back_populates="designated_action"
    )
    evidence_submissions = relationship(
        "EvidenceSubmission", back_populates="designated_action"
    )
    designated_action_internal_comments = relationship(
        "DesignatedActionInternalComment", back_populates="designated_action"
    )
