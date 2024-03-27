from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum

class AdminAdjustmentStatusEnum(enum.Enum):
    Draft = "Draft" # Draft created by analyst
    Recommended = "Recommended" # Recommended by analyst
    Approved = "Approved"   # Approved by director
    Deleted = "Deleted" # Deleted by analyst

class AdminAdjustmentStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'admin_adjustment_status'
    __table_args__ = {'comment': "Represents a Admin Adjustment Status"}

    admin_adjustment_status_id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(Enum(AdminAdjustmentStatusEnum, name="admin_adjustment_type_enum", create_type=True), comment="Admin Adjustment Status")
