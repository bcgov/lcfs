from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum

class AdminAdjustmentStatusEnum(enum.Enum):
    draft = "Draft" # Draft created by analyst
    recommended = "Recommended" # Recommended by analyst
    approved = "Approved"   # Approved by director
    deleted = "Deleted" # Deleted by analyst

class AdminAdjustmentStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'admin_adjustment_status'
    __table_args__ = {'comment': "Represents a Admin Adjustment Status"}

    admin_adjustment_status_id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(Enum(AdminAdjustmentStatusEnum, name="admin_adjustment_type_enum", create_type=True), comment="Admin Adjustment Status")
