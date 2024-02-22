from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum

class InitiativeAgreementStatusEnum(enum.Enum):
    draft = "Draft" # Draft created by analyst
    recommended = "Recommended" # Recommended by analyst
    approved = "Approved"   # Approved by director
    deleted = "Deleted" # Deleted by analyst

class InitiativeAgreementStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'initiative_agreement_status'
    __table_args__ = {'comment': "Represents a InitiativeAgreement Status"}

    initiative_agreement_status_id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(Enum(InitiativeAgreementStatusEnum, name="initiative_agreement_type_enum", create_type=True), comment="Initiative Agreement Status")
