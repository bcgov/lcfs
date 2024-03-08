from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum


class TransferRecommendationStatusEnum(enum.Enum):
    Record = "Record"     # Analyst recommend record
    Refuse = "Refuse"     # Analyst recommend refuse


class TransferRecommendationStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'transfer_recommendation_status'
    __table_args__ = {'comment': "Represents a Transfer Recommendation Status"}

    transfer_recommendation_status_id = Column(
        Integer, primary_key=True, autoincrement=True)
    status = Column(Enum(TransferRecommendationStatusEnum, name="transfer_recommendation_type_enum",
                    create_type=True), comment="Transfer Recommendation Status")
