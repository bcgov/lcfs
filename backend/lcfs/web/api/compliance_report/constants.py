import enum

RENEWABLE_FUEL_TARGET_DESCRIPTIONS = {
    1: {
        "description": "Volume of fossil-derived base fuel supplied",
        "field": "fossil_derived_base_fuel",
    },
    2: {
        "description": "Volume of eligible renewable fuel supplied",
        "field": "eligible_renewable_fuel_supplied",
    },
    3: {
        "legacy": "Total volume of tracked fuel supplied (Line 1|12 + Line 2|13)",
        "description": "Total volume of tracked fuel supplied (Line 1 + Line 2)",
        "field": "total_tracked_fuel_supplied",
    },
    4: {
        "description": "Volume of eligible renewable fuel required (Gasoline = 5%, Diesel = {diesel_percent})",
        "field": "eligible_renewable_fuel_required",
    },
    5: {
        "description": "Net volume of eligible renewable fuel notionally transferred (received)",
        "field": "net_notionally_transferred",
    },
    6: {
        "legacy": "Volume of eligible renewable fuel retained (up to lesser of excess and 5% of Line 4|15 - gasoline={}; diesel={})",
        "description": "Volume of eligible renewable fuel retained (up to lesser of excess and 5% of Line 4 - gasoline={}; diesel={}; jet fuel={})",
        "field": "renewable_fuel_retained",
    },
    7: {
        "legacy": "Volume of eligible renewable fuel previously retained (from Line 6 |17 of previous compliance period)",
        "description": "Volume of eligible renewable fuel previously retained (from Line 6 of previous compliance period)",
        "field": "previously_retained",
    },
    8: {
        "legacy": "Volume of eligible renewable obligation deferred (up to lesser of deficiency and 5% of Line 4|15 - gasoline={}; diesel={})",
        "description": "Volume of eligible renewable obligation deferred (up to lesser of deficiency and 5% of Line 4 - gasoline={}; diesel={}; jet fuel={})",
        "field": "obligation_deferred",
    },
    9: {
        "legacy": "Volume of renewable obligation added (from Line 8|19 of previous compliance period)",
        "description": "Volume of renewable obligation added (from Line 8 of previous compliance period)",
        "field": "obligation_added",
    },
    10: {
        "legacy": "Net volume of eligible renewable fuel supplied (Total of Line 2|13 + Line 5|16 - Line 6|17 + Line 7|18 + Line 8|19 - Line 9|20)",
        "description": "Net volume of eligible renewable fuel supplied (Total of Line 2 + Line 5 - Line 6 + Line 7 + Line 8 - Line 9)",
        "field": "net_renewable_fuel_supplied",
    },
    11: {
        "legacy": "Non-compliance penalty payable [(Line 4|15 - Line 10|21) x prescribed penalty rate]",
        "description": "Non-compliance penalty payable [(Line 4 - Line 10) x prescribed penalty rate]",
        "field": "non_compliance_penalty",
    },
}

PART3_LOW_CARBON_FUEL_TARGET_DESCRIPTIONS = {
    12: {
        "description": "Total credits from fuel supplied (from Schedule B)",
        "field": "low_carbon_fuel_required",
        "units": "Credits",
    },
    13: {
        "description": "Total debits from fuel supplied (from Schedule B)",
        "field": "low_carbon_fuel_supplied",
        "units": "(Debits)",
    },
    14: {
        "description": "Net credit or debit balance for compliance period",
        "field": "low_carbon_fuel_surplus",
        "units": "Credits (Debits)",
    },
    15: {
        "description": "Total banked credits used to offset outstanding debits (if applicable)",
        "field": "banked_units_used",
        "units": "Credits",
    },
    16: {
        "description": "Banked credits used to offset outstanding debits - Previous reports",
        "field": "banked_units_remaining",
        "units": "Credits",
    },
    17: {
        "description": "Banked credits used to offset outstanding debits - {}",
        "field": "non_banked_units_used",
        "units": "Credits",
    },
    18: {
        "description": "Banked credits spent that will be returned due to debit decrease - {}",
        "field": "units_to_be_banked",
        "units": "Credits",
    },
    19: {
        "description": "Outstanding debit balance",
        "field": "units_to_be_exported",
        "units": "(Debits)",
    },
    20: {
        "description": "Part 3 non-compliance penalty payable",
        "field": "surplus_deficit_units",
        "units": "$CAD",
    },
}

LOW_CARBON_FUEL_TARGET_DESCRIPTIONS = {
    12: {
        "description": "Compliance units transferred away",
        "field": "low_carbon_fuel_required",
    },
    13: {
        "description": "Compliance units received through transfers",
        "field": "low_carbon_fuel_supplied",
    },
    14: {
        "description": "Compliance units issued under initiative agreements",
        "field": "low_carbon_fuel_surplus",
    },
    15: {
        "description": "Compliance units previously issued for the supply of fuel in the compliance period",
        "field": "banked_units_used",
    },
    16: {
        "description": "Compliance units previously issued for the export of fuel for the compliance period",
        "field": "banked_units_remaining",
    },
    17: {
        "description": "Available compliance unit balance for the compliance period",
        "field": "non_banked_units_used",
    },
    18: {
        "description": "Compliance units being issued for the supply of fuel in the compliance period",
        "field": "units_to_be_banked",
    },
    19: {
        "description": "Compliance units being issued for the export of fuel for the compliance period",
        "field": "units_to_be_exported",
    },
    20: {
        "description": "Compliance unit balance change from assessment",
        "field": "surplus_deficit_units",
    },
    21: {
        "description": "Non-compliance penalty payable ({} units * $600 CAD per unit)",
        "field": "surplus_deficit_ratio",
    },
    22: {
        "description": "Available compliance unit balance at the end of the compliance date for the period (March 31, {{COMPLIANCE_YEAR_PLUS_1}})",
        "field": "compliance_units_issued",
    },
}

NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS = {
    11: {
        "legacy": "Renewable fuel target non-compliance penalty total (Line 11|22, Gasoline + Diesel)",
        "description": "Renewable fuel target non-compliance penalty total (Line 11, Gasoline + Diesel + Jet fuel)",
        "field": "fossil_derived_base_fuel",
    },
    21: {
        "legacy": "Low carbon fuel target non-compliance penalty total (Line 28)",
        "description": "Low carbon fuel target non-compliance penalty total (Line 21)",
        "field": "line_21_non_compliance_penalty_payable",
    },
    None: {
        "description": "Total non-compliance penalty payable ",
        "field": "total_non_compliance_penalty_payable",
    },
}

PRESCRIBED_PENALTY_RATE = {"gasoline": 0.3, "diesel": 0.45, "jet_fuel": 0.5}


class FORMATS(enum.Enum):
    CURRENCY = "currency"
    NUMBER = "number"
