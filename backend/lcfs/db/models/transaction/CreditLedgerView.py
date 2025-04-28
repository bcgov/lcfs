from sqlalchemy import Column, Integer, String, DateTime
from lcfs.db.base import BaseModel


class CreditLedgerView(BaseModel):
    __tablename__ = "mv_credit_ledger"
    __table_args__ = {"extend_existing": True}

    transaction_id = Column(Integer, primary_key=True)
    transaction_type = Column(
        String,
        primary_key=True,
    )
    organization_id = Column(
        Integer,
        primary_key=True,
    )
    compliance_period = Column(String)
    compliance_units = Column(Integer)
    available_balance = Column(Integer)
    create_date = Column(DateTime)
    update_date = Column(DateTime)
