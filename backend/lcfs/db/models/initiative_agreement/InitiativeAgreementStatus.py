from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum


class InitiativeAgreementStatusEnum(enum.Enum):
    Draft = "Draft"  # Draft created by analyst
    Recommended = "Recommended"  # Recommended by analyst
    Approved = "Approved"  # Approved by director
    Deleted = "Deleted"  # Deleted by analyst


class InitiativeAgreementStatus(BaseModel, Auditable, DisplayOrder):
    """
    Credit-award transaction status (the outgoing award flow).

    Do NOT add agreement lifecycle values here. Every row of this table is
    surfaced by ``transaction_status_view`` (an unfiltered
    ``SELECT DISTINCT status::text`` across the status tables) and validated
    against ``TransactionStatusEnum``, so a value that is not a transaction
    status breaks ``GET /api/transactions/statuses/`` for every caller.
    Agreement lifecycle lives in ``initiative_agreement_lifecycle_status``.
    """

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
