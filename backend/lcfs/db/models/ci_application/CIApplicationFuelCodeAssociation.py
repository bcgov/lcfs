from sqlalchemy import Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel


class CIApplicationFuelCodeAssociation(BaseModel, Auditable):
    __tablename__ = "ci_application_fuel_code_association"
    __table_args__ = (
        UniqueConstraint("ci_application_id", "fuel_code_id"),
        {
            "comment": (
                "Associates CI applications with draft fuel codes generated "
                "from their pathway data."
            )
        },
    )

    ci_application_fuel_code_association_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the CI application fuel code association",
    )
    ci_application_id = Column(
        Integer,
        ForeignKey("ci_application.ci_application_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="CI application that generated this fuel code",
    )
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Draft fuel code generated for the CI application",
    )
    pathway_id = Column(
        Integer,
        ForeignKey("pathway.pathway_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Pathway that produced this draft fuel code",
    )
    display_order = Column(
        Integer,
        nullable=False,
        comment="Display order for generated fuel code rows",
    )

    ci_application = relationship(
        "CIApplication",
        back_populates="generated_fuel_code_associations",
        lazy="selectin",
    )
    fuel_code = relationship(
        "FuelCode",
        back_populates="ci_application_associations",
        lazy="selectin",
    )
    pathway = relationship("Pathway", lazy="selectin")
