from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from lcfs.db.base import BaseModel, Auditable, DisplayOrder, EffectiveDates


class ProvisionOfTheAct(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    __tablename__ = "provision_of_the_act"
    __table_args__ = {
        "comment": """List of provisions within Greenhouse Gas Reduction
         (Renewable and Low Carbon Fuel Requirement) Act. e.g. Section 6 (5) (a).
         Used in determining carbon intensity needed for for compliance reporting calculation."""
    }

    provision_of_the_act_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the provision of the act",
    )
    name = Column(
        String(100),
        unique=True,
        nullable=False,
        comment="Name of the Provision. e.g. Section 6 (5) (a)",
    )
    description = Column(
        String(1000),
        nullable=False,
        comment="Description of the provision. This is the displayed name. e.g. Prescribed Carbon Intensity, Approved Fuel Code.",
    )
    is_allocation_provision = Column(Boolean, default=False)

    # relationships
    fuel_type_provision_1 = relationship(
        "FuelType",
        foreign_keys="[FuelType.provision_1_id]",
        back_populates="provision_1",
    )
    fuel_type_provision_2 = relationship(
        "FuelType",
        foreign_keys="[FuelType.provision_2_id]",
        back_populates="provision_2",
    )

    def __repr__(self):
        return f"<ProvisionOfTheAct(id={self.provision_of_the_act_id}, provision={self.name})>"
