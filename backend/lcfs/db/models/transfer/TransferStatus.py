from sqlalchemy import Column, Integer, Enum, Boolean
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
import enum


class TransferStatusEnum(enum.Enum):
    Draft = "Draft"  # Created by Org
    Deleted = "Deleted"  # Deleted by Org
    Sent = "Sent"  # Sent to Org
    Submitted = "Submitted"  # Submitted to gov by organization..
    Recommended = (
        "Recommended"  # Analyst makes recommendation to record or refuse the transfer
    )
    Recorded = "Recorded"  # Recorded - Approved by Director
    Refused = "Refused"  # Refused - Declined by director
    Declined = "Declined"  # Declined - declined by Organization
    Rescinded = "Rescinded"  # Rescinded - Cancelled by Organization


class TransferStatus(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "transfer_status"
    __table_args__ = {"comment": "Represents a Transfer Status"}

    transfer_status_id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(
        Enum(TransferStatusEnum, name="transfer_type_enum", create_type=True),
        comment="Transfer Status",
    )
    visible_to_transferor = Column(
        Boolean, default=False, comment="Visibility for transferor entities"
    )
    visible_to_transferee = Column(
        Boolean, default=False, comment="Visibility for transferee entities"
    )
    visible_to_government = Column(
        Boolean, default=False, comment="Visibility for government entities"
    )
