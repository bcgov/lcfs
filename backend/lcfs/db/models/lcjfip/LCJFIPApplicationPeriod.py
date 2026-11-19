from sqlalchemy import CheckConstraint, Column, Date, Integer, String
from sqlalchemy.orm import relationship

from lcfs.db.base import Auditable, BaseModel, DisplayOrder


class LCJFIPApplicationPeriod(BaseModel, Auditable, DisplayOrder):
    """
    An LCJFIP intake round.

    Applications are submitted into the period that is open on the
    submission date. When a period closes, program staff review every
    application submitted in it and size the estimated incentives against
    overall program demand. Award and disbursement letters quote the period
    as "[Application Period]".
    """

    __tablename__ = "lcjfip_application_period"
    __table_args__ = (
        CheckConstraint(
            "close_date IS NULL OR close_date >= open_date",
            name="close_after_open",
        ),
        {
            "comment": (
                "LCJFIP intake rounds. An application is assigned to the "
                "period open on its submission date."
            )
        },
    )

    lcjfip_application_period_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the LCJFIP application period.",
    )
    description = Column(
        String(100),
        nullable=False,
        unique=True,
        comment="Display name of the period, quoted in award and disbursement letters.",
    )
    open_date = Column(
        Date,
        nullable=False,
        comment="First day (inclusive) on which applications can be submitted into this period.",
    )
    close_date = Column(
        Date,
        nullable=True,
        comment="Last day (inclusive) on which applications can be submitted into this period. NULL while the close date is not yet set.",
    )

    applications = relationship(
        "LCJFIPApplication", back_populates="application_period"
    )

    def __repr__(self) -> str:
        return f"<LCJFIPApplicationPeriod(id={self.lcjfip_application_period_id}, description={self.description})>"
