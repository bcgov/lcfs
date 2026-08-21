from sqlalchemy import Column, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel

# Event vocabulary for designated_action_history.event. Held as a String so
# the workflow can grow without an enum migration; written only by the service
# layer.
EVENT_STATUS_CHANGE = "STATUS_CHANGE"
EVENT_ANALYST_ASSIGNED = "ANALYST_ASSIGNED"
EVENT_ANALYST_REASSIGNED = "ANALYST_REASSIGNED"
EVENT_ANALYST_UNASSIGNED = "ANALYST_UNASSIGNED"
EVENT_CREDITS_RECOMMENDED = "CREDITS_RECOMMENDED"
EVENT_INFORMATION_REQUESTED = "INFORMATION_REQUESTED"
EVENT_EVIDENCE_REVIEWED = "EVIDENCE_REVIEWED"
EVENT_CHANGE_ORDER = "CHANGE_ORDER"
EVENT_CREDITS_ISSUED = "CREDITS_ISSUED"

DESIGNATED_ACTION_EVENTS = (
    EVENT_STATUS_CHANGE,
    EVENT_ANALYST_ASSIGNED,
    EVENT_ANALYST_REASSIGNED,
    EVENT_ANALYST_UNASSIGNED,
    EVENT_CREDITS_RECOMMENDED,
    EVENT_INFORMATION_REQUESTED,
    EVENT_EVIDENCE_REVIEWED,
    EVENT_CHANGE_ORDER,
    EVENT_CREDITS_ISSUED,
)


class DesignatedActionHistory(BaseModel, Auditable):
    """
    Append-only event log for a designated action (#4896 change log, #4898
    audit history).

    Rows are immutable events, so this table carries neither ``Versioning``
    nor ``EffectiveDates``. Analyst assignment and workflow transitions mutate
    the designated action in place and record what happened here — they do not
    create a new version row, because every child of a designated action
    (evidence requirements and submissions, comment and document
    associations) references a concrete ``designated_action_id``.
    """

    __tablename__ = "designated_action_history"
    __table_args__ = (
        Index(
            "ix_designated_action_history_group_uuid",
            "designated_action_group_uuid",
        ),
        {
            "comment": (
                "Append-only history of designated action events: status "
                "changes, analyst assignment, recommendations, reviews, "
                "change orders and credit issuance."
            )
        },
    )

    designated_action_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the history record",
    )
    designated_action_id = Column(
        Integer,
        ForeignKey("designated_action.designated_action_id"),
        nullable=False,
        index=True,
        comment="Designated action this event belongs to",
    )
    designated_action_group_uuid = Column(
        String(36),
        nullable=True,
        comment=(
            "Denormalized designated_action.group_uuid so history survives "
            "change-order version rows. Populated by the writer."
        ),
    )
    event = Column(
        String(100),
        nullable=False,
        comment=(
            "What happened, e.g. STATUS_CHANGE, ANALYST_ASSIGNED, "
            "CREDITS_RECOMMENDED, CREDITS_ISSUED"
        ),
    )
    status_id = Column(
        Integer,
        ForeignKey("designated_action_status.designated_action_status_id"),
        nullable=True,
        comment=(
            "Status the action moved into, for STATUS_CHANGE events. Nullable "
            "so non-status events need no status."
        ),
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="User who caused the event; NULL for system events",
    )
    display_name = Column(
        String(255),
        nullable=True,
        comment="Denormalized actor name for display",
    )
    snapshot = Column(
        JSONB,
        nullable=True,
        comment="Event-specific payload (e.g. credits recommended, reason)",
    )

    designated_action = relationship("DesignatedAction", back_populates="history")
    status = relationship("DesignatedActionStatus")
    user_profile = relationship("UserProfile")
