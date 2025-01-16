from sqlalchemy import Column, Integer, String
from lcfs.db.base import BaseModel


class FuelCodeCountView(BaseModel):
    __tablename__ = "mv_fuel_code_count"
    __table_args__ = {
        "extend_existing": True,
        "comment": "Materialized view for counting fuel code by status",
    }

    status = Column(
        String,
        primary_key=True,
        comment="Status name (e.g. draft, approved, deleted)"
    )
    count = Column(
        Integer,
        comment="Count of fuel code for this status"
    )
