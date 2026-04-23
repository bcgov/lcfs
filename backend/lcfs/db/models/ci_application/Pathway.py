from sqlalchemy import Column, Integer, String, Date, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from lcfs.db.base import BaseModel, Auditable, Versioning


class Pathway(BaseModel, Auditable, Versioning):
    __tablename__ = "pathway"
    __table_args__ = {
        "comment": (
            "CI pathway details for a CI application"
        )
    }

    pathway_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the pathway record",
    )

    # ---------- Parent application ----------
    ci_application_id = Column(
        Integer,
        ForeignKey("ci_application.ci_application_id"),
        nullable=False,
        comment="CI application this pathway belongs to",
    )

    # ---------- Application type / fuel code type ----------
    application_type_id = Column(
        Integer,
        ForeignKey("pathway_application_type.pathway_application_type_id"),
        nullable=False,
        comment="Whether this pathway is for a new application or a renewal",
    )
    fuel_code_type_id = Column(
        Integer,
        ForeignKey("pathway_fuel_code_type.pathway_fuel_code_type_id"),
        nullable=False,
        comment="Duration type of the proposed fuel code (1-year provisional or 3-year)",
    )

    # ---------- Operating data collection window ----------
    operating_data_from = Column(
        Date,
        nullable=False,
        comment="Start date of the operating data collection period",
    )
    operating_data_to = Column(
        Date,
        nullable=False,
        comment="End date of the operating data collection period",
    )

    # ---------- Renewal: link to existing fuel code ----------
    fuel_code_id = Column(
        Integer,
        ForeignKey("fuel_code.fuel_code_id"),
        nullable=True,
        comment=(
            "Existing fuel code being renewed. "
            "Null for new applications; mandatory for renewals."
        ),
    )

    # ---------- Proposed carbon intensity ----------
    proposed_ci = Column(
        Numeric(precision=10, scale=2, asdecimal=True),
        nullable=False,
        comment="Proposed carbon intensity value in gCO2e/MJ",
    )

    # ---------- Fuel type ----------
    fuel_type_id = Column(
        Integer,
        ForeignKey("fuel_type.fuel_type_id"),
        nullable=False,
        comment="Type of fuel produced",
    )

    # ---------- Feedstock ----------
    feedstock = Column(
        String(500),
        nullable=False,
        comment="Feedstock used to produce the fuel",
    )
    feedstock_region = Column(
        String(500),
        nullable=False,
        comment="Geographic region from which the feedstock is sourced",
    )
    feedstock_transport_mode = Column(
        String(500),
        nullable=False,
        comment="Mode of transport used to move the feedstock to the facility",
    )
    feedstock_transport_distance = Column(
        Integer,
        nullable=False,
        comment="Distance (km) the feedstock is transported to the facility",
    )

    # ---------- Co-products ----------
    coproducts = Column(
        String(1000),
        nullable=True,
        comment="Description of co-products produced alongside the main fuel (if any)",
    )

    # ---------- Finished fuel transport ----------
    finished_fuel_transport_mode = Column(
        String(500),
        nullable=False,
        comment="Mode of transport used to deliver the finished fuel",
    )
    finished_fuel_transport_distance = Column(
        Integer,
        nullable=False,
        comment="Distance (km) the finished fuel is transported for delivery",
    )

    # ---------- Relationships ----------
    ci_application = relationship(
        "CIApplication",
        back_populates="pathways",
        lazy="selectin",
    )
    application_type = relationship(
        "PathwayApplicationType",
        back_populates="pathways",
        lazy="selectin",
    )
    fuel_code_type = relationship(
        "PathwayFuelCodeType",
        back_populates="pathways",
        lazy="selectin",
    )
    fuel_code = relationship(
        "FuelCode",
        lazy="selectin",
    )
    fuel_type = relationship(
        "FuelType",
        lazy="selectin",
    )
