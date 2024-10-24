from sqlalchemy import Column, Integer, String
from lcfs.db.base import BaseModel


class TransactionCountView(BaseModel):
    __tablename__ = "mv_transaction_count"
    __table_args__ = {
        "extend_existing": True,
        "comment": "Materialized view for counting transactions in progress for IDIR users",
    }

    transaction_type = Column(String, primary_key=True, comment="Type of transaction")
    count_in_progress = Column(Integer, comment="Count of transactions in progress")
