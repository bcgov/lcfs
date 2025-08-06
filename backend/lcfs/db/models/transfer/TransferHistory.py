from sqlalchemy import Column, Integer, ForeignKey, String
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable


class TransferHistory(BaseModel, Auditable):
    __tablename__ = "transfer_history"
    __table_args__ = {"comment": "Records the status changes of a transfer."}

    transfer_history_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the transfer history record",
    )
    transfer_id = Column(Integer, ForeignKey("transfer.transfer_id"))
    transfer_status_id = Column(
        Integer, ForeignKey("transfer_status.transfer_status_id")
    )
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        comment="Foreign key to user_profile",
    )
    display_name = Column(
        String(255),
        comment="Display name for the transfer history record",
        nullable=True
    )

    transfer = relationship("Transfer", back_populates="transfer_history")
    transfer_status = relationship("TransferStatus")
    user_profile = relationship("UserProfile")
