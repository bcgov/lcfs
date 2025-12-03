def calculate_compliance_units(
    TCI: float, EER: float, RCI: float, UCI: float, Q: float, ED: float
) -> float:
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
    - The calculated compliance units as a rounded integer.
    """
    # Ensure all inputs are floats
    TCI = float(TCI)
    EER = float(EER)
    RCI = float(RCI)
    UCI = float(UCI)
    Q = float(Q)
    ED = float(ED)

    # Perform the calculation
    compliance_units = (TCI * EER - (RCI + UCI)) * ((Q * ED) / 1_000_000)

    # Return the rounded integer
    return round(compliance_units, 5)


def calculate_quantity_from_compliance_units(
    TCI: float,
    EER: float,
    RCI: float,
    UCI: float,
    compliance_units: float,
    ED: float,
) -> float:
    """Derive the supplied quantity from compliance units using the standard formula."""

    TCI = float(TCI)
    EER = float(EER)
    RCI = float(RCI)
    UCI = float(UCI)
    ED = float(ED)
    compliance_units = float(compliance_units)

    ci_delta = (TCI * EER) - (RCI + UCI)
    denominator = ci_delta * ED

    if denominator == 0:
        return 0.0

    quantity = (compliance_units * 1_000_000) / denominator
    return round(quantity, 5)

def calculate_legacy_compliance_units(
    TCI: float, EER: float, RCI: float, Q: float, ED: float
) -> float:
    """
    Calculate the compliance units using the legacy fuel supply formula.

    Parameters:
    - TCI: Carbon intensity limit for the given fuel-class/category
    - EER: Energy Efficiency Ratio
    - RCI: Carbon Intensity of the fuel
    - Q: Quantity of Fuel Supplied
- ED: Energy Density

    Returns:
    - The calculated compliance units as a rounded integer.
    """
    # Ensure all inputs are floats
    TCI = float(TCI)
    EER = float(EER)
    RCI = float(RCI)
    Q = float(Q)
    ED = float(ED)

    # Perform the calculation
    compliance_units = (TCI * EER - RCI) * ((Q * ED) / 1_000_000)

    # Return the rounded integer
    return round(compliance_units, 5)


def calculate_legacy_quantity_from_compliance_units(
    TCI: float, EER: float, RCI: float, compliance_units: float, ED: float
) -> float:
    """Derive the supplied quantity from compliance units using the legacy formula."""

    TCI = float(TCI)
    EER = float(EER)
    RCI = float(RCI)
    ED = float(ED)
    compliance_units = float(compliance_units)

    ci_delta = (TCI * EER) - RCI
    denominator = ci_delta * ED

    if denominator == 0:
        return 0.0

    quantity = (compliance_units * 1_000_000) / denominator
    return round(quantity, 5)
