from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, EffectiveDates

class TransferHistory(BaseModel, Auditable, EffectiveDates):
    __tablename__ = 'transfer_history'
    __table_args__ = {'comment': "Records the status changes of a transfer."}

    transfer_history_id = Column(Integer, primary_key=True, autoincrement=True, comment="Unique identifier for the transfer history record")
    transfer_id = Column(Integer, ForeignKey('transfer.transfer_id'))
    transfer_status_id = Column(Integer, ForeignKey('transfer_status.transfer_status_id'))

    transfer = relationship('Transfer', back_populates='transfer_history_records')
    transfer_status = relationship('TransferStatus')
