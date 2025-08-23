from lcfs.db.base import BaseModel, Auditable, Versioning
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    Table,
    Double,
    Enum,
)
from sqlalchemy.orm import relationship, Session
from sqlalchemy import event
import enum


class PortsEnum(enum.Enum):
    SINGLE_PORT = "Single port"
    DUAL_PORT = "Dual port"


fse_intended_use_association = Table(
    "fse_intended_use_association",
    BaseModel.metadata,
    Column(
        "fse_id",
        Integer,
        ForeignKey("fse.fse_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "end_use_type_id",
        Integer,
        ForeignKey("end_use_type.end_use_type_id"),
        primary_key=True,
    ),
)


class FSE(BaseModel, Auditable, Versioning):
    """
    Model representing final supply equipment
    """

    __tablename__ = "fse"
    __table_args__ = {"comment": "Final supply equipment"}

    fse_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the final supply equipment",
    )

    charging_site_id = Column(
        Integer,
        ForeignKey("charging_site.charging_site_id"),
        nullable=False,
        comment="Associated charging site",
        index=True,
    )

    status_id = Column(
        Integer,
        ForeignKey("fse_status.fse_status_id"),
        nullable=False,
        comment="Current status of the final supply equipment",
        index=True,
    )

    fse_number = Column(
        String(3),
        nullable=False,
        comment="Auto-generated 3-digit FSE number (suffix for registration)",
        index=True,
    )

    allocating_organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=True,
        comment="Optional allocating organization",
    )

    serial_number = Column(
        String(100),
        nullable=False,
        comment="Serial number of the equipment",
    )

    manufacturer = Column(
        String(100),
        nullable=False,
        comment="Manufacturer of the equipment",
    )

    model = Column(
        String(100),
        nullable=True,
        comment="Model of the equipment",
    )

    level_of_equipment_id = Column(
        Integer,
        ForeignKey("level_of_equipment.level_of_equipment_id"),
        nullable=False,
        comment="Level/type of equipment",
        index=True,
    )

    ports = Column(
        Enum(PortsEnum, name="ports_enum"),
        nullable=True,
        comment="Port configuration of the equipment",
    )

    latitude = Column(
        Double,
        nullable=True,
        comment="Latitude coordinate of the equipment location",
    )

    longitude = Column(
        Double,
        nullable=True,
        comment="Longitude coordinate of the equipment location",
    )

    notes = Column(
        Text,
        nullable=True,
        comment="Optional notes about the final supply equipment",
    )

    # Relationships
    allocating_organization = relationship(
        "Organization", foreign_keys=[allocating_organization_id]
    )

    charging_site = relationship("ChargingSite", back_populates="fse")
    status = relationship("FSEStatus", back_populates="fse")
    level_of_equipment = relationship("LevelOfEquipment")

    intended_uses = relationship(
        "EndUseType",
        secondary=fse_intended_use_association,
        back_populates="fse",
    )

    @property
    def registration_number(self):
        """Generate the full registration number using site number + FSE number."""
        if self.charging_site and self.charging_site.site_code and self.fse_number:
            return f"{self.charging_site.site_code}-{self.fse_number}"
        return None

    def __repr__(self):
        return (
            f"<FSE("
            f"id={self.fse_id}, "
            f"fse_number='{self.fse_number}', "
            f"serial='{self.serial_number}', "
            f"version={self.version}"
            f")>"
        )


# SUGGESTION: Convert to base-36 encoding (0-9, A-Z) using:
# - 3 alphanumeric: increase capacity from 999 to 46,656 unique FSE numbers per charging site
# The same approach can be used for charging site codes
@event.listens_for(FSE, "before_insert")
def generate_fse_number(mapper, connection, target):
    if getattr(target, "fse_number", None):
        return
    if not getattr(target, "charging_site_id", None):
        # relying on DB constraint to ensure presence; skip if absent
        return
    session = Session(bind=connection)
    try:
        # Lock-less approach: read current FSENumber tracker row; create if missing
        from lcfs.db.models.compliance.FSENumber import FSENumber

        tracker = session.get(FSENumber, {"charging_site_id": target.charging_site_id})
        if tracker is None:
            tracker = FSENumber(
                charging_site_id=target.charging_site_id, current_sequence_number=0
            )
            session.add(tracker)
            session.flush()

        next_seq = (tracker.current_sequence_number or 0) + 1
        if next_seq > 999:
            raise ValueError(
                "Exceeded maximum FSE numbers (999) for this charging site"
            )

        tracker.current_sequence_number = next_seq
        session.flush()

        target.fse_number = f"{next_seq:03d}"
    finally:
        session.close()
