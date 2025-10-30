from lcfs.db.base import BaseModel, Auditable, Versioning
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    Table,
    Enum,
    select,
    event,
)
from sqlalchemy.orm import relationship, Session
import enum


class PortsEnum(enum.Enum):
    SINGLE_PORT = "Single port"
    DUAL_PORT = "Dual port"


charging_equipment_intended_use_association = Table(
    "charging_equipment_intended_use_association",
    BaseModel.metadata,
    Column(
        "charging_equipment_id",
        Integer,
        ForeignKey("charging_equipment.charging_equipment_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "end_use_type_id",
        Integer,
        ForeignKey("end_use_type.end_use_type_id"),
        primary_key=True,
    ),
)

charging_equipment_intended_user_association = Table(
    "charging_equipment_intended_user_association",
    BaseModel.metadata,
    Column(
        "charging_equipment_id",
        Integer,
        ForeignKey("charging_equipment.charging_equipment_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "end_user_type_id",
        Integer,
        ForeignKey("end_user_type.end_user_type_id"),
        primary_key=True,
    ),
)


class ChargingEquipment(BaseModel, Auditable, Versioning):
    """
    Model representing charging equipment
    """

    __tablename__ = "charging_equipment"
    __table_args__ = {"comment": "Charging equipment"}

    charging_equipment_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the charging equipment",
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
        ForeignKey("charging_equipment_status.charging_equipment_status_id"),
        nullable=False,
        comment="Current status of the charging equipment",
        index=True,
    )

    equipment_number = Column(
        String(5),
        nullable=False,
        comment="Auto-generated 3-digit equipment number (suffix for registration)",
        index=True,
    )

    organization_name = Column(
        Text,
        nullable=True,
        comment="Name of the organization associated with the equipment",
    )
    allocating_organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=True,
        comment="Optional allocating organization",
    )

    serial_number = Column(
        String(500),
        nullable=False,
        comment="Serial number of the equipment",
    )

    manufacturer = Column(
        String(500),
        nullable=False,
        comment="Manufacturer of the equipment",
    )

    model = Column(
        String(500),
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
        Enum(
            PortsEnum, name="ports_enum", values_callable=lambda x: [e.value for e in x]
        ),
        nullable=True,
        comment="Port configuration of the equipment",
    )

    notes = Column(
        Text,
        nullable=True,
        comment="Optional notes about the charging equipment",
    )

    # Relationships
    allocating_organization = relationship(
        "Organization", foreign_keys=[allocating_organization_id]
    )

    charging_site = relationship("ChargingSite", back_populates="charging_equipment")
    status = relationship(
        "ChargingEquipmentStatus", back_populates="charging_equipment"
    )
    level_of_equipment = relationship("LevelOfEquipment")

    intended_uses = relationship(
        "EndUseType",
        secondary=charging_equipment_intended_use_association,
    )
    intended_users = relationship(
        "EndUserType",
        secondary=charging_equipment_intended_user_association,
    )
    compliance_associations = relationship(
        "ComplianceReportChargingEquipment",
        back_populates="charging_equipment",
        cascade="all, delete-orphan",
    )

    @property
    def registration_number(self):
        """Generate the full registration number using site code + equipment number."""
        if (
            self.charging_site
            and self.charging_site.site_code
            and self.equipment_number
        ):
            return f"{self.charging_site.site_code}-{self.equipment_number}"
        return None

    def __repr__(self):
        return (
            f"<ChargingEquipment("
            f"id={self.charging_equipment_id}, "
            f"equipment_number='{self.equipment_number}', "
            f"serial='{self.serial_number}', "
            f"version={self.version}"
            f")>"
        )


@event.listens_for(ChargingEquipment, "before_insert")
def generate_equipment_number(mapper, connection, target):
    if getattr(target, "equipment_number", None):
        return
    if not getattr(target, "charging_site_id", None):
        # relying on DB constraint to ensure presence; skip if absent
        return
    session = Session(bind=connection)
    try:
        # Find the highest equipment number for this charging site
        max_equipment_number = session.execute(
            select(ChargingEquipment.equipment_number)
            .where(ChargingEquipment.charging_site_id == target.charging_site_id)
            .order_by(ChargingEquipment.equipment_number.desc())
            .limit(1)
        ).scalar_one_or_none()

        if max_equipment_number:
            # Convert to int and increment
            next_seq = int(max_equipment_number) + 1
        else:
            # First equipment for this site
            next_seq = 1

        if next_seq > 99999:
            raise ValueError(
                "Exceeded maximum equipment numbers (99,999) for this charging site"
            )

        target.equipment_number = f"{next_seq:03d}"
    finally:
        session.close()
