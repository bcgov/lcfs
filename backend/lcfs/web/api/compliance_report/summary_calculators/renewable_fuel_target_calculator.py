from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.constants import (
    RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
    PRESCRIBED_PENALTY_RATE,
    FORMATS,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema


ELIGIBLE_GASOLINE_RENEWABLE_TYPES = {
    "renewable gasoline",
    "ethanol",
    "renewable naphtha",
    "other",
}

ELIGIBLE_DIESEL_RENEWABLE_TYPES = {
    "biodiesel",
    "hdrd",
    "other diesel fuel",
    "other",
}

ELIGIBLE_JET_FUEL_RENEWABLE_TYPES = {
    "alternative jet fuel",
    "other",
}


class RenewableFuelTargetCalculator:
    """Pure-calculation logic for the renewable fuel target summary (Lines 1-11)."""

    @staticmethod
    def is_eligible_renewable(record, compliance_year: int) -> bool:
        """
        Determine if a fuel record is eligible for Line 2 renewable fuel calculations.

        Eligibility rules by compliance year:
        - 2024 (pre-2025): All renewable fuels are eligible
        - 2025: Diesel requires Canadian production OR Q1 supplied; Gasoline/Jet fuel unrestricted
        - 2026+: Both Diesel and Gasoline require Canadian production; Jet fuel unrestricted
        """
        if not record.fuel_type.renewable:
            return False

        if compliance_year < 2025:
            return True

        category = (record.fuel_category.category or "").lower()
        fuel_type_name = (record.fuel_type.fuel_type or "").lower()

        if category == "gasoline":
            if fuel_type_name not in ELIGIBLE_GASOLINE_RENEWABLE_TYPES:
                return False
        elif category == "diesel":
            if fuel_type_name not in ELIGIBLE_DIESEL_RENEWABLE_TYPES:
                return False
        elif category == "jet fuel":
            if fuel_type_name not in ELIGIBLE_JET_FUEL_RENEWABLE_TYPES:
                return False
            return True
        else:
            return True

        requires_canadian_production = False
        if category == "diesel":
            requires_canadian_production = True
        elif category == "gasoline":
            requires_canadian_production = compliance_year >= 2026

        if not requires_canadian_production:
            return True

        if record.is_canada_produced:
            return True

        if category == "diesel" and compliance_year == 2025 and record.is_q1_supplied:
            return True

        fuel_code_country = (
            (record.fuel_code.fuel_production_facility_country or "")
            if getattr(record, "fuel_code", None)
            else ""
        ).lower()

        return fuel_code_country == "canada"

    @staticmethod
    def calculate(
        fossil_quantities: dict,
        renewable_quantities: dict,
        previous_retained: dict,
        previous_obligation: dict,
        notional_transfers_sums: dict,
        compliance_period: int,
        prev_summary: ComplianceReportSummary,
        previous_year_required: Optional[dict] = None,
    ) -> List[ComplianceReportSummaryRowSchema]:
        DECIMAL_ZERO = Decimal("0")
        GAS_PERC = Decimal("0.05")
        DIESEL_PERC = Decimal("0.08") if compliance_period >= 2025 else Decimal("0.04")
        GAS_RATE = Decimal(str(PRESCRIBED_PENALTY_RATE["gasoline"]))
        DIESEL_RATE = Decimal(str(PRESCRIBED_PENALTY_RATE["diesel"]))
        JET_RATE = Decimal(str(PRESCRIBED_PENALTY_RATE["jet_fuel"]))

        def to_decimal_dict(d):
            return {k: Decimal(str(v or 0)) for k, v in d.items()}

        decimal_fossil_quantities = to_decimal_dict(fossil_quantities)
        decimal_renewable_quantities = to_decimal_dict(renewable_quantities)
        decimal_previous_retained = to_decimal_dict(previous_retained)
        decimal_previous_obligation = to_decimal_dict(previous_obligation)
        decimal_previous_year_required = to_decimal_dict(previous_year_required or {})
        decimal_notional_transfers_sums = to_decimal_dict(notional_transfers_sums)

        line7_max_caps = {}
        for category in ["gasoline", "diesel", "jet_fuel"]:
            prev_required_value = decimal_previous_year_required.get(
                category, DECIMAL_ZERO
            )
            max_cap = DECIMAL_ZERO
            if prev_required_value:
                max_cap = (prev_required_value * Decimal("0.05")).quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            max_cap = max(
                max_cap, decimal_previous_retained.get(category, DECIMAL_ZERO)
            )
            line7_max_caps[category] = max_cap

        decimal_tracked_totals = {
            category: decimal_fossil_quantities.get(category, DECIMAL_ZERO)
            + decimal_renewable_quantities.get(category, DECIMAL_ZERO)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        if 2024 <= compliance_period <= 2027:
            jet_fuel_perc = DECIMAL_ZERO
        elif compliance_period == 2028:
            jet_fuel_perc = Decimal("0.01")
        elif compliance_period == 2029:
            jet_fuel_perc = Decimal("0.02")
        else:
            jet_fuel_perc = Decimal("0.03")

        decimal_eligible_renewable_fuel_required = {
            "gasoline": decimal_tracked_totals.get("gasoline", DECIMAL_ZERO) * GAS_PERC,
            "diesel": decimal_tracked_totals.get("diesel", DECIMAL_ZERO) * DIESEL_PERC,
            "jet_fuel": decimal_tracked_totals.get("jet_fuel", DECIMAL_ZERO)
            * jet_fuel_perc,
        }

        decimal_raw_net_renewable_supplied = {
            category: decimal_renewable_quantities.get(category, DECIMAL_ZERO)
            + decimal_notional_transfers_sums.get(category, DECIMAL_ZERO)
            + decimal_previous_retained.get(category, DECIMAL_ZERO)
            - decimal_previous_obligation.get(category, DECIMAL_ZERO)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        decimal_retained_renewables = {}
        decimal_deferred_renewables = {}

        for category in ["gasoline", "diesel", "jet_fuel"]:
            current_required_quantity_dec = (
                decimal_eligible_renewable_fuel_required.get(category, DECIMAL_ZERO)
            )

            raw_net_supplied = decimal_raw_net_renewable_supplied.get(
                category, DECIMAL_ZERO
            )

            prescribed_portion = (
                current_required_quantity_dec * Decimal("0.05")
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

            excess = max(
                DECIMAL_ZERO, raw_net_supplied - current_required_quantity_dec
            )
            max_retention = min(excess, prescribed_portion)

            line_6_value = Decimal(
                str(
                    getattr(
                        prev_summary,
                        f"line_6_renewable_fuel_retained_{category}",
                        0,
                    )
                    or 0
                )
            )
            decimal_retained_renewables[category] = min(line_6_value, max_retention)

            deficiency = max(
                DECIMAL_ZERO, current_required_quantity_dec - raw_net_supplied
            )
            max_deferral = min(deficiency, prescribed_portion)

            line_8_value = Decimal(
                str(
                    getattr(
                        prev_summary,
                        f"line_8_obligation_deferred_{category}",
                        0,
                    )
                    or 0
                )
            )
            decimal_deferred_renewables[category] = min(line_8_value, max_deferral)

        decimal_net_renewable_supplied = {
            category: decimal_renewable_quantities.get(category, DECIMAL_ZERO)
            + decimal_notional_transfers_sums.get(category, DECIMAL_ZERO)
            - decimal_retained_renewables.get(category, DECIMAL_ZERO)
            + decimal_previous_retained.get(category, DECIMAL_ZERO)
            + decimal_deferred_renewables.get(category, DECIMAL_ZERO)
            - decimal_previous_obligation.get(category, DECIMAL_ZERO)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        decimal_non_compliance_penalties = {}
        penalty_rates = {
            "gasoline": GAS_RATE,
            "diesel": DIESEL_RATE,
            "jet_fuel": JET_RATE,
        }
        for category in ["gasoline", "diesel", "jet_fuel"]:
            shortfall = max(
                DECIMAL_ZERO,
                decimal_eligible_renewable_fuel_required.get(category, DECIMAL_ZERO)
                - decimal_net_renewable_supplied.get(category, DECIMAL_ZERO),
            )
            penalty = (shortfall * penalty_rates[category]).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            decimal_non_compliance_penalties[category] = penalty

        summary_lines = {
            1: {
                "gasoline": float(
                    decimal_fossil_quantities.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(decimal_fossil_quantities.get("diesel", DECIMAL_ZERO)),
                "jet_fuel": float(
                    decimal_fossil_quantities.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            2: {
                "gasoline": float(
                    decimal_renewable_quantities.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_renewable_quantities.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_renewable_quantities.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            3: {
                "gasoline": float(decimal_tracked_totals.get("gasoline", DECIMAL_ZERO)),
                "diesel": float(decimal_tracked_totals.get("diesel", DECIMAL_ZERO)),
                "jet_fuel": float(decimal_tracked_totals.get("jet_fuel", DECIMAL_ZERO)),
            },
            4: {
                "gasoline": float(
                    decimal_eligible_renewable_fuel_required.get(
                        "gasoline", DECIMAL_ZERO
                    ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                ),
                "diesel": float(
                    decimal_eligible_renewable_fuel_required.get(
                        "diesel", DECIMAL_ZERO
                    ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                ),
                "jet_fuel": float(
                    decimal_eligible_renewable_fuel_required.get(
                        "jet_fuel", DECIMAL_ZERO
                    ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                ),
            },
            5: {
                "gasoline": float(
                    decimal_notional_transfers_sums.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_notional_transfers_sums.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_notional_transfers_sums.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            6: {
                "gasoline": float(
                    decimal_retained_renewables.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_retained_renewables.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_retained_renewables.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            7: {
                "gasoline": float(
                    decimal_previous_retained.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(decimal_previous_retained.get("diesel", DECIMAL_ZERO)),
                "jet_fuel": float(
                    decimal_previous_retained.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            8: {
                "gasoline": float(
                    decimal_deferred_renewables.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_deferred_renewables.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_deferred_renewables.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            9: {
                "gasoline": float(
                    decimal_previous_obligation.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_previous_obligation.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_previous_obligation.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            10: {
                "gasoline": float(
                    decimal_net_renewable_supplied.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_net_renewable_supplied.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_net_renewable_supplied.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
            11: {
                "gasoline": float(
                    decimal_non_compliance_penalties.get("gasoline", DECIMAL_ZERO)
                ),
                "diesel": float(
                    decimal_non_compliance_penalties.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": float(
                    decimal_non_compliance_penalties.get("jet_fuel", DECIMAL_ZERO)
                ),
            },
        }

        summary: List[ComplianceReportSummaryRowSchema] = []
        for line, values in summary_lines.items():
            additional_kwargs = {}
            if line == 7:
                additional_kwargs = {
                    "max_gasoline": int(line7_max_caps.get("gasoline", DECIMAL_ZERO)),
                    "max_diesel": int(line7_max_caps.get("diesel", DECIMAL_ZERO)),
                    "max_jet_fuel": int(line7_max_caps.get("jet_fuel", DECIMAL_ZERO)),
                }

            description_template = RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line][
                "description"
            ]

            if line in [6, 8]:
                description_value = description_template.format(
                    "{:,}".format(round(summary_lines[4]["gasoline"] * 0.05)),
                    "{:,}".format(round(summary_lines[4]["diesel"] * 0.05)),
                    "{:,}".format(round(summary_lines[4]["jet_fuel"] * 0.05)),
                )
            elif line == 4:
                diesel_percent_display = "8%" if compliance_period >= 2025 else "4%"
                description_value = description_template.format(
                    diesel_percent=diesel_percent_display
                )
            else:
                description_value = description_template

            summary.append(
                ComplianceReportSummaryRowSchema(
                    line=line,
                    description=description_value,
                    field=RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                    gasoline=(
                        int(values.get("gasoline", 0))
                        if line != 11
                        else float(values.get("gasoline", 0))
                    ),
                    diesel=(
                        int(values.get("diesel", 0))
                        if line != 11
                        else float(values.get("diesel", 0))
                    ),
                    jet_fuel=(
                        int(values.get("jet_fuel", 0))
                        if line != 11
                        else float(values.get("jet_fuel", 0))
                    ),
                    total_value=(
                        int(
                            values.get("gasoline", 0)
                            + values.get("diesel", 0)
                            + values.get("jet_fuel", 0)
                        )
                        if line != 11
                        else float(
                            values.get("gasoline", 0)
                            + values.get("diesel", 0)
                            + values.get("jet_fuel", 0)
                        )
                    ),
                    format=(
                        FORMATS.CURRENCY if (str(line) == "11") else FORMATS.NUMBER
                    ),
                    **additional_kwargs,
                )
            )

        return summary
