import enum

from sqlalchemy import Boolean, Column, Enum, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, DisplayOrder, EffectiveDates


class LCJFIPIncentiveTypeEnum(enum.Enum):
    """
    How an LCJFIP incentive is paid.

    ``Cash`` amounts are in Canadian dollars. ``Credit`` amounts are LCFS
    compliance units (credits). Both credit options share the credit rates.
    """

    Cash = "Cash"
    Credit = "Credit"


lcjfip_incentive_type_enum = Enum(
    LCJFIPIncentiveTypeEnum, name="lcjfip_incentive_type_enum"
)


class LCJFIPIncentiveOption(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    __tablename__ = "lcjfip_incentive_option"
    __table_args__ = {
        "comment": (
            "Lookup of the incentive options an LCJFIP applicant can prefer. "
            "incentive_type sets the unit of the application's incentive amounts."
        )
    }

    lcjfip_incentive_option_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the incentive option.",
    )
    name = Column(
        String(100),
        nullable=False,
        unique=True,
        comment="Option label shown on the form, e.g. 'Cash incentive'.",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Description of the incentive option.",
    )
    incentive_type = Column(
        lcjfip_incentive_type_enum,
        nullable=False,
        comment="Cash (amounts in CAD) or Credit (amounts in LCFS credits).",
    )
    requires_fuel_supplier = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment=(
            "True when the applicant must name the fuel supplier that receives "
            "the incentive (fuel supplier incentive transfer)."
        ),
    )

    applications = relationship("LCJFIPApplication", back_populates="incentive_option")

    def __repr__(self) -> str:
        return f"<LCJFIPIncentiveOption(id={self.lcjfip_incentive_option_id}, name={self.name})>"
