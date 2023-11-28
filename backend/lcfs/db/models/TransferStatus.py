from sqlalchemy import Column, Integer, Enum
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum

class TransferStatusEnum(enum.Enum):
    draft = "Draft"     # Created by Org
    deleted = "Deleted"     # Deleted by Org
    sent = "Sent"     # Sent to Org
    submitted = "Submitted" # Submitted to gov by organization..
    recommended = "Recommended" # Analyst makes recommendation to record or refuse the transfer
    recorded = "Recorded"   # Recorded - Approved by Director
    refused = "Refused" # Refused - Declined by director
    declined = "Declined" # Declined - declined by Organization
    rescinded = "Rescinded" # Rescinded - Cancelled by Organization

class TransferStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = 'transfer_status'
    __table_args__ = {'comment': "Represents a Transfer Status"}

    transfer_status_id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(Enum(TransferStatusEnum, name="transfer_type_enum", create_type=True), comment="Transfer Status")
