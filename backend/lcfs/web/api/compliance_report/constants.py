
RENEWABLE_FUEL_TARGET_DESCRIPTIONS = {
    1: "Volume of fossil-derived base fuel supplied",
    2: "Volume of eligible renewable fuel supplied",
    3: "Total volume of tracked fuel supplied (Line 1 + Line 2)",
    4: "Volume of eligible renewable fuel required",
    5: "Net volume of eligible renewable fuel notionally transferred",
    6: "Volume of eligible renewable fuel retained (up to 5% of Line 4)",
    7: "Volume of eligible renewable fuel previously retained (from Line 6 of previous compliance period)",
    8: "Volume of eligible renewable obligation deferred (up to 5% of Line 4)",
    9: "Volume of renewable obligation added (from Line 8 of previous compliance period)",
    10: "Net volume of eligible renewable fuel supplied (Total of Line 2 + Line 5 - Line 6 + Line 7 + Line 8 - Line 9)",
    11: "Non-compliance penalty payable [(Line 4 - Line 10) x prescribed penalty rate]",
}

LOW_CARBON_FUEL_TARGET_DESCRIPTIONS = {
    12: "Compliance units transferred away",
    13: "Compliance units received through transfers",
    14: "Compliance units issued under initiative agreements",
    15: "Compliance units previously issued for the supply of fuel in the compliance period",
    16: "Compliance units previously issued for the export of fuel for the compliance period",
    17: "Available compliance unit balance for the compliance period",
    18: "Compliance units being issued for the supply of fuel in the compliance period",
    19: "Compliance units being issued for the export of fuel for the compliance period",
    20: "Compliance unit balance change from assessment",
    21: "Non-compliance penalty payable (x units * $600 CAD per unit)",
    22: "Available compliance unit balance after assessment",
}

NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS = {
    11: "Volume of fossil-derived base fuel supplied",
    21: "Non-compliance penalty payable (x units * $600 CAD per unit)",
}

PRESCRIBED_PENALTY_RATE = 1.0  # Example penalty rate
