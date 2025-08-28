from lcfs.db.base import BaseModel, Auditable, Versioning
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    Table,
    UniqueConstraint,
    select,
    event,
    Double,
)
from sqlalchemy.orm import relationship, Session


charging_site_intended_user_association = Table(
    "charging_site_intended_user_association",
    BaseModel.metadata,
    Column(
        "charging_site_id",
        Integer,
        ForeignKey("charging_site.charging_site_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "end_user_type_id",
        Integer,
        ForeignKey("end_user_type.end_user_type_id"),
        primary_key=True,
    ),
)

charging_site_document_association = Table(
    "charging_site_document_association",
    BaseModel.metadata,
    Column(
        "charging_site_id",
        Integer,
        ForeignKey("charging_site.charging_site_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "document_id",
        Integer,
        ForeignKey("document.document_id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ChargingSite(BaseModel, Auditable, Versioning):
    """
    Model representing a charging site
    """

    __tablename__ = "charging_site"
    __table_args__ = (
        UniqueConstraint("site_code"),
        {"comment": "Charging sites"},
    )

    charging_site_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the charging site",
    )

    organization_id = Column(
        Integer,
        ForeignKey("organization.organization_id"),
        nullable=False,
        comment="Associated organization ID",
        index=True,
    )

    status_id = Column(
        Integer,
        ForeignKey("charging_site_status.charging_site_status_id"),
        nullable=False,
        comment="Current status of the charging site",
        index=True,
    )

    site_code = Column(
        String(5),
        nullable=False,
        comment="Auto-generated 5-character alphanumeric site code",
        index=True,
    )

    site_name = Column(
        String(255),
        nullable=False,
        comment="Name of the charging site",
    )

    street_address = Column(
        String(255),
        nullable=False,
        comment="Street address of the charging site",
    )

    city = Column(
        String(100),
        nullable=False,
        comment="City where the charging site is located",
    )

    postal_code = Column(
        String(10),
        nullable=False,
        comment="Postal code of the charging site",
    )

    latitude = Column(
        Double,
        nullable=True,
        comment="Latitude coordinate of the charging site location",
    )

    longitude = Column(
        Double,
        nullable=True,
        comment="Longitude coordinate of the charging site location",
    )

    notes = Column(
        Text,
        nullable=True,
        comment="Optional notes about the charging site",
    )

    # Relationships
    organization = relationship("Organization", back_populates="charging_sites")
    status = relationship("ChargingSiteStatus", back_populates="charging_sites")

    intended_users = relationship(
        "EndUserType",
        secondary=charging_site_intended_user_association,
    )

    documents = relationship(
        "Document",
        secondary=charging_site_document_association,
        back_populates="charging_sites",
    )

    charging_equipment = relationship(
        "ChargingEquipment", back_populates="charging_site"
    )

    def __repr__(self):
        return (
            f"<ChargingSite("
            f"id={self.charging_site_id}, "
            f"site_code='{self.site_code}', "
            f"name='{self.site_name}', "
            f"version={self.version}"
            f")>"
        )


@event.listens_for(ChargingSite, "before_insert")
def generate_site_code(mapper, connection, target):
    # Auto-generates a unique 5-character site code (base-36: 0-9, A-Z).
    # Supports up to 60,466,176 global site codes.
    code = getattr(target, "site_code", None)
    if code:
        target.site_code = str(code).upper()
        return

    session = Session(bind=connection)
    try:
        max_code = session.execute(
            select(ChargingSite.site_code)
            .order_by(ChargingSite.site_code.desc())
            .limit(1)
        ).scalar_one_or_none()

        n = (int(str(max_code), 36) + 1) if max_code else 1
        if n > 36**5 - 1:
            raise ValueError("Exceeded maximum site codes globally")

        alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        s = ""
        while n:
            n, r = divmod(n, 36)
            s = alphabet[r] + s

        target.site_code = s.zfill(5)
    finally:
        session.close()
