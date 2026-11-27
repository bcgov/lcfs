from sqlalchemy import (
    TIMESTAMP,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel

# Status vocabulary for initiative_agreement_change_order.status. A plain
# String with a check constraint, like da_eoc_submission.status.
CHANGE_ORDER_STATUS_DRAFT = "Draft"
CHANGE_ORDER_STATUS_ACCEPTED = "Accepted"
CHANGE_ORDER_STATUS_DISCARDED = "Discarded"
CHANGE_ORDER_STATUSES = (
    CHANGE_ORDER_STATUS_DRAFT,
    CHANGE_ORDER_STATUS_ACCEPTED,
    CHANGE_ORDER_STATUS_DISCARDED,
)

# Who prepared the change order. Only IDIR staff can start one today; the
# column is here so a change order a BCeID organization starts can be added
# without changing how versions are stored.
CHANGE_ORDER_ORIGIN_IDIR = "IDIR"
CHANGE_ORDER_ORIGIN_BCEID = "BCeID"
CHANGE_ORDER_ORIGINS = (CHANGE_ORDER_ORIGIN_IDIR, CHANGE_ORDER_ORIGIN_BCEID)


class InitiativeAgreementChangeOrder(BaseModel, Auditable):
    """
    One change order against an initiative agreement package (#5555).

    While a change order is a Draft, edits to the agreement's details,
    notes, designated actions and evidence requirements are held as pending
    rows in the *_version tables. The live rows keep the accepted values,
    which are what the organization sees. Acceptance applies the pending
    versions to the live rows. Discarding drops them.

    The Director's acceptance records two moments. ``accepted_date`` is the
    effective date the Director enters, which may be earlier than the day it
    is recorded. ``accepted_at`` is the system time it was recorded.
    """

    __tablename__ = "initiative_agreement_change_order"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_id",
            "change_order_number",
            name="uq_initiative_agreement_change_order_number",
        ),
        # One open change order per agreement at a time.
        Index(
            "uq_initiative_agreement_change_order_one_draft",
            "initiative_agreement_id",
            unique=True,
            postgresql_where=text("status = 'Draft'"),
        ),
        CheckConstraint(
            "status IN ('Draft', 'Accepted', 'Discarded')",
            name="status",
        ),
        CheckConstraint("origin IN ('IDIR', 'BCeID')", name="origin"),
        CheckConstraint(
            "status <> 'Accepted' OR (accepted_date IS NOT NULL "
            "AND accepted_at IS NOT NULL)",
            name="accepted_fields",
        ),
        {
            "comment": (
                "Change orders against initiative agreement packages: who "
                "started each one, and the Director's acceptance with its "
                "effective date."
            )
        },
    )

    initiative_agreement_change_order_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the change order",
    )
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id"),
        nullable=False,
        index=True,
        comment="Agreement the change order amends",
    )
    change_order_number = Column(
        Integer,
        nullable=False,
        comment="Sequence number of the change order within its agreement",
    )
    status = Column(
        String(20),
        nullable=False,
        server_default=CHANGE_ORDER_STATUS_DRAFT,
        comment="Draft, Accepted or Discarded",
    )
    origin = Column(
        String(20),
        nullable=False,
        server_default=CHANGE_ORDER_ORIGIN_IDIR,
        comment="Who prepared the change order: IDIR (government) or BCeID",
    )
    started_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who started the change order",
    )
    started_by_display_name = Column(
        String(255), nullable=True, comment="Name of that user when it was started"
    )
    accepted_date = Column(
        Date,
        nullable=True,
        comment=(
            "Effective date of the change order, entered by the Director. "
            "Can differ from accepted_at, the day it was recorded."
        ),
    )
    accepted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="System date and time the acceptance was recorded",
    )
    accepted_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="Director who accepted the change order",
    )
    accepted_by_display_name = Column(
        String(255),
        nullable=True,
        comment="Name of that Director when it was accepted",
    )
    discarded_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="System date and time the change order was discarded",
    )
    discarded_by_user_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who discarded the change order",
    )
    discarded_by_display_name = Column(
        String(255),
        nullable=True,
        comment="Name of that user when it was discarded",
    )

    initiative_agreement = relationship("InitiativeAgreement")
    started_by = relationship("UserProfile", foreign_keys=[started_by_user_id])
    accepted_by = relationship("UserProfile", foreign_keys=[accepted_by_user_id])
    discarded_by = relationship("UserProfile", foreign_keys=[discarded_by_user_id])
