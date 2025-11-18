from sqlalchemy import Column, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class ChargingPowerOutput(BaseModel, Auditable):
    """
    Associates end use type, end user type, and charger level with a power output value.
    """

    __tablename__ = "charging_power_output"
    __table_args__ = (
        UniqueConstraint(
            "end_use_type_id",
            "end_user_type_id",
            "level_of_equipment_id",
            name="uq_charging_power_output_end_use_user_level",
        ),
        {
            "comment": "Reference power output (kW) for a given end use, end user, and charging level"
        },
    )

    charging_power_output_id = Column(
        Integer, primary_key=True, autoincrement=True, comment="Primary key"
    )
    end_use_type_id = Column(
        Integer,
        ForeignKey("end_use_type.end_use_type_id"),
        nullable=False,
        comment="Associated end use type",
    )
    end_user_type_id = Column(
        Integer,
        ForeignKey("end_user_type.end_user_type_id"),
        nullable=False,
        comment="Associated end user type",
    )
    level_of_equipment_id = Column(
        Integer,
        ForeignKey("level_of_equipment.level_of_equipment_id"),
        nullable=False,
        comment="Associated charging level",
    )
    charger_power_output = Column(
        Numeric(8, 2),
        nullable=False,
        comment="Power output (kW) for this combination",
    )

    end_use_type = relationship("EndUseType", back_populates="charging_power_outputs")
    end_user_type = relationship("EndUserType", back_populates="charging_power_outputs")
    level_of_equipment = relationship(
        "LevelOfEquipment", back_populates="charging_power_outputs"
    )
