from sqlalchemy import (
    Column,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class InitiativeAgreementNote(BaseModel, Auditable):
    """A rich-text note attached to an initiative agreement."""

    __tablename__ = "initiative_agreement_note"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_note_id",
            "initiative_agreement_id",
            name="uq_ia_note_id_agreement_id",
        ),
        UniqueConstraint(
            "initiative_agreement_id",
            "note_number",
            name="uq_ia_note_agreement_number",
        ),
        {
            "comment": (
                "Staff notes associated with initiative agreements and "
                "designated action version groups."
            )
        },
    )

    initiative_agreement_note_id = Column(Integer, primary_key=True, autoincrement=True)
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note_number = Column(
        Numeric,
        nullable=False,
        comment="Numeric note number, unique within its initiative agreement",
    )
    note_text = Column(
        Text,
        nullable=False,
        comment="Rich-text note content stored as Quill-compatible HTML",
    )

    initiative_agreement = relationship("InitiativeAgreement", back_populates="notes")
    designated_action_links = relationship(
        "InitiativeAgreementNoteDesignatedAction",
        back_populates="initiative_agreement_note",
        cascade="all, delete-orphan",
        overlaps="initiative_agreement_note_links",
        passive_deletes=True,
    )


class InitiativeAgreementNoteDesignatedAction(BaseModel):
    """Links one agreement note to a designated action version group."""

    __tablename__ = "initiative_agreement_note_designated_action"
    __table_args__ = (
        PrimaryKeyConstraint(
            "initiative_agreement_note_id",
            "designated_action_id",
            name="pk_ia_note_designated_action",
        ),
        UniqueConstraint(
            "initiative_agreement_note_id",
            "designated_action_group_uuid",
            name="uq_ia_note_da_note_group",
        ),
        ForeignKeyConstraint(
            ["initiative_agreement_note_id", "initiative_agreement_id"],
            [
                "initiative_agreement_note.initiative_agreement_note_id",
                "initiative_agreement_note.initiative_agreement_id",
            ],
            name="fk_ia_note_da_note_agreement",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            [
                "designated_action_id",
                "initiative_agreement_id",
                "designated_action_group_uuid",
            ],
            [
                "designated_action.designated_action_id",
                "designated_action.initiative_agreement_id",
                "designated_action.group_uuid",
            ],
            name="fk_ia_note_da_action_agreement_group",
            ondelete="CASCADE",
        ),
        Index(
            "ix_ia_note_da_agreement_group",
            "initiative_agreement_id",
            "designated_action_group_uuid",
        ),
        Index(
            "ix_ia_note_da_designated_action_id",
            "designated_action_id",
        ),
        {
            "comment": (
                "Associates notes with designated action version groups "
                "belonging to the same initiative agreement."
            )
        },
    )

    initiative_agreement_note_id = Column(Integer, nullable=False)
    initiative_agreement_id = Column(Integer, nullable=False)
    designated_action_id = Column(Integer, nullable=False)
    designated_action_group_uuid = Column(String(36), nullable=False)

    initiative_agreement_note = relationship(
        "InitiativeAgreementNote",
        back_populates="designated_action_links",
        overlaps="designated_action,initiative_agreement_note_links",
    )
    designated_action = relationship(
        "DesignatedAction",
        back_populates="initiative_agreement_note_links",
        overlaps="initiative_agreement_note,designated_action_links",
    )
