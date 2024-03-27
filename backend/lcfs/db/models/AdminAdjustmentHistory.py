from sqlalchemy import Column, Integer, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class AdminAdjustmentHistory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'admin_adjustment_history'
    __table_args__ = (UniqueConstraint('admin_adjustment_history_id'),
                      {'comment': "History record for admin_adjustment status change."}
    )

    admin_adjustment_history_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the admin_adjustment history record")
    admin_adjustment_id = Column(Integer, ForeignKey('admin_adjustment.admin_adjustment_id'))
    admin_adjustment_status_id = Column(Integer, ForeignKey('admin_adjustment_status.admin_adjustment_status_id'))

    admin_adjustment = relationship('AdminAdjustment', back_populates='admin_adjustment_history_records')
    admin_adjustment_status = relationship('AdminAdjustmentStatus')
