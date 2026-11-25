from sqlalchemy import Column, ForeignKey, Integer, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class InitiativeAgreementNote(BaseModel, Auditable):
    """
    A numbered rich-text note an analyst keeps against an initiative
    agreement (#5486).

    The number is user-controlled: it defaults to the next in sequence but can
    be overtyped, including to a decimal (1.1) to slot a note between two
    others, so uniqueness is enforced per agreement. Who last edited a note,
    and when, is the audit ``update_user`` / ``update_date``. Notes are
    hard-deleted; the number is then free again.
    """

    __tablename__ = "initiative_agreement_note"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_id",
            "note_number",
            name="uq_initiative_agreement_note_number",
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
            "User-controlled number, unique within the agreement; also the "
            "display order"
        ),
    )
    note_text = Column(
        Text,
        nullable=False,
        comment="Sanitized rich-text (HTML) body of the note",
    )

    initiative_agreement = relationship("InitiativeAgreement", back_populates="notes")
