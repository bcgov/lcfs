from sqlalchemy import Column, Integer, String
from lcfs.db.base import BaseModel


class DirectorReviewTransactionCountView(BaseModel):
    __tablename__ = "mv_director_review_transaction_count"
    __table_args__ = {
        "extend_existing": True,
        "comment": "Materialized view for counting transactions and compliance reports for the DirectorReview card on the dashboard",
    }

    transaction_type = Column(String, primary_key=True, comment="Type of transaction")
    count_for_review = Column(Integer, comment="Count of transactions for review")
