from sqlalchemy import Column, Integer, String

from lcfs.db.base import Auditable, BaseModel, DisplayOrder, EffectiveDates


class LCJFIPCarType(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    __tablename__ = "lcjfip_car_type"
    __table_args__ = {
        "comment": (
            "Lookup of Canadian Aviation Regulations (CAR) operation types an "
            "LCJFIP applicant can hold. Linked to applications through "
            "lcjfip_application_car_type."
        )
    }

    lcjfip_car_type_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the CAR type.",
    )
    name = Column(
        String(100),
        nullable=False,
        unique=True,
        comment="Option label shown in the select list, e.g. 'CAR 705 - Airline operations'.",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Description of the CAR type.",
    )

    def __repr__(self) -> str:
        return f"<LCJFIPCarType(id={self.lcjfip_car_type_id}, name={self.name})>"
