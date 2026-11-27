"""Record-level versions of an initiative agreement package (#5555).

A change order never copies a live row. The live rows of
``initiative_agreement``, ``initiative_agreement_note``,
``designated_action`` and ``evidence_requirement`` keep their ids and
always hold the current accepted values, so everything attached to them
(documents, folders, comments, EOC submissions, credit transactions) stays
attached, and every existing read keeps returning accepted data.

Each version table holds the versions of one record type, but only for
records a change order has touched. A record that was never changed has no
rows. ``change_order_id`` says where a version came from: NULL is the
record as it stood before its first change order, otherwise the change
order that produced it. A row whose change order is still a Draft is the
pending edit. It becomes the current version when the Director accepts.
"""

from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declared_attr, relationship

from lcfs.db.base import ActionTypeEnum, Auditable, BaseModel


class ChangeOrderVersionMixin:
    """Columns every record version shares."""

    # The live row's primary-key column, which each version table also
    # carries as its foreign key.
    RECORD_ID_COLUMN: str
    # The fields a change order versions; everything else on the live row
    # (workflow state, review, credits issued) is not versioned.
    VERSIONED_FIELDS: tuple

    version = Column(
        Integer,
        nullable=False,
        comment=(
            "Version number of the record: 0 is the record before its first "
            "change order, each change order that touches it adds one"
        ),
    )
    action_type = Column(
        Enum(ActionTypeEnum),
        nullable=False,
        comment="CREATE, UPDATE or DELETE: what this version did to the record",
    )

    @declared_attr
    def change_order_id(cls):
        return Column(
            Integer,
            ForeignKey(
                "initiative_agreement_change_order.initiative_agreement_change_order_id"
            ),
            nullable=True,
            index=True,
            comment=(
                "Change order that produced this version; NULL for the record "
                "as it stood before its first change order"
            ),
        )

    @declared_attr
    def change_order(cls):
        return relationship("InitiativeAgreementChangeOrder")

    def values(self) -> dict:
        return {field: getattr(self, field) for field in self.VERSIONED_FIELDS}


class InitiativeAgreementVersion(ChangeOrderVersionMixin, BaseModel, Auditable):
    """Versions of an agreement's details."""

    __tablename__ = "initiative_agreement_version"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_id",
            "version",
            name="uq_initiative_agreement_version_version",
        ),
        UniqueConstraint(
            "initiative_agreement_id",
            "change_order_id",
            name="uq_initiative_agreement_version_change_order",
        ),
        {
            "comment": (
                "Versions of an initiative agreement's details, written only "
                "when a change order changes them (#5555)."
            )
        },
    )

    RECORD_ID_COLUMN = "initiative_agreement_id"
    VERSIONED_FIELDS = (
        "ia_code",
        "agreement_type",
        "title",
        "project_description",
        "project_location",
        "contact_name",
        "contact_email",
        "contact_phone",
        "agreement_start_date",
        "agreement_end_date",
    )

    initiative_agreement_version_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the version",
    )
    initiative_agreement_id = Column(
        Integer,
        ForeignKey("initiative_agreement.initiative_agreement_id"),
        nullable=False,
        index=True,
        comment="Agreement this is a version of",
    )
    ia_code = Column(String(50), nullable=True, comment="Agreement code")
    agreement_type = Column(String(100), nullable=True, comment="Kind of agreement")
    title = Column(String(500), nullable=True, comment="Project title")
    project_description = Column(Text, nullable=True, comment="Project summary")
    project_location = Column(Text, nullable=True, comment="Project location")
    contact_name = Column(String(500), nullable=True, comment="Contact name")
    contact_email = Column(String(255), nullable=True, comment="Contact email")
    contact_phone = Column(String(50), nullable=True, comment="Contact phone")
    agreement_start_date = Column(Date, nullable=True, comment="Start date")
    agreement_end_date = Column(Date, nullable=True, comment="End date")

    initiative_agreement = relationship("InitiativeAgreement")


class InitiativeAgreementNoteVersion(ChangeOrderVersionMixin, BaseModel, Auditable):
    """Versions of an agreement note."""

    __tablename__ = "initiative_agreement_note_version"
    __table_args__ = (
        UniqueConstraint(
            "initiative_agreement_note_id",
            "version",
            name="uq_initiative_agreement_note_version_version",
        ),
        UniqueConstraint(
            "initiative_agreement_note_id",
            "change_order_id",
            name="uq_initiative_agreement_note_version_change_order",
        ),
        {
            "comment": (
                "Versions of an initiative agreement note, written only when "
                "a change order changes it (#5555)."
            )
        },
    )

    RECORD_ID_COLUMN = "initiative_agreement_note_id"
    VERSIONED_FIELDS = ("note_number", "note_text")

    initiative_agreement_note_version_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the version",
    )
    initiative_agreement_note_id = Column(
        Integer,
        ForeignKey(
            "initiative_agreement_note.initiative_agreement_note_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
        comment="Note this is a version of",
    )
    note_number = Column(Numeric(8, 2), nullable=False, comment="Note number")
    note_text = Column(Text, nullable=False, comment="Sanitized rich-text body")

    note = relationship("InitiativeAgreementNote")


class DesignatedActionVersion(ChangeOrderVersionMixin, BaseModel, Auditable):
    """Versions of a designated action's Schedule B terms."""

    __tablename__ = "designated_action_version"
    __table_args__ = (
        UniqueConstraint(
            "designated_action_id",
            "version",
            name="uq_designated_action_version_version",
        ),
        UniqueConstraint(
            "designated_action_id",
            "change_order_id",
            name="uq_designated_action_version_change_order",
        ),
        {
            "comment": (
                "Versions of a designated action's terms, written only when "
                "a change order changes them (#5555). Workflow state is not "
                "versioned."
            )
        },
    )

    RECORD_ID_COLUMN = "designated_action_id"
    VERSIONED_FIELDS = ("name", "description", "specified_date", "credit_allocation")

    designated_action_version_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the version",
    )
    designated_action_id = Column(
        Integer,
        ForeignKey("designated_action.designated_action_id"),
        nullable=False,
        index=True,
        comment="Designated action this is a version of",
    )
    name = Column(String(500), nullable=False, comment="Designated action name")
    description = Column(Text, nullable=True, comment="Description")
    specified_date = Column(Date, nullable=True, comment="Date for completion")
    credit_allocation = Column(
        BigInteger, nullable=False, comment="Compliance units to be issued"
    )

    designated_action = relationship("DesignatedAction")


class EvidenceRequirementVersion(ChangeOrderVersionMixin, BaseModel, Auditable):
    """Versions of an evidence requirement (EOC) definition."""

    __tablename__ = "evidence_requirement_version"
    __table_args__ = (
        UniqueConstraint(
            "evidence_requirement_id",
            "version",
            name="uq_evidence_requirement_version_version",
        ),
        UniqueConstraint(
            "evidence_requirement_id",
            "change_order_id",
            name="uq_evidence_requirement_version_change_order",
        ),
        {
            "comment": (
                "Versions of an evidence requirement's definition, written "
                "only when a change order changes it (#5555). The analyst's "
                "review is not versioned."
            )
        },
    )

    RECORD_ID_COLUMN = "evidence_requirement_id"
    VERSIONED_FIELDS = ("requirement_number", "title", "description", "evidence_type")

    evidence_requirement_version_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the version",
    )
    evidence_requirement_id = Column(
        Integer,
        ForeignKey("evidence_requirement.evidence_requirement_id"),
        nullable=False,
        index=True,
        comment="Evidence requirement this is a version of",
    )
    requirement_number = Column(Integer, nullable=False, comment="Requirement number")
    title = Column(String(500), nullable=True, comment="Requirement title")
    description = Column(Text, nullable=False, comment="Requirement description")
    evidence_type = Column(String(100), nullable=True, comment="Evidence type")

    evidence_requirement = relationship("EvidenceRequirement")
