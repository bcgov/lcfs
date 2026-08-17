from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum


class InitiativeAgreementStatusEnum(enum.Enum):
    # Award-era workflow statuses (outgoing transaction flow)
    Draft = "Draft"  # Draft created by analyst
    Recommended = "Recommended"  # Recommended by analyst
    Approved = "Approved"  # Approved by director
    Deleted = "Deleted"  # Deleted by analyst
    # Agreement management statuses (#4804); appended to the existing
    # postgres enum by migration — do not reorder members
    Underway = "Underway"  # Agreement in progress
    Completed = "Completed"  # Agreement fulfilled
    Terminated = "Terminated"  # Agreement ended early


class InitiativeAgreementStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "initiative_agreement_status"
    __table_args__ = {"comment": "Represents a InitiativeAgreement Status"}

    initiative_agreement_status_id = Column(
        Integer, primary_key=True, autoincrement=True
    )
    status = Column(
        Enum(
            InitiativeAgreementStatusEnum,
            name="initiative_agreement_type_enum",
            create_type=True,
        ),
        comment="Initiative Agreement Status",
    )
