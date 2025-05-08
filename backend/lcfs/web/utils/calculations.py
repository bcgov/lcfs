def calculate_compliance_units(
    TCI: float,
    EER: float,
    RCI: float,
    UCI: float,
    Q: float,
    ED: float,
    is_historical: bool = False,
) -> float:
    """
    Calculate the compliance units using the appropriate formula based on the compliance period.

    Parameters:
    - TCI: Target Carbon Intensity (ci_limit in TFRS)
    - EER: Energy Efficiency Ratio
    - RCI: Recorded Carbon Intensity (effective_carbon_intensity in TFRS)
    - UCI: Additional Carbon Intensity Attributable to Use (only used in new calculation)
    - Q: Quantity of Fuel Supplied
    - ED: Energy Density
    - is_historical: Whether to use pre-2024 calculation method

    Returns:
    - The calculated compliance units as a rounded float.
    """
    # Ensure all inputs are floats
    TCI = float(TCI)
    EER = float(EER)
    RCI = float(RCI)
    UCI = float(UCI)
    Q = float(Q)
    ED = float(ED)

    if is_historical:
        # Pre-2024 calculation (TFRS method)
        # Credit or Debit = (CI class × EER fuel – CI fuel) × EC fuel/1 000 000
        energy_content = Q * ED
        compliance_units = (TCI * EER - RCI) * (energy_content / 1_000_000)
    else:
        # Post-2024 calculation (LCFS method)
        compliance_units = (TCI * EER - (RCI + UCI)) * ((Q * ED) / 1_000_000)

    # Return the rounded float
    return round(compliance_units, 5)


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
