from decimal import Decimal
from typing import List

from lcfs.web.api.compliance_report.constants import (
    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
    FORMATS,
    get_low_carbon_penalty_rate,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema


class NonCompliancePenaltyCalculator:
    """Pure-calculation logic for the non-compliance penalty summary."""

    @staticmethod
    def calculate(
        non_compliance_penalty_payable_units: int,
        renewable_fuel_target_summary: List[ComplianceReportSummaryRowSchema],
        compliance_year: int,
    ) -> List[ComplianceReportSummaryRowSchema]:
        penalty_rate = get_low_carbon_penalty_rate(compliance_year)
        non_compliance_penalty_payable = (
            Decimal(str(non_compliance_penalty_payable_units))
            * Decimal(str(-penalty_rate))
        ).max(Decimal("0"))
        line_11 = next(
            row for row in renewable_fuel_target_summary if row.line == 11
        )
        line_11_total_decimal = Decimal(str(line_11.total_value))

        non_compliance_summary_lines = {
            11: {"total_value": line_11_total_decimal},
            21: {"total_value": non_compliance_penalty_payable},
            None: {
                "total_value": non_compliance_penalty_payable + line_11_total_decimal
            },
        }

        return [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=(
                    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[line][
                        "description"
                    ].format(non_compliance_penalty_payable_units * -1)
                ),
                field=NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[line]["field"],
                gasoline=float(values.get("gasoline", 0)),
                diesel=float(values.get("diesel", 0)),
                jet_fuel=float(values.get("jet_fuel", 0)),
                total_value=float(values.get("total_value", 0)),
                format=FORMATS.CURRENCY,
            )
            for line, values in non_compliance_summary_lines.items()
        ]
