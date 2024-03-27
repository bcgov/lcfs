from sqlalchemy import Column, String
from lcfs.db.base import BaseModel

# A database view that aggregates all possible transaction statuses
# so we can return them as a full list
class TransactionStatusView(BaseModel):
    __tablename__ = 'transaction_status_view'
    __table_args__ = { 'extend_existing': True }
    status = Column(String, primary_key=True)
    create_date = Column(String)
    update_date = Column(String)