from decimal import Decimal, ROUND_HALF_UP


def _to_decimal(value) -> Decimal:
    """
    Safely convert a value to Decimal, handling None and invalid values.
    """
    if value is None:
        return Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def calculate_compliance_units(
    TCI: float, EER: float, RCI: float, UCI: float, Q: float, ED: float
) -> Decimal:
    """
    Calculate the compliance units using the fuel supply formula.

    Parameters:
    - TCI: Target Carbon Intensity
    - EER: Energy Efficiency Ratio
    - RCI: Recorded Carbon Intensity
    - UCI: Additional Carbon Intensity Attributable to Use
    - Q: Quantity of Fuel Supplied
    - ED: Energy Density

    Returns:
    - The calculated compliance units as a Decimal rounded to 5 decimal places.
    """
    # Convert all inputs to Decimal for precise calculation
    TCI = _to_decimal(TCI)
    EER = _to_decimal(EER)
    RCI = _to_decimal(RCI)
    UCI = _to_decimal(UCI)
    Q = _to_decimal(Q)
    ED = _to_decimal(ED)

    # Perform the calculation using Decimal arithmetic
    compliance_units = (TCI * EER - (RCI + UCI)) * ((Q * ED) / Decimal("1000000"))

    # Return rounded to 5 decimal places using ROUND_HALF_UP
    return compliance_units.quantize(Decimal("0.00001"), rounding=ROUND_HALF_UP)


def calculate_quantity_from_compliance_units(
    TCI: float,
    EER: float,
    RCI: float,
    UCI: float,
    compliance_units: float,
    ED: float,
) -> Decimal:
    """Derive the supplied quantity from compliance units using the standard formula."""

    TCI = _to_decimal(TCI)
    EER = _to_decimal(EER)
    RCI = _to_decimal(RCI)
    UCI = _to_decimal(UCI)
    ED = _to_decimal(ED)
    compliance_units = _to_decimal(compliance_units)

    ci_delta = (TCI * EER) - (RCI + UCI)
    denominator = ci_delta * ED

    if denominator == 0:
        return Decimal("0")

    quantity = (compliance_units * Decimal("1000000")) / denominator
    return quantity.quantize(Decimal("0.00001"), rounding=ROUND_HALF_UP)

def calculate_legacy_compliance_units(
    TCI: float, EER: float, RCI: float, Q: float, ED: float
) -> Decimal:
    """
    Calculate the compliance units using the legacy fuel supply formula.

    Parameters:
    - TCI: Carbon intensity limit for the given fuel-class/category
    - EER: Energy Efficiency Ratio
    - RCI: Carbon Intensity of the fuel
    - Q: Quantity of Fuel Supplied
    - ED: Energy Density

    Returns:
    - The calculated compliance units as a Decimal rounded to 5 decimal places.
    """
    # Convert all inputs to Decimal for precise calculation
    TCI = _to_decimal(TCI)
    EER = _to_decimal(EER)
    RCI = _to_decimal(RCI)
    Q = _to_decimal(Q)
    ED = _to_decimal(ED)

    # Perform the calculation using Decimal arithmetic
    compliance_units = (TCI * EER - RCI) * ((Q * ED) / Decimal("1000000"))

    # Return rounded to 5 decimal places using ROUND_HALF_UP
    return compliance_units.quantize(Decimal("0.00001"), rounding=ROUND_HALF_UP)


def calculate_legacy_quantity_from_compliance_units(
    TCI: float, EER: float, RCI: float, compliance_units: float, ED: float
) -> Decimal:
    """Derive the supplied quantity from compliance units using the legacy formula."""

    TCI = _to_decimal(TCI)
    EER = _to_decimal(EER)
    RCI = _to_decimal(RCI)
    ED = _to_decimal(ED)
    compliance_units = _to_decimal(compliance_units)

    ci_delta = (TCI * EER) - RCI
    denominator = ci_delta * ED

    if denominator == 0:
        return Decimal("0")

    quantity = (compliance_units * Decimal("1000000")) / denominator
    return quantity.quantize(Decimal("0.00001"), rounding=ROUND_HALF_UP)
