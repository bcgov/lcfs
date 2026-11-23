from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    Table,
)
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel

# A purchase can blend feedstocks, so one row can name several sources.
lcjfip_purchase_detail_feedstock = Table(
    "lcjfip_purchase_detail_feedstock",
    BaseModel.metadata,
    Column(
        "lcjfip_purchase_detail_id",
        Integer,
        ForeignKey(
            "lcjfip_purchase_detail.lcjfip_purchase_detail_id",
            name="fk_lcjfip_purchase_detail_feedstock_lcjfip_purchase_detail_id",
            ondelete="CASCADE",
        ),
        primary_key=True,
        comment="Purchase detail row.",
    ),
    Column(
        "feedstock_source_id",
        Integer,
        ForeignKey(
            "lcjfip_feedstock_source.lcjfip_feedstock_source_id",
            name="fk_lcjfip_purchase_detail_feedstock_feedstock_source_id",
        ),
        primary_key=True,
        comment="Anticipated feedstock source of the purchase.",
    ),
    comment="Anticipated feedstock sources of an LCJF purchase detail row.",
)


class LCJFIPPurchaseDetail(BaseModel, Auditable):
    """
    One row of the "Low Carbon Jet Fuel (LCJF) Purchase Details" grid.

    "Price premium validation" on the form is derived from the premium range
    and is not stored. As with the application, required fields are checked
    on submission rather than by the database.
    """

    __tablename__ = "lcjfip_purchase_detail"
    __table_args__ = (
        CheckConstraint(
            "estimated_volume IS NULL OR estimated_volume >= 0",
            name="volume_non_negative",
        ),
        CheckConstraint(
            "estimated_blend_percentage IS NULL OR "
            "(estimated_blend_percentage >= 0 AND estimated_blend_percentage <= 100)",
            name="blend_percentage_range",
        ),
        CheckConstraint(
            "assumed_jet_a_price IS NULL OR assumed_jet_a_price >= 0",
            name="jet_a_price_non_negative",
        ),
        CheckConstraint(
            "(price_premium_from IS NULL OR price_premium_from >= 0) AND "
            "(price_premium_to IS NULL OR price_premium_to >= 0)",
            name="premium_non_negative",
        ),
        CheckConstraint(
            "price_premium_from IS NULL OR price_premium_to IS NULL OR "
            "price_premium_from <= price_premium_to",
            name="premium_range_ordered",
        ),
        {
            "comment": (
                "Low Carbon Jet Fuel purchase details on an LCJFIP application, "
                "one row per anticipated purchase."
            )
        },
    )

    lcjfip_purchase_detail_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the purchase detail row.",
    )
    lcjfip_application_id = Column(
        Integer,
        ForeignKey(
            "lcjfip_application.lcjfip_application_id",
            name="fk_lcjfip_purchase_detail_lcjfip_application_id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
        comment="LCJFIP application the purchase belongs to.",
    )
    estimated_volume = Column(
        BigInteger,
        nullable=True,
        comment="Estimated total volume for support, in litres.",
    )
    anticipated_delivery_date = Column(
        Date,
        nullable=True,
        comment="Anticipated delivery completion date.",
    )
    estimated_blend_percentage = Column(
        Numeric(5, 2),
        nullable=True,
        comment="Estimated blend ratio: LCJF share of the blended jet fuel, as a percentage from 0 to 100.",
    )
    assumed_jet_a_price = Column(
        Numeric(10, 4),
        nullable=True,
        comment="Jet-A price assumed in the premium estimate, in CAD per litre.",
    )
    price_premium_from = Column(
        Numeric(10, 4),
        nullable=True,
        comment="Low end of the estimated LCJF price premium above Jet-A, in CAD per litre.",
    )
    price_premium_to = Column(
        Numeric(10, 4),
        nullable=True,
        comment="High end of the estimated LCJF price premium above Jet-A, in CAD per litre.",
    )

    application = relationship("LCJFIPApplication", back_populates="purchase_details")
    feedstock_sources = relationship(
        "LCJFIPFeedstockSource",
        secondary=lcjfip_purchase_detail_feedstock,
        order_by="LCJFIPFeedstockSource.display_order",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<LCJFIPPurchaseDetail(id={self.lcjfip_purchase_detail_id}, application_id={self.lcjfip_application_id})>"
