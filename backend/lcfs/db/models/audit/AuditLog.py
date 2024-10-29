from lcfs.db.base import Auditable, BaseModel
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB


class AuditLog(BaseModel, Auditable):
    __tablename__ = "audit_log"
    __table_args__ = {"comment": "Tracks changes in defined tables."}

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    # Foreign key to user_profile
    user_profile_id = Column(
        Integer,
        ForeignKey("user_profile.user_profile_id"),
        nullable=True,
        comment="Foreign key to user_profile",
    )

    table_name = Column(Text, nullable=False)
    operation = Column(Text, nullable=False)

    # JSONB fields for row ID, old values, new values, and delta
    row_id = Column(JSONB, nullable=False)
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    delta = Column(JSONB, nullable=True)

    # Relationship with UserProfile model
    user_profile = relationship("UserProfile", backref="audit_logs")

