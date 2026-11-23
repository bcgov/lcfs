from sqlalchemy import CheckConstraint, Column, Integer, Numeric, String

from lcfs.db.base import Auditable, BaseModel, DisplayOrder, EffectiveDates
from lcfs.db.models.lcjfip.LCJFIPIncentiveOption import lcjfip_incentive_type_enum


class LCJFIPIncentiveRate(BaseModel, Auditable, DisplayOrder, EffectiveDates):
    """
    Maximum incentive per litre of LCJF, by incentive type and carbon
    intensity band ("Carbon intensity baseline incentive rates").

    A band matches a carbon intensity ``ci`` when
    ``(ci_lower_bound IS NULL OR ci > ci_lower_bound) AND
    (ci_upper_bound IS NULL OR ci <= ci_upper_bound)``.

    A rate applies on date ``d`` when ``effective_date <= d < expiration_date``
    (either end may be NULL). ``expiration_date`` is the first day the rate no
    longer applies, as for fuel codes. To change a rate, set the old row's
    ``expiration_date`` to the new row's ``effective_date``.
    """

    __tablename__ = "lcjfip_incentive_rate"
    __table_args__ = (
        CheckConstraint(
            "ci_lower_bound IS NULL OR ci_upper_bound IS NULL "
            "OR ci_lower_bound < ci_upper_bound",
            name="ci_bounds_ordered",
        ),
        CheckConstraint("max_rate_per_litre > 0", name="max_rate_positive"),
        {
            "comment": (
                "Maximum LCJFIP incentive per litre by incentive type and "
                "carbon intensity band. Lower bound exclusive, upper bound "
                "inclusive."
            )
        },
    )

    lcjfip_incentive_rate_id = Column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Unique identifier for the incentive rate.",
    )
    incentive_type = Column(
        lcjfip_incentive_type_enum,
        nullable=False,
        comment="Cash (rate in CAD per litre) or Credit (rate in LCFS credits per litre).",
    )
    ci_lower_bound = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Exclusive lower carbon intensity bound in gCO2e/MJ. NULL means no lower bound.",
    )
    ci_upper_bound = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Inclusive upper carbon intensity bound in gCO2e/MJ. NULL means no upper bound.",
    )
    max_rate_per_litre = Column(
        Numeric(10, 4),
        nullable=False,
        comment="Maximum incentive per litre of LCJF: CAD for Cash, LCFS credits for Credit.",
    )
    description = Column(
        String(200),
        nullable=True,
        comment="Band label shown on the form, e.g. 'CI less than or equal to 10 gCO2e/MJ'.",
    )

    def __repr__(self) -> str:
        return (
            f"<LCJFIPIncentiveRate(id={self.lcjfip_incentive_rate_id}, "
            f"type={self.incentive_type}, rate={self.max_rate_per_litre})>"
        )
