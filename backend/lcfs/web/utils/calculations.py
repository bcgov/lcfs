def calculate_compliance_units(
    TCI: float, EER: float, RCI: float, UCI: float, Q: float, ED: float
) -> int:
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
    return round(compliance_units)
