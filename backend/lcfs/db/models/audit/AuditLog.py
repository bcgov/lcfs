from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import (
    BigInteger,
    Column,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB


class AuditLog(BaseModel, Auditable):
    __tablename__ = "audit_log"
    __table_args__ = {"comment": "Track changes in defined tables."}

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    table_name = Column(Text, nullable=False)
    operation = Column(Text, nullable=False)

    # JSONB fields for row ID, old values, new values, and delta
    row_id = Column(JSONB, nullable=False)
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    delta = Column(JSONB, nullable=True)
