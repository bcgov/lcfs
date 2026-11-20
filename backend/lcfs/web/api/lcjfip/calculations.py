"""
LCJFIP incentive calculation rules (#5532).

Pure functions, shared by the service and its tests. The frontend mirrors them
to show values as the applicant types; the stored values always come from here.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Optional, Sequence

# "The price premium range must not exceed $0.25 CAD/L." Read as a cap on the
# width of the From-To range: realistic premiums are well above $0.25/L, so a
# cap on the value itself would reject them.
MAX_PRICE_PREMIUM_RANGE = Decimal("0.25")

CENT = Decimal("0.01")


def total_estimated_volume(volumes: Iterable[Optional[int]]) -> Optional[int]:
    """
    The application-level "Estimated total volume for support (L)": the sum
    of the purchase detail volumes, or None when no row has a volume yet.
    """
    entered = [volume for volume in volumes if volume is not None]
    return sum(entered) if entered else None


def rate_applies_on(rate, on_date: date) -> bool:
    """effective_date <= on_date < expiration_date, either end open."""
    if not rate.effective_status:
        return False
    if rate.effective_date is not None and rate.effective_date > on_date:
        return False
    if rate.expiration_date is not None and rate.expiration_date <= on_date:
        return False
    return True


def _band_matches(rate, carbon_intensity: Decimal) -> bool:
    """Lower bound exclusive, upper bound inclusive."""
    if rate.ci_lower_bound is not None and not carbon_intensity > rate.ci_lower_bound:
        return False
    if rate.ci_upper_bound is not None and not carbon_intensity <= rate.ci_upper_bound:
        return False
    return True


def select_max_rate(
    rates: Sequence,
    incentive_type,
    carbon_intensity: Optional[Decimal],
    on_date: date,
) -> Optional[Decimal]:
    """
    Maximum incentive per litre for an incentive type and carbon intensity.

    Without an estimated carbon intensity, the lowest rate for the type
    applies (the "CI greater than 10" baseline): a higher rate needs a CI
    that earns it.
    """
    if incentive_type is None:
        return None
    applicable = [
        rate
        for rate in rates
        if rate.incentive_type == incentive_type and rate_applies_on(rate, on_date)
    ]
    if not applicable:
        return None
    if carbon_intensity is None:
        return min(rate.max_rate_per_litre for rate in applicable)

    matches = [rate for rate in applicable if _band_matches(rate, carbon_intensity)]
    if not matches:
        return None
    # Overlapping generations resolve to the most recently effective row.
    newest = max(matches, key=lambda rate: rate.effective_date or date.min)
    return newest.max_rate_per_litre


def estimated_incentive_amount(
    requested_volume: Optional[int], max_rate: Optional[Decimal]
) -> Optional[Decimal]:
    """Requested litres x maximum rate, in CAD or credits, to the cent."""
    if requested_volume is None or max_rate is None:
        return None
    return (Decimal(requested_volume) * max_rate).quantize(CENT, ROUND_HALF_UP)


def price_premium_range_error(
    premium_from: Optional[Decimal], premium_to: Optional[Decimal]
) -> Optional[str]:
    """The "Price premium validation" message for a purchase row, if any."""
    if premium_from is None or premium_to is None:
        return None
    if premium_from > premium_to:
        return "The price premium 'From' value must not be greater than 'To'."
    if premium_to - premium_from > MAX_PRICE_PREMIUM_RANGE:
        return "The price premium range must not exceed $0.25 CAD/L."
    return None
