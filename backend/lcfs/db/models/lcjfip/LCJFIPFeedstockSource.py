from sqlalchemy import Column, Integer, String

from lcfs.db.base import Auditable, BaseModel, DisplayOrder, EffectiveDates


class LCJFIPFeedstockSource(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    """
    Anticipated feedstock sources for low carbon jet fuel purchases.

    LCFS has no shared feedstock reference table: ``fuel_code.feedstock`` and
    ``pathway.feedstock`` are free text. This list is program-specific (it
    includes "Unknown / To be determined"), hence the ``lcjfip_`` prefix.
    """

    __tablename__ = "lcjfip_feedstock_source"
    __table_args__ = {
        "comment": (
            "Lookup of anticipated feedstock sources for LCJF purchases. "
            "Linked to purchase details through lcjfip_purchase_detail_feedstock."
        )
    }

    lcjfip_feedstock_source_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the feedstock source.",
    )
    name = Column(
        String(100),
        nullable=False,
        unique=True,
        comment="Option label shown in the select list, e.g. 'Used cooking oil (UCO)'.",
    )
    description = Column(
        String(500),
        nullable=True,
        comment="Description of the feedstock source.",
    )

    def __repr__(self) -> str:
        return f"<LCJFIPFeedstockSource(id={self.lcjfip_feedstock_source_id}, name={self.name})>"
