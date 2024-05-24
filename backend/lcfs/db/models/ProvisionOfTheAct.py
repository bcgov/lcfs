from sqlalchemy import Column, Integer, Float
from lcfs.db.base import BaseModel, Auditable, DisplayOrder
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey
from sqlalchemy import String


class ProvisionAct(BaseModel, Auditable, DisplayOrder):

    __tablename__ = "provision_act"
    __table_args__ = {"comment": "data table for determining carbon intensity needed for for compliance reporting calculation"}

    provision_act_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), nullable=False)
    description = Column(String(500))
    # relationships
    fuel_type_provision_1 = relationship("FuelType", foreign_keys="[FuelType.provision_1_act_id]", back_populates="provision_1_act")
    fuel_type_provision_2 = relationship("FuelType", foreign_keys="[FuelType.provision_2_act_id]", back_populates="provision_2_act")