from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    text,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class InitiativeAgreementNote(BaseModel, Auditable):
    """
    A numbered rich-text note an analyst keeps against an initiative
    agreement (#5486).

    The number is user-controlled: it defaults to the next in sequence but can
    be overtyped, including to a decimal (1.1) to slot a note between two
    others, so uniqueness is enforced per agreement among active notes. Who
    last edited a note, and when, is the audit ``update_user`` /
    ``update_date``.

    A note that was never part of an accepted change order is hard-deleted
    and its number is free again. A note removed by a change order is only
    deactivated, so its earlier versions stay on record (#5555).
    """

    __tablename__ = "initiative_agreement_note"
    __table_args__ = (
        Index(
            "uq_initiative_agreement_note_number_active",
            "initiative_agreement_id",
            "note_number",
            unique=True,
            postgresql_where=text("is_active"),
        ),
        {
            "comment": (
                "Numbered rich-text notes recorded against an initiative agreement."
            )
        },
    )

    initiative_agreement_note_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the initiative agreement note",
    )
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id", ondelete="CASCADE"),
        nullable=False,
        comment="Initiative agreement the note belongs to",
    )
    note_number = Column(
        Numeric(8, 2),
        nullable=False,
        comment=(
            "User-controlled number, unique within the agreement's active "
            "notes; also the display order"
        ),
    )
    note_text = Column(
        Text,
        nullable=False,
        comment="Sanitized rich-text (HTML) body of the note",
    )
    is_active = Column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment=(
            "False once a change order has removed the note; its versions "
            "are kept (#5555)"
        ),
    )
    pending_change_order_id = Column(
        Integer,
        ForeignKey(
            "initiative_agreement_change_order.initiative_agreement_change_order_id"
        ),
        nullable=True,
        index=True,
        comment=(
            "Change order that added this note, while it is not part of the "
            "accepted package. NULL for every accepted note; acceptance "
            "clears it (#5555)."
        ),
    )

    initiative_agreement = relationship("InitiativeAgreement", back_populates="notes")
