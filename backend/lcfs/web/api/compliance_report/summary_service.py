import logging
import re
from datetime import datetime
from decimal import Decimal
from typing import List, Tuple

from fastapi import Depends
from sqlalchemy import inspect

from lcfs.db.models.compliance.ComplianceReport import ChangeType
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.constants import (
    RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
    PRESCRIBED_PENALTY_RATE,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryRowSchema,
    ComplianceReportSummarySchema,
)
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.utils.calculations import calculate_compliance_units

logger = logging.getLogger(__name__)


class ComplianceReportSummaryService:
    def __init__(
        self,
        repo: ComplianceReportRepository = Depends(),
        trxn_repo: TransactionRepository = Depends(),
        notional_transfer_service: NotionalTransferServices = Depends(
            NotionalTransferServices
        ),
        fuel_supply_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        fuel_export_repo: FuelExportRepository = Depends(FuelExportRepository),
    ):
        self.repo = repo
        self.notional_transfer_service = notional_transfer_service
        self.trxn_repo = trxn_repo
        self.fuel_supply_repo = fuel_supply_repo
        self.fuel_export_repo = fuel_export_repo

    def convert_summary_to_dict(
        self, summary_obj: ComplianceReportSummary
    ) -> ComplianceReportSummarySchema:
        """
        Convert a ComplianceReportSummary object to a dictionary representation.
        """
        inspector = inspect(summary_obj)
        summary = ComplianceReportSummarySchema(
            summary_id=summary_obj.summary_id,
            compliance_report_id=summary_obj.compliance_report_id,
            is_locked=summary_obj.is_locked,
            quarter=summary_obj.quarter,
            total_non_compliance_penalty_payable=summary_obj.total_non_compliance_penalty_payable,
            renewable_fuel_target_summary=[],
            low_carbon_fuel_target_summary=[],
            non_compliance_penalty_summary=[],
        )
        for column in inspector.mapper.column_attrs:
            match = re.search(r"line_(\d+)_", column.key)
            line = int(match.group(1)) if match else None
            if line in range(1, 12) and line != 11:
                existing_element = next(
                    (
                        existing
                        for existing in summary.renewable_fuel_target_summary
                        if existing.line == str(line)
                    ),
                    None,
                )
                if not existing_element:
                    existing_element = ComplianceReportSummaryRowSchema(
                        line=str(line),
                        format=None,
                        description=(
                            RENEWABLE_FUEL_TARGET_DESCRIPTIONS[str(line)][
                                "description"
                            ].format(
                                "{:,}".format(
                                    int(
                                        summary_obj.line_4_eligible_renewable_fuel_required_gasoline
                                        * 0.05
                                    )
                                ),
                                "{:,}".format(
                                    int(
                                        summary_obj.line_4_eligible_renewable_fuel_required_diesel
                                        * 0.05
                                    )
                                ),
                                "{:,}".format(
                                    int(
                                        summary_obj.line_4_eligible_renewable_fuel_required_jet_fuel
                                        * 0.05
                                    )
                                ),
                            )
                            if (str(line) in ["6", "8"])
                            else RENEWABLE_FUEL_TARGET_DESCRIPTIONS[str(line)][
                                "description"
                            ]
                        ),
                        field=RENEWABLE_FUEL_TARGET_DESCRIPTIONS[str(line)]["field"],
                    )
                    summary.renewable_fuel_target_summary.append(existing_element)
                value = int(getattr(summary_obj, column.key) or 0)
                if column.key.endswith("_gasoline"):
                    existing_element.gasoline = value
                elif column.key.endswith("_diesel"):
                    existing_element.diesel = value
                elif column.key.endswith("_jet_fuel"):
                    existing_element.jet_fuel = value

            elif line in range(12, 23) and line != 21:
                summary.low_carbon_fuel_target_summary.append(
                    ComplianceReportSummaryRowSchema(
                        line=str(line),
                        format=None,
                        description=(
                            LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[str(line)][
                                "description"
                            ].format(
                                "{:,}".format(
                                    int(
                                        summary_obj.line_21_non_compliance_penalty_payable
                                        / 600
                                    )
                                )
                            )
                            if (str(line) == "21")
                            else LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[str(line)][
                                "description"
                            ]
                        ),
                        field=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[str(line)]["field"],
                        value=int(getattr(summary_obj, column.key) or 0),
                    )
                )
            elif line in [11, 21]:
                line = "" if line is None else line
                existing_element = next(
                    (
                        existing
                        for existing in summary.non_compliance_penalty_summary
                        if existing.line == str(line) or existing.line == ""
                    ),
                    None,
                )
                if not existing_element:
                    existing_element = ComplianceReportSummaryRowSchema(
                        line=str(line),
                        format="currency",
                        description=(
                            NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[str(line)][
                                "description"
                            ].format(
                                "{:,}".format(
                                    int(
                                        summary_obj.line_21_non_compliance_penalty_payable
                                        / 600
                                    )
                                )
                            )
                            if line == 21
                            else NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[str(line)][
                                "description"
                            ]
                        ),
                        field=NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[str(line)][
                            "field"
                        ],
                    )
                    summary.non_compliance_penalty_summary.append(existing_element)
                value = int(getattr(summary_obj, column.key) or 0)
                if column.key.endswith("_gasoline"):
                    existing_element.gasoline = value
                elif column.key.endswith("_diesel"):
                    existing_element.diesel = value
                elif column.key.endswith("_jet_fuel"):
                    existing_element.jet_fuel = value
                elif column.key.endswith("_total"):
                    existing_element.total_value = value
                else:
                    existing_element.value = value
        return summary

    #     @service_handler
    #     async def get_summary_versions(self, report_id: int) -> List[Tuple[int, int, str]]:
    #         """
    #         Get a list of all summary versions for a given report, including the original and all supplementals.

    #         :param report_id: The ID of the original compliance report
    #         :return: A list of tuples containing (summary_id, version, type)
    #         """
    #         return await self.repo.get_summary_versions(report_id)

    #     @service_handler
    #     async def get_compliance_report_summary(
    #         self, report_id: int
    #     ) -> ComplianceReportSummarySchema:
    #         """
    #         Get a specific compliance report summary by its ID.
    #         """
    #         report = await self.repo.get_summary_by_report_id(report_id)
    #         return self.map_to_schema(report)

    @service_handler
    async def update_compliance_report_summary(
        self,
        report_id: int,
        summary_data: ComplianceReportSummarySchema,
    ) -> ComplianceReportSummarySchema:
        """
        Autosave compliance report summary details for a specific summary by ID.
        """

        await self.repo.save_compliance_report_summary(report_id, summary_data)
        summary_data = await self.calculate_compliance_report_summary(report_id)

        return summary_data

    @service_handler
    async def calculate_compliance_report_summary(
        self, report_id: int
    ) -> ComplianceReportSummarySchema:
        """Several fields on Report Summary are Transient until locked, this function will re-calculate fields as necessary"""
        # TODO this method will have to be updated to handle supplemental reports

        # Fetch the compliance report details
        compliance_report = await self.repo.get_compliance_report_by_id(
            report_id, is_model=True
        )
        if not compliance_report:
            raise DataNotFoundException("Compliance report not found.")

        prev_compliance_report = (
            await self.repo.get_assessed_compliance_report_by_period(
                compliance_report.organization_id,
                int(compliance_report.compliance_period.description) - 1,
            )
        )

        summary_model = compliance_report.summary

        # After the report has been submitted, the summary becomes locked
        # so we can return the existing summary rather than re-calculating
        if summary_model.is_locked:
            return self.convert_summary_to_dict(compliance_report.summary)

        compliance_period_start = compliance_report.compliance_period.effective_date
        compliance_period_end = compliance_report.compliance_period.expiration_date
        organization_id = compliance_report.organization_id

        # Placeholder values for demonstration purposes
        # need to get these values from the db after fuel supply is implemented

        # If report for previous period copy carryover amounts
        if prev_compliance_report:
            # TODO: if previous report exists then ensure in the UI we're disabling the line 7 & 9 for editing
            previous_retained = {
                "gasoline": prev_compliance_report.summary.line_6_renewable_fuel_retained_gasoline,
                "diesel": prev_compliance_report.summary.line_6_renewable_fuel_retained_diesel,
                "jet_fuel": prev_compliance_report.summary.line_6_renewable_fuel_retained_jet_fuel,
            }
            previous_obligation = {
                "gasoline": prev_compliance_report.summary.line_8_obligation_deferred_gasoline,
                "diesel": prev_compliance_report.summary.line_8_obligation_deferred_diesel,
                "jet_fuel": prev_compliance_report.summary.line_8_obligation_deferred_jet_fuel,
            }
        else:
            previous_retained = {
                "gasoline": summary_model.line_7_previously_retained_gasoline,
                "diesel": summary_model.line_7_previously_retained_diesel,
                "jet_fuel": summary_model.line_7_previously_retained_jet_fuel,
            }
            previous_obligation = {
                "gasoline": summary_model.line_9_obligation_added_gasoline,
                "diesel": summary_model.line_9_obligation_added_diesel,
                "jet_fuel": summary_model.line_9_obligation_added_jet_fuel,
            }

        notional_transfers = (
            await self.notional_transfer_service.get_notional_transfers(
                compliance_report_id=report_id
            )
        )

        notional_transfers_sums = {"gasoline": 0, "diesel": 0, "jet_fuel": 0}

        for transfer in notional_transfers.notional_transfers:
            # Normalize the fuel category key
            normalized_category = transfer.fuel_category.replace(" ", "_").lower()

            # Update the corresponding category sum
            if transfer.received_or_transferred.lower() == "received":
                notional_transfers_sums[normalized_category] += transfer.quantity
            elif transfer.received_or_transferred.lower() == "transferred":
                notional_transfers_sums[normalized_category] -= transfer.quantity

        # Fetch fuel quantities
        fossil_quantities = await self.repo.calculate_fuel_quantities(
            report_id, fossil_derived=True
        )
        renewable_quantities = await self.repo.calculate_fuel_quantities(
            report_id, fossil_derived=False
        )

        renewable_fuel_target_summary = self.calculate_renewable_fuel_target_summary(
            fossil_quantities,
            renewable_quantities,
            previous_retained,
            previous_obligation,
            notional_transfers_sums,
            compliance_period=compliance_period_start.year,
            summary_model=summary_model,
        )
        low_carbon_fuel_target_summary, non_compliance_penalty_payable_units = (
            await self.calculate_low_carbon_fuel_target_summary(
                compliance_period_start,
                compliance_period_end,
                organization_id,
                report_id,
            )
        )
        non_compliance_penalty_summary = self.calculate_non_compliance_penalty_summary(
            non_compliance_penalty_payable_units, renewable_fuel_target_summary
        )

        prev_summary = self.convert_summary_to_dict(summary_model)

        summary = self.map_to_schema(
            compliance_report,
            low_carbon_fuel_target_summary,
            non_compliance_penalty_summary,
            renewable_fuel_target_summary,
            summary_model,
        )

        # FIXME: Fix this, equality is always false
        # The two summaries (one from DB, one calculated) do not currently match
        if prev_summary != summary:
            logger.debug("Report has changed, updating summary")
            await self.repo.save_compliance_report_summary(report_id, summary)
            return summary

        return prev_summary

    def map_to_schema(
        self,
        compliance_report,
        low_carbon_fuel_target_summary,
        non_compliance_penalty_summary,
        renewable_fuel_target_summary,
        summary_model,
    ):
        summary = ComplianceReportSummarySchema(
            summary_id=summary_model.summary_id,
            compliance_report_id=compliance_report.compliance_report_id,
            is_locked=summary_model.is_locked,
            quarter=summary_model.quarter,
            total_non_compliance_penalty_payable=summary_model.total_non_compliance_penalty_payable,
            renewable_fuel_target_summary=renewable_fuel_target_summary,
            low_carbon_fuel_target_summary=low_carbon_fuel_target_summary,
            non_compliance_penalty_summary=non_compliance_penalty_summary,
        )
        return summary

    def calculate_renewable_fuel_target_summary(
        self,
        fossil_quantities: dict,
        renewable_quantities: dict,
        previous_retained: dict,
        previous_obligation: dict,
        notional_transfers_sums: dict,
        compliance_period: int,
        summary_model: ComplianceReportSummary,
    ) -> List[ComplianceReportSummaryRowSchema]:
        # line 3
        tracked_totals = {
            category: fossil_quantities.get(category, 0)
            + renewable_quantities.get(category, 0)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        # line 4
        if 2024 <= compliance_period <= 2027:
            jet_fuel_percentage = 0
        elif compliance_period == 2028:
            jet_fuel_percentage = 1 / 100
        elif compliance_period == 2029:
            jet_fuel_percentage = 2 / 100
        else:
            jet_fuel_percentage = 3 / 100

        eligible_renewable_fuel_required = {
            "gasoline": tracked_totals["gasoline"] * 0.05,
            "diesel": tracked_totals["diesel"] * 0.04,
            "jet_fuel": tracked_totals["jet_fuel"] * jet_fuel_percentage,
        }

        # line 6
        retained_renewables = {"gasoline": 0.0, "diesel": 0.0, "jet_fuel": 0.0}
        # line 8
        deferred_renewables = {"gasoline": 0.0, "diesel": 0.0, "jet_fuel": 0.0}

        for category in ["gasoline", "diesel", "jet_fuel"]:
            required_renewable_quantity = eligible_renewable_fuel_required.get(category)
            previous_required_renewable_quantity = getattr(
                summary_model, f"line_4_eligible_renewable_fuel_required_{category}"
            )

            # only carry over line 6,8 if required quantities have not changed
            if not previous_required_renewable_quantity != required_renewable_quantity:
                retained_renewables[category] = getattr(
                    summary_model, f"line_6_renewable_fuel_retained_{category}"
                )
                deferred_renewables[category] = getattr(
                    summary_model, f"line_8_obligation_deferred_{category}"
                )

        # line 10
        net_renewable_supplied = {
            category:
            # line 2
            renewable_quantities.get(category, 0) +
            # line 5
            notional_transfers_sums.get(category, 0) -
            # line 6
            retained_renewables.get(category, 0) +
            # line 7
            previous_retained.get(category, 0) +
            # line 8
            deferred_renewables.get(category, 0) -
            # line 9
            previous_obligation.get(category, 0)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        # line 11
        non_compliance_penalties = {
            category: round(
                max(
                    0,
                    eligible_renewable_fuel_required.get(category, 0)
                    - net_renewable_supplied.get(category, 0),
                )
                * PRESCRIBED_PENALTY_RATE[category],
                2,
            )
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        summary_lines = {
            "1": {
                "gasoline": fossil_quantities.get("gasoline", 0),
                "diesel": fossil_quantities.get("diesel", 0),
                "jet_fuel": fossil_quantities.get("jet_fuel", 0),
            },
            "2": {
                "gasoline": renewable_quantities.get("gasoline", 0),
                "diesel": renewable_quantities.get("diesel", 0),
                "jet_fuel": renewable_quantities.get("jet_fuel", 0),
            },
            "3": {
                "gasoline": tracked_totals.get("gasoline", 0),
                "diesel": tracked_totals.get("diesel", 0),
                "jet_fuel": tracked_totals.get("jet_fuel", 0),
            },
            "4": {
                "gasoline": eligible_renewable_fuel_required.get("gasoline", 0),
                "diesel": eligible_renewable_fuel_required.get("diesel", 0),
                "jet_fuel": eligible_renewable_fuel_required.get("jet_fuel", 0),
            },
            # Notionally transferred value
            "5": notional_transfers_sums,
            "6": {
                "gasoline": retained_renewables.get("gasoline", 0),
                "diesel": retained_renewables.get("diesel", 0),
                "jet_fuel": retained_renewables.get("jet_fuel", 0),
            },
            "7": {
                "gasoline": previous_retained.get("gasoline", 0),
                "diesel": previous_retained.get("diesel", 0),
                "jet_fuel": previous_retained.get("jet_fuel", 0),
            },
            "8": {
                "gasoline": deferred_renewables.get("gasoline", 0),
                "diesel": deferred_renewables.get("diesel", 0),
                "jet_fuel": deferred_renewables.get("jet_fuel", 0),
            },
            # Renewable obligation added from previous period
            "9": {
                "gasoline": previous_obligation.get("gasoline", 0),
                "diesel": previous_obligation.get("diesel", 0),
                "jet_fuel": previous_obligation.get("jet_fuel", 0),
            },
            "10": {
                "gasoline": net_renewable_supplied.get("gasoline", 0),
                "diesel": net_renewable_supplied.get("diesel", 0),
                "jet_fuel": net_renewable_supplied.get("jet_fuel", 0),
            },
            "11": {
                "gasoline": non_compliance_penalties.get("gasoline", 0),
                "diesel": non_compliance_penalties.get("diesel", 0),
                "jet_fuel": non_compliance_penalties.get("jet_fuel", 0),
            },
        }

        summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=(
                    RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["description"].format(
                        "{:,}".format(int(summary_lines["4"]["gasoline"] * 0.05)),
                        "{:,}".format(int(summary_lines["4"]["diesel"] * 0.05)),
                        "{:,}".format(int(summary_lines["4"]["jet_fuel"] * 0.05)),
                    )
                    if (line in ["6", "8"])
                    else RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["description"]
                ),
                field=RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                gasoline=values.get("gasoline", 0),
                diesel=values.get("diesel", 0),
                jet_fuel=values.get("jet_fuel", 0),
                total_value=values.get("gasoline", 0)
                + values.get("diesel", 0)
                + values.get("jet_fuel", 0),
                format="currency" if (str(line) == "11") else None,
            )
            for line, values in summary_lines.items()
        ]

        return summary

    async def calculate_low_carbon_fuel_target_summary(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
        report_id: int,
    ) -> Tuple[List[ComplianceReportSummaryRowSchema], int]:
        compliance_units_transferred_out = (
            await self.repo.get_transferred_out_compliance_units(
                compliance_period_start, compliance_period_end, organization_id
            )
        )  # line 12
        compliance_units_received = await self.repo.get_received_compliance_units(
            compliance_period_start, compliance_period_end, organization_id
        )  # line 13
        compliance_units_issued = await self.repo.get_issued_compliance_units(
            compliance_period_start, compliance_period_end, organization_id
        )  # line 14
        # TODO - add the logic as required
        compliance_units_prev_issued_for_fuel_supply = 0  # line 15
        compliance_units_prev_issued_for_fuel_export = 0  # line 16 - always 0
        available_balance_for_period = await self.trxn_repo.calculate_available_balance_for_period(
            organization_id, compliance_period_start.year
        )  # line 17 - Available compliance unit balance on March 31, <compliance-year + 1>
        compliance_units_curr_issued_for_fuel_supply = (
            await self.calculate_fuel_supply_compliance_units(report_id)
        )  # line 18 fuel supply compliance units total
        compliance_units_curr_issued_for_fuel_export = (
            await self.calculate_fuel_export_compliance_units(report_id)
        )  # line 19
        compliance_unit_balance_change_from_assessment = (
            compliance_units_curr_issued_for_fuel_supply
            + compliance_units_curr_issued_for_fuel_export
        )  # line 20

        calculated_penalty_units = int(
            available_balance_for_period
            + compliance_units_curr_issued_for_fuel_supply
            + compliance_units_curr_issued_for_fuel_export
        )
        non_compliance_penalty_payable_units = (
            calculated_penalty_units if (calculated_penalty_units < 0) else 0
        )
        non_compliance_penalty_payable = (
            int((non_compliance_penalty_payable_units * Decimal(-600.0)).max(0))
            if non_compliance_penalty_payable_units < 0
            else 0
        )  # line 21

        available_balance_for_period_after_assessment = (  # line 22 = line 17 + line 20
            max(
                available_balance_for_period
                + compliance_unit_balance_change_from_assessment,
                0,
            )
        )
        low_carbon_summary_lines = {
            "12": {"value": compliance_units_transferred_out},
            "13": {"value": compliance_units_received},
            "14": {"value": compliance_units_issued},
            "15": {"value": compliance_units_prev_issued_for_fuel_supply},
            "16": {"value": compliance_units_prev_issued_for_fuel_export},
            "17": {"value": available_balance_for_period},
            "18": {"value": compliance_units_curr_issued_for_fuel_supply},
            "19": {"value": compliance_units_curr_issued_for_fuel_export},
            "20": {"value": compliance_unit_balance_change_from_assessment},
            "21": {"value": non_compliance_penalty_payable},
            "22": {"value": available_balance_for_period_after_assessment},
        }

        low_carbon_fuel_target_summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=(
                    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[str(line)][
                        "description"
                    ].format("{:,}".format(non_compliance_penalty_payable_units * -1))
                    if (str(line) == "21")
                    else LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[str(line)]["description"]
                ),
                field=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                value=values.get("value", 0),
                format="currency" if (str(line) == "21") else None,
            )
            for line, values in low_carbon_summary_lines.items()
        ]

        return low_carbon_fuel_target_summary, non_compliance_penalty_payable_units

    def calculate_non_compliance_penalty_summary(
        self,
        non_compliance_penalty_payable_units: int,
        renewable_fuel_target_summary: List[ComplianceReportSummaryRowSchema],
    ) -> List[ComplianceReportSummaryRowSchema]:
        non_compliance_penalty_payable = int(
            (non_compliance_penalty_payable_units * Decimal(-600.0)).max(0)
        )
        line_11 = next(row for row in renewable_fuel_target_summary if row.line == "11")

        non_compliance_summary_lines = {
            "11": {"total_value": line_11.total_value},
            "21": {"total_value": non_compliance_penalty_payable},
            "": {"total_value": non_compliance_penalty_payable + line_11.total_value},
        }

        non_compliance_penalty_summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=(
                    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[line][
                        "description"
                    ].format(non_compliance_penalty_payable_units * -1)
                ),
                field=NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[line]["field"],
                gasoline=values.get("gasoline", 0),
                diesel=values.get("diesel", 0),
                jet_fuel=values.get("jet_fuel", 0),
                total_value=values.get("total_value", 0),
                format="currency",
            )
            for line, values in non_compliance_summary_lines.items()
        ]

        return non_compliance_penalty_summary

    @service_handler
    async def calculate_fuel_supply_compliance_units(self, report_id: int) -> int:
        """
        Calculate the total compliance units for Line 18 based on effective fuel supplies.
        """
        # Fetch fuel supply records
        fuel_supply_records = await self.get_effective_fuel_supplies(report_id)

        # Initialize compliance units sum
        compliance_units_sum = 0

        # Calculate compliance units for each fuel supply record
        for fuel_supply in fuel_supply_records:
            TCI = fuel_supply.target_ci or 0  # Target Carbon Intensity
            EER = fuel_supply.eer or 0  # Energy Effectiveness Ratio
            RCI = fuel_supply.ci_of_fuel or 0  # Recorded Carbon Intensity
            UCI = 0  # Assuming additional carbon intensity attributable to use is not available
            Q = fuel_supply.quantity or 0  # Quantity of Fuel Supplied
            ED = fuel_supply.energy_density or 0  # Energy Density

            # Apply the compliance units formula
            compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
            compliance_units_sum += compliance_units

        return int(compliance_units_sum)

    @service_handler
    async def calculate_fuel_export_compliance_units(self, report_id: int) -> int:
        """
        Calculate the total compliance units for Line 19 based on effective fuel supplies.
        """
        # Fetch fuel export records
        fuel_export_records = await self.get_effective_fuel_exports(report_id)

        # Initialize compliance units sum
        compliance_units_sum = 0
        # Calculate compliance units for each fuel export record
        for fuel_export in fuel_export_records:
            TCI = fuel_export.target_ci or 0  # Target Carbon Intensity
            EER = fuel_export.eer or 0  # Energy Effectiveness Ratio
            RCI = fuel_export.ci_of_fuel or 0  # Recorded Carbon Intensity
            UCI = 0  # Assuming additional carbon intensity attributable to use is not available
            Q = fuel_export.quantity or 0  # Quantity of Fuel Supplied
            ED = fuel_export.energy_density or 0  # Energy Density

            # Apply the compliance units formula
            compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
            compliance_units = -compliance_units
            compliance_units = round(compliance_units) if compliance_units < 0 else 0

            compliance_units_sum += compliance_units

        return int(compliance_units_sum)

    @service_handler
    async def get_effective_fuel_supplies(self, report_id: int):
        report = await self.repo.get_compliance_report(report_id)
        if not report:
            raise ValueError("Compliance report not found")

        # Get all supplemental reports in order
        supplemental_reports = report.supplemental_reports

        # Start with the original report's fuel supplies
        original_supplies = await self.fuel_supply_repo.get_fuel_supplies(
            report.original_report_id
        )

        effective_supplies = {
            supply.fuel_supply_id: supply for supply in original_supplies
        }

        # Apply changes from each supplemental report up to the desired version
        for report in supplemental_reports:
            supp_supplies = await self.fuel_supply_repo.get_fuel_supplies(
                report.compliance_report_id
            )

            for supply in supp_supplies:
                if supply.change_type == ChangeType.DELETE:
                    effective_supplies.pop(supply.previous_fuel_supply_id, None)
                elif supply.change_type == ChangeType.UPDATE:
                    effective_supplies[supply.previous_fuel_supply_id] = supply
                else:  # CREATE
                    effective_supplies[supply.fuel_supply_id] = supply

        return list(effective_supplies.values())

    @service_handler
    async def get_effective_fuel_exports(
        self, report_id: int, is_supplemental: bool = False
    ):
        report = await self.repo.get_compliance_report(report_id)
        if not report:
            raise ValueError("Compliance report not found")

        # Get all supplemental reports in order
        supplemental_reports = report.supplemental_reports

        # Start with the original report's fuel exports
        original_exports = await self.fuel_export_repo.get_fuel_exports(
            report.original_report_id
        )

        effective_exports = {
            export.fuel_export_id: export for export in original_exports
        }

        # Apply changes from each supplemental report up to the desired version
        for report in supplemental_reports:
            supp_supplies = await self.fuel_export_repo.get_fuel_exports(
                report.compliance_report_id
            )

            for export in supp_supplies:
                if export.change_type == ChangeType.DELETE:
                    effective_exports.pop(export.previous_fuel_export_id, None)
                elif export.change_type == ChangeType.UPDATE:
                    effective_exports[export.previous_fuel_export_id] = export
                else:  # CREATE
                    effective_exports[export.fuel_export_id] = export

        return list(effective_exports.values())


#     async def are_identical(
#         self,
#         report_id: int,
#         summary_1: ComplianceReportSummarySchema,
#         summary_2: ComplianceReportSummarySchema,
#     ) -> bool:
#         comparison = self.compare_summaries(report_id, summary_1, summary_2)

#         # Check if all deltas are zero
#         for field, values in comparison.items():
#             if values["delta"] != 0:
#                 return False

#         return True

#     async def compare_summaries(
#         self,
#         report_id: int,
#         summary_1: ComplianceReportSummarySchema,
#         summary_2: ComplianceReportSummarySchema,
#     ) -> Dict[str, Dict[str, Any]]:
#         """
#         Compare two compliance report summaries and return the values and delta for each field.

#         :param report_id: The ID of the original compliance report
#         :param summary_1_id: The ID of the first summary to compare
#         :param summary_2_id: The ID of the second summary to compare
#         :return: A dictionary containing the values and delta for each field
#         """
#         if not summary_1 or not summary_2:
#             raise ValueError(
#                 f"""One or both summaries not found: {
#                              summary_1.summary_id}, {summary_2.summary_id}"""
#             )

#         if (
#             summary_1.compliance_report_id != report_id
#             or summary_2.compliance_report_id != report_id
#         ):
#             raise ValueError(
#                 f"""Summaries do not belong to the specified report: {report_id}"""
#             )

#         comparison = {}

#         # Compare all float fields
#         float_columns = [
#             c.name
#             for c in ComplianceReportSummary.__table__.columns
#             if isinstance(c.type, Float)
#         ]
#         for column in float_columns:
#             value_1 = getattr(summary_1, column)
#             value_2 = getattr(summary_2, column)
#             delta = value_2 - value_1
#             comparison[column] = {
#                 "summary_1_value": value_1,
#                 "summary_2_value": value_2,
#                 "delta": delta,
#             }

#         return comparison
