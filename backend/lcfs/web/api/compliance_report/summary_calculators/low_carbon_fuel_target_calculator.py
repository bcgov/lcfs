from datetime import datetime
from decimal import Decimal
from typing import List, Tuple

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.compliance_report.constants import (
    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    FORMATS,
    get_low_carbon_penalty_rate,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema
from lcfs.web.api.compliance_report.summary_repo import (
    ComplianceReportSummaryRepository,
)
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.utils.transaction_windows import calculate_transaction_period_dates


class LowCarbonFuelTargetCalculator:
    """
    Calculates the low carbon fuel target summary (Lines 12-22) and the
    non-compliance penalty payable units used downstream by the penalty calc.
    """

    def __init__(
        self,
        repo: ComplianceReportSummaryRepository,
        cr_repo: ComplianceReportRepository,
        trxn_repo: TransactionRepository,
    ):
        self.repo = repo
        self.cr_repo = cr_repo
        self.trxn_repo = trxn_repo

    async def calculate(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
        compliance_report: ComplianceReport,
        line_18_fuel_supply_units: int,
        line_19_fuel_export_units: int,
    ) -> Tuple[List[ComplianceReportSummaryRowSchema], int]:
        assessed_report = await self.cr_repo.get_assessed_compliance_report_by_period(
            organization_id,
            compliance_period_start.year,
            compliance_report.compliance_report_id,
        )

        compliance_year = compliance_period_start.year
        transaction_start_date, transaction_end_date = (
            await calculate_transaction_period_dates(
                compliance_year,
                organization_id,
                self.cr_repo,
                compliance_report.compliance_report_id,
            )
        )

        compliance_units_transferred_out = int(
            await self.repo.get_transferred_out_compliance_units(
                transaction_start_date, transaction_end_date, organization_id
            )
        )  # line 12
        compliance_units_received = int(
            await self.repo.get_received_compliance_units(
                transaction_start_date, transaction_end_date, organization_id
            )
        )  # line 13
        compliance_units_issued = int(
            await self.repo.get_issued_compliance_units(
                compliance_period_start, compliance_period_end, organization_id
            )
        )  # line 14

        compliance_units_prev_issued_for_fuel_supply = 0
        compliance_units_prev_issued_for_fuel_export = 0

        if assessed_report and assessed_report.summary:
            compliance_units_prev_issued_for_fuel_supply = int(
                assessed_report.summary.line_18_units_to_be_banked or 0
            )
            compliance_units_prev_issued_for_fuel_export = int(
                assessed_report.summary.line_19_units_to_be_exported or 0
            )

        if (
            compliance_report.version > 0
            and compliance_report.summary
            and compliance_report.summary.is_locked
            and compliance_report.summary.line_17_non_banked_units_used is not None
        ):
            available_balance_for_period = int(
                compliance_report.summary.line_17_non_banked_units_used
            )
        else:
            available_balance_for_period = int(
                await self.trxn_repo.calculate_line_17_available_balance_for_period(
                    organization_id,
                    compliance_period_start.year,
                )
            )  # line 17

        compliance_units_curr_issued_for_fuel_supply = line_18_fuel_supply_units
        compliance_units_curr_issued_for_fuel_export = line_19_fuel_export_units

        compliance_unit_balance_change_from_assessment = (
            compliance_units_curr_issued_for_fuel_supply
            + compliance_units_curr_issued_for_fuel_export
            - compliance_units_prev_issued_for_fuel_supply
            - compliance_units_prev_issued_for_fuel_export
        )  # line 20

        deferred_prior_issuance = 0
        if (
            compliance_report.version > 0
            and compliance_report.compliance_report_group_uuid
        ):
            deferred_prior_issuance = int(
                await self.trxn_repo.get_group_adjustments_excluded_from_line_17(
                    compliance_report.compliance_report_group_uuid,
                    organization_id,
                    compliance_report.compliance_report_id,
                    compliance_year,
                )
            )

        effective_available_balance = (
            available_balance_for_period + deferred_prior_issuance
        )

        calculated_penalty_units = int(
            effective_available_balance
            + compliance_unit_balance_change_from_assessment
        )
        non_compliance_penalty_payable_units = (
            calculated_penalty_units if (calculated_penalty_units < 0) else 0
        )
        penalty_rate = get_low_carbon_penalty_rate(compliance_year)
        non_compliance_penalty_payable = (
            int(
                (
                    Decimal(str(non_compliance_penalty_payable_units))
                    * Decimal(str(-penalty_rate))
                ).max(Decimal("0"))
            )
            if non_compliance_penalty_payable_units < 0
            else 0
        )  # line 21

        available_balance_for_period_after_assessment = max(
            effective_available_balance
            + compliance_unit_balance_change_from_assessment,
            0,
        )  # line 22

        low_carbon_summary_lines = {
            12: {"value": compliance_units_transferred_out},
            13: {"value": compliance_units_received},
            14: {"value": compliance_units_issued},
            15: {"value": compliance_units_prev_issued_for_fuel_supply},
            16: {"value": compliance_units_prev_issued_for_fuel_export},
            17: {"value": available_balance_for_period},
            18: {"value": compliance_units_curr_issued_for_fuel_supply},
            19: {"value": compliance_units_curr_issued_for_fuel_export},
            20: {"value": compliance_unit_balance_change_from_assessment},
            21: {"value": non_compliance_penalty_payable},
            22: {"value": available_balance_for_period_after_assessment},
        }

        low_carbon_fuel_target_summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=(
                    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["description"].format(
                        units="{:,}".format(non_compliance_penalty_payable_units * -1),
                        rate=penalty_rate,
                    )
                    if (line == 21)
                    else (
                        LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line][
                            "description"
                        ].replace(
                            "{{COMPLIANCE_YEAR_PLUS_1}}",
                            str(compliance_period_start.year + 1),
                        )
                        if (line == 22)
                        else LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["description"]
                    )
                ),
                field=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                value=values.get("value", 0),
                format=(FORMATS.CURRENCY if (line == 21) else FORMATS.NUMBER),
            )
            for line, values in low_carbon_summary_lines.items()
        ]

        return low_carbon_fuel_target_summary, non_compliance_penalty_payable_units
