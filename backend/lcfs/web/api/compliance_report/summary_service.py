import re
import structlog
from datetime import datetime
from decimal import Decimal
from fastapi import Depends
from sqlalchemy import inspect
from typing import List, Tuple, Dict, Optional, Union, Any

from lcfs.db.models import FuelSupply
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    ReportingFrequency,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.utils.constants import LCFS_Constants
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.compliance_report.constants import (
    PART3_LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
    PRESCRIBED_PENALTY_RATE,
    FORMATS,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryRowSchema,
    ComplianceReportSummarySchema,
    ComplianceReportSummaryUpdateSchema,
)
from lcfs.web.api.compliance_report.summary_repo import (
    ComplianceReportSummaryRepository,
)
from lcfs.web.api.fuel_export.repo import FuelExportRepository
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.notional_transfer.services import NotionalTransferServices
from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.api.transaction.repo import TransactionRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.utils.calculations import calculate_compliance_units

logger = structlog.get_logger(__name__)


class ComplianceDataService:
    def __init__(self):
        self.compliance_period = None
        self.nickname = None

    def set_period(self, period: int):
        self.compliance_period = period

    def get_period(self) -> Optional[int]:
        return self.compliance_period

    def set_nickname(self, nickname: str):
        self.nickname = nickname

    def get_nickname(self) -> Optional[str]:
        return self.nickname

    def is_legacy_year(self) -> bool:
        return (
            self.compliance_period < int(LCFS_Constants.LEGISLATION_TRANSITION_YEAR)
            if self.compliance_period is not None
            else False
        )


# Create a global instance
compliance_data_service = ComplianceDataService()


def get_compliance_data_service():
    return compliance_data_service


class ComplianceReportSummaryService:
    def __init__(
        self,
        repo: ComplianceReportSummaryRepository = Depends(),
        cr_repo: ComplianceReportRepository = Depends(),
        trxn_repo: TransactionRepository = Depends(),
        notional_transfer_service: NotionalTransferServices = Depends(
            NotionalTransferServices
        ),
        fuel_supply_repo: FuelSupplyRepository = Depends(FuelSupplyRepository),
        fuel_export_repo: FuelExportRepository = Depends(FuelExportRepository),
        allocation_agreement_repo: AllocationAgreementRepository = Depends(
            AllocationAgreementRepository
        ),
        other_uses_repo: OtherUsesRepository = Depends(OtherUsesRepository),
        compliance_data_service: ComplianceDataService = Depends(
            get_compliance_data_service
        ),
    ):
        self.repo = repo
        self.cr_repo = cr_repo
        self.notional_transfer_service = notional_transfer_service
        self.trxn_repo = trxn_repo
        self.fuel_supply_repo = fuel_supply_repo
        self.fuel_export_repo = fuel_export_repo
        self.allocation_agreement_repo = allocation_agreement_repo
        self.other_uses_repo = other_uses_repo
        self.compliance_data_service = compliance_data_service

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
            renewable_fuel_target_summary=[],
            low_carbon_fuel_target_summary=[],
            non_compliance_penalty_summary=[],
            can_sign=False,
        )

        for column in inspector.mapper.column_attrs:
            line = self._extract_line_number(column.key)

            # Skip Non-display Columns
            if (
                "line_11_fossil_derived_base_fuel" in column.key
                or "line_21_surplus_deficit_ratio" in column.key
            ):
                continue

            # Decide which section of the summary we're dealing with:
            if line in range(1, 12):
                self._handle_renewable_line(summary, summary_obj, column.key, line)
            elif line in range(12, 23):
                self._handle_low_carbon_line(summary, summary_obj, column.key, line)

            # Let's just use special logic to calculate these
            if line in [11, 21]:
                self._handle_summary_lines(summary, summary_obj, column.key, line)

            if column.key == "total_non_compliance_penalty_payable":
                self._handle_summary_lines(summary, summary_obj, column.key, line)

        # DB Columns are not in the same order as display, so sort them
        summary.low_carbon_fuel_target_summary.sort(
            key=lambda row: int(
                re.match(r"(\d+)", row.line).group(1)
                if compliance_data_service.is_legacy_year()
                else row.line
            )
        )

        return summary

    def _get_line_value(self, line: int, is_legacy: bool = False) -> Union[str, int]:
        """Helper method to format line values based on legacy year status"""
        if not is_legacy:
            return line

        if line is None:
            return line
        elif 1 <= line <= 11:
            return f"{line} | {line + 11}"
        elif 12 <= line <= 22:
            mapping = {
                12: "23",
                13: "24",
                14: "25",
                15: "26",
                16: "26a",
                17: "26b",
                18: "26c",
                19: "27",
                20: "28",
            }
            return mapping.get(line, str(line))
        return str(line)

    def _extract_line_number(self, column_key: str) -> Optional[int]:
        """Extract the line number (1..N) from a column key like 'line_4_...' using regex."""
        match = re.search(r"line_(\d+)_", column_key)
        return int(match.group(1)) if match else None

    def _handle_renewable_line(
        self, summary, summary_obj, column_key, line: int
    ) -> None:
        """Populate the renewable_fuel_target_summary section"""
        # Find or create the row
        existing_element = self._get_or_create_summary_row(
            summary.renewable_fuel_target_summary,
            line,
            default_format=FORMATS.NUMBER if line != 11 else FORMATS.CURRENCY,
            default_descriptions=RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
            summary_obj=summary_obj,
            # Provide a special description function for lines 6 or 8:
            special_description_func=(
                self._renewable_special_description if line in [6, 8] else None
            ),
        )

        # Update gasoline/diesel/jet_fuel fields
        value = int(getattr(summary_obj, column_key) or 0)

        self._assign_fuel_value(existing_element, column_key, value)

    def _handle_low_carbon_line(
        self, summary, summary_obj, column_key, line: int
    ) -> None:
        """Populate the low_carbon_fuel_target_summary section"""
        is_legacy = compliance_data_service.is_legacy_year()
        if is_legacy and line > 20:
            return
        description = self._format_description(
            line=line,
            descriptions_dict=(
                PART3_LOW_CARBON_FUEL_TARGET_DESCRIPTIONS
                if is_legacy
                else LOW_CARBON_FUEL_TARGET_DESCRIPTIONS
            ),
        )
        desc = None
        if line == 21:
            desc = self._non_compliance_special_description(
                line, summary_obj, LOW_CARBON_FUEL_TARGET_DESCRIPTIONS
            )
        elif line in [17, 18] and is_legacy:
            desc = self._part3_special_description(
                line, PART3_LOW_CARBON_FUEL_TARGET_DESCRIPTIONS
            )
        else:
            desc = description
        summary.low_carbon_fuel_target_summary.append(
            ComplianceReportSummaryRowSchema(
                line=self._get_line_value(line, is_legacy),
                format=(
                    FORMATS.CURRENCY.value
                    if (line == 21 or (line == 20 and is_legacy))
                    else FORMATS.NUMBER.value
                ),
                description=desc,
                field=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                value=int(getattr(summary_obj, column_key) or 0),
                units=(
                    PART3_LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["units"]
                    if is_legacy
                    else ""
                ),
                bold=True if (is_legacy and line > 18) else False,
            )
        )

    def _handle_summary_lines(
        self, summary, summary_obj, column_key, line: int
    ) -> None:
        """Populate the non_compliance_penalty_summary section"""
        existing_element = self._get_or_create_summary_row(
            summary.non_compliance_penalty_summary,
            line,
            default_format=FORMATS.CURRENCY,
            default_descriptions=NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
            summary_obj=summary_obj,
            # Provide a special description function for line 21
            special_description_func=(
                self._non_compliance_special_description if line == 21 else None
            ),
        )

        # Summary lines only report total_value
        value = int(getattr(summary_obj, column_key) or 0)
        existing_element.total_value += value

    def _get_or_create_summary_row(
        self,
        target_list: list,
        line: int or None,
        default_format,
        default_descriptions: dict,
        summary_obj,
        special_description_func=None,
    ) -> ComplianceReportSummaryRowSchema:
        """
        Find or create a ComplianceReportSummaryRowSchema in `target_list` with the matching line.
        The 'line' is stored as a string internally.
        """
        existing_element = next(
            (
                el
                for el in target_list
                if el.line
                == self._get_line_value(line, compliance_data_service.is_legacy_year())
            ),
            None,
        )
        if existing_element:
            return existing_element

        # Build the description (handle special formatting if needed)
        if special_description_func:
            description = special_description_func(
                line, summary_obj, default_descriptions
            )
        else:
            description = self._format_description(line, default_descriptions)

        # Create and append the new row
        new_element = ComplianceReportSummaryRowSchema(
            line=self._get_line_value(line, compliance_data_service.is_legacy_year()),
            format=default_format,
            description=description,
            field=default_descriptions[line]["field"],
        )
        target_list.append(new_element)
        return new_element

    def _assign_fuel_value(
        self, element: ComplianceReportSummaryRowSchema, column_key: str, value: int
    ) -> None:
        """Assign the correct field (gasoline/diesel/jet_fuel) on the row based on column_key suffix."""
        if column_key.endswith("_gasoline"):
            element.gasoline = value
        elif column_key.endswith("_diesel"):
            element.diesel = value
        elif column_key.endswith("_jet_fuel"):
            element.jet_fuel = value

    def _format_description(self, line, descriptions_dict):
        """
        Builds a description string from the dictionary.
        Optionally handle a special line with dynamic formatting.
        """
        base_desc = descriptions_dict[line].get(
            ("legacy" if compliance_data_service.is_legacy_year() else "description"),
            descriptions_dict[line].get("description"),
        )
        return base_desc  # By default, no fancy placeholders used here.

    def _renewable_special_description(self, line, summary_obj, descriptions_dict):
        """
        For lines 6 and 8, your original code does some .format() with three placeholders
        (line_4_eligible_renewable_fuel_required_* * 0.05).
        """
        base_desc = descriptions_dict[line].get(
            ("legacy" if compliance_data_service.is_legacy_year() else "description"),
            descriptions_dict[line].get("description"),
        )
        return base_desc.format(
            "{:,}".format(
                int(summary_obj.line_4_eligible_renewable_fuel_required_gasoline * 0.05)
            ),
            "{:,}".format(
                int(summary_obj.line_4_eligible_renewable_fuel_required_diesel * 0.05)
            ),
            "{:,}".format(
                int(summary_obj.line_4_eligible_renewable_fuel_required_jet_fuel * 0.05)
            ),
        )

    def _non_compliance_special_description(self, line, summary_obj, descriptions_dict):
        """
        For line 21, your original code does .format(...) with summary_obj.line_21_non_compliance_penalty_payable / 600
        """
        base_desc = descriptions_dict[line].get(
            ("legacy" if compliance_data_service.is_legacy_year() else "description"),
            descriptions_dict[line].get("description"),
        )
        return base_desc.format(
            "{:,}".format(int(summary_obj.line_21_non_compliance_penalty_payable / 600))
        )

    def _part3_special_description(self, line, descriptions_dict):
        """
        For line 26a and 26b, your original code does .format(...) with compliance report nick name
        """
        base_desc = descriptions_dict[line].get(
            ("legacy" if compliance_data_service.is_legacy_year() else "description"),
            descriptions_dict[line].get("description"),
        )
        return base_desc.format("{:}".format(compliance_data_service.get_nickname()))

    @service_handler
    async def update_compliance_report_summary(
        self,
        report_id: int,
        summary_data: ComplianceReportSummaryUpdateSchema,
    ) -> ComplianceReportSummarySchema:
        """
        Autosave compliance report summary details for a specific summary by ID.
        """
        await self.repo.save_compliance_report_summary(summary_data)
        summary_data = await self.calculate_compliance_report_summary(report_id)

        return summary_data

    @service_handler
    async def calculate_compliance_report_summary(
        self, report_id: int
    ) -> ComplianceReportSummarySchema:
        """Several fields on Report Summary are Transient until locked, this function will re-calculate fields as necessary"""
        # Fetch the compliance report details
        compliance_report = await self.cr_repo.get_compliance_report_by_id(report_id)
        if not compliance_report:
            raise DataNotFoundException("Compliance report not found.")

        prev_compliance_report = None
        if not compliance_report.supplemental_initiator:
            prev_compliance_report = (
                await self.cr_repo.get_assessed_compliance_report_by_period(
                    compliance_report.organization_id,
                    int(compliance_report.compliance_period.description) - 1,
                )
            )

        summary_model = compliance_report.summary
        compliance_data_service.set_nickname(compliance_report.nickname)
        compliance_data_service.set_period(
            int(compliance_report.compliance_period.description)
        )
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
            await self.notional_transfer_service.get_notional_transfers(report_id)
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

        # Get effective fuel supplies using the updated logic
        effective_fuel_supplies = (
            await self.fuel_supply_repo.get_effective_fuel_supplies(
                compliance_report.compliance_report_group_uuid,
                compliance_report.compliance_report_id,
            )
        )

        # Get effective other uses
        effective_other_uses = await self.other_uses_repo.get_effective_other_uses(
            compliance_report.compliance_report_group_uuid,
            compliance_report.compliance_report_id,
            return_model=True,
        )

        # Fetch fuel quantities
        # line 1
        fossil_quantities = await self.calculate_fuel_quantities(
            compliance_report.compliance_report_id,
            effective_fuel_supplies,
            fossil_derived=True,
        )
        # line 2
        filtered_renewable_fuel_supplies = [
            fs for fs in effective_fuel_supplies if fs.fuel_type.renewable
        ]

        filtered_renewable_other_uses = [
            ou for ou in effective_other_uses if ou.fuel_type.renewable
        ]

        all_renewable_records = [
            *filtered_renewable_fuel_supplies,
            *filtered_renewable_other_uses,
        ]

        renewable_quantities = await self.calculate_fuel_quantities(
            compliance_report.compliance_report_id,
            all_renewable_records,
            fossil_derived=False,
        )

        renewable_fuel_target_summary = self.calculate_renewable_fuel_target_summary(
            fossil_quantities,
            renewable_quantities,
            previous_retained,
            previous_obligation,
            notional_transfers_sums,
            compliance_period=compliance_period_start.year,
            prev_summary=compliance_report.summary,
        )
        low_carbon_fuel_target_summary, non_compliance_penalty_payable_units = (
            await self.calculate_low_carbon_fuel_target_summary(
                compliance_period_start,
                compliance_period_end,
                organization_id,
                compliance_report,
            )
        )
        non_compliance_penalty_summary = self.calculate_non_compliance_penalty_summary(
            non_compliance_penalty_payable_units, renewable_fuel_target_summary
        )

        existing_summary = self.convert_summary_to_dict(summary_model)

        fuel_export_records = await self.fuel_export_repo.get_effective_fuel_exports(
            compliance_report.compliance_report_group_uuid,
            compliance_report.compliance_report_id,
        )

        allocation_agreements = (
            await self.allocation_agreement_repo.get_allocation_agreements(
                compliance_report.compliance_report_id
            )
        )

        can_sign = (
            len(effective_fuel_supplies) > 0
            or len(notional_transfers.notional_transfers) > 0
            or len(fuel_export_records) > 0
            or len(allocation_agreements) > 0
        )

        early_issuance_summary = await self.calculate_early_issuance_summary(
            compliance_report
        )

        summary = self.map_to_schema(
            compliance_report,
            renewable_fuel_target_summary,
            low_carbon_fuel_target_summary,
            non_compliance_penalty_summary,
            summary_model,
            can_sign,
            early_issuance_summary,
        )

        # Only save if summary has changed
        if existing_summary.model_dump(mode="json") != summary.model_dump(mode="json"):
            logger.info(
                f"Report has changed, updating summary for report {compliance_report.compliance_report_id}"
            )
            await self.repo.save_compliance_report_summary(summary)
            return summary

        return existing_summary

    async def calculate_early_issuance_summary(self, compliance_report):
        early_issuance_summary = None
        if compliance_report.reporting_frequency == ReportingFrequency.QUARTERLY:
            quarterly_fs_credits = (
                await self.calculate_quarterly_fuel_supply_compliance_units(
                    compliance_report
                )
            )
            early_issuance_summary = [
                ComplianceReportSummaryRowSchema(
                    line="Q1",
                    description="Compliance units being issued for the supply of fuel in quarter 1",
                    value=quarterly_fs_credits[0],
                ),
                ComplianceReportSummaryRowSchema(
                    line="Q2",
                    description="Compliance units being issued for the supply of fuel in quarter 2",
                    value=quarterly_fs_credits[1],
                ),
                ComplianceReportSummaryRowSchema(
                    line="Q3",
                    description="Compliance units being issued for the supply of fuel in quarter 3",
                    value=quarterly_fs_credits[2],
                ),
                ComplianceReportSummaryRowSchema(
                    line="Q4",
                    description="Compliance units being issued for the supply of fuel in quarter 4",
                    value=quarterly_fs_credits[3],
                ),
            ]
        return early_issuance_summary

    def map_to_schema(
        self,
        compliance_report,
        renewable_fuel_target_summary,
        low_carbon_fuel_target_summary,
        non_compliance_penalty_summary,
        summary_model,
        can_sign,
        early_issuance_summary,
    ) -> ComplianceReportSummarySchema:
        summary = ComplianceReportSummarySchema(
            summary_id=summary_model.summary_id,
            compliance_report_id=compliance_report.compliance_report_id,
            is_locked=summary_model.is_locked,
            quarter=summary_model.quarter,
            renewable_fuel_target_summary=renewable_fuel_target_summary,
            low_carbon_fuel_target_summary=low_carbon_fuel_target_summary,
            non_compliance_penalty_summary=non_compliance_penalty_summary,
            can_sign=can_sign,
            early_issuance_summary=early_issuance_summary,
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
        prev_summary: ComplianceReportSummary,
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
            "gasoline": round(tracked_totals["gasoline"] * 0.05),
            "diesel": round(tracked_totals["diesel"] * 0.04),
            "jet_fuel": round(tracked_totals["jet_fuel"] * jet_fuel_percentage),
        }

        # line 6
        retained_renewables = {"gasoline": 0.0, "diesel": 0.0, "jet_fuel": 0.0}
        # line 8
        deferred_renewables = {"gasoline": 0.0, "diesel": 0.0, "jet_fuel": 0.0}

        for category in ["gasoline", "diesel", "jet_fuel"]:
            required_renewable_quantity = eligible_renewable_fuel_required.get(category)
            previous_required_renewable_quantity = getattr(
                prev_summary,
                f"""line_4_eligible_renewable_fuel_required_{
                    category}""",
            )

            # only carry over line 6,8 if required quantities have not changed
            if previous_required_renewable_quantity == required_renewable_quantity:
                retained_renewables[category] = getattr(
                    prev_summary,
                    f"""line_6_renewable_fuel_retained_{
                        category}""",
                )
                deferred_renewables[category] = getattr(
                    prev_summary, f"""line_8_obligation_deferred_{category}"""
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
            1: {
                "gasoline": fossil_quantities.get("gasoline", 0),
                "diesel": fossil_quantities.get("diesel", 0),
                "jet_fuel": fossil_quantities.get("jet_fuel", 0),
            },
            2: {
                "gasoline": renewable_quantities.get("gasoline", 0),
                "diesel": renewable_quantities.get("diesel", 0),
                "jet_fuel": renewable_quantities.get("jet_fuel", 0),
            },
            3: {
                "gasoline": tracked_totals.get("gasoline", 0),
                "diesel": tracked_totals.get("diesel", 0),
                "jet_fuel": tracked_totals.get("jet_fuel", 0),
            },
            4: {
                "gasoline": eligible_renewable_fuel_required.get("gasoline", 0),
                "diesel": eligible_renewable_fuel_required.get("diesel", 0),
                "jet_fuel": eligible_renewable_fuel_required.get("jet_fuel", 0),
            },
            # Notionally transferred value
            5: notional_transfers_sums,
            6: {
                "gasoline": retained_renewables.get("gasoline", 0),
                "diesel": retained_renewables.get("diesel", 0),
                "jet_fuel": retained_renewables.get("jet_fuel", 0),
            },
            7: {
                "gasoline": previous_retained.get("gasoline", 0),
                "diesel": previous_retained.get("diesel", 0),
                "jet_fuel": previous_retained.get("jet_fuel", 0),
            },
            8: {
                "gasoline": deferred_renewables.get("gasoline", 0),
                "diesel": deferred_renewables.get("diesel", 0),
                "jet_fuel": deferred_renewables.get("jet_fuel", 0),
            },
            # Renewable obligation added from previous period
            9: {
                "gasoline": previous_obligation.get("gasoline", 0),
                "diesel": previous_obligation.get("diesel", 0),
                "jet_fuel": previous_obligation.get("jet_fuel", 0),
            },
            10: {
                "gasoline": net_renewable_supplied.get("gasoline", 0),
                "diesel": net_renewable_supplied.get("diesel", 0),
                "jet_fuel": net_renewable_supplied.get("jet_fuel", 0),
            },
            11: {
                "gasoline": non_compliance_penalties.get("gasoline", 0),
                "diesel": non_compliance_penalties.get("diesel", 0),
                "jet_fuel": non_compliance_penalties.get("jet_fuel", 0),
            },
        }

        summary = [
            ComplianceReportSummaryRowSchema(
                line=self._get_line_value(
                    line, compliance_data_service.is_legacy_year()
                ),
                description=(
                    RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["description"].format(
                        "{:,}".format(round(summary_lines[4]["gasoline"] * 0.05)),
                        "{:,}".format(round(summary_lines[4]["diesel"] * 0.05)),
                        "{:,}".format(round(summary_lines[4]["jet_fuel"] * 0.05)),
                    )
                    if (line in [6, 8])
                    else RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["description"]
                ),
                field=RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                gasoline=values.get("gasoline", 0),
                diesel=values.get("diesel", 0),
                jet_fuel=values.get("jet_fuel", 0),
                total_value=values.get("gasoline", 0)
                + values.get("diesel", 0)
                + values.get("jet_fuel", 0),
                format=(FORMATS.CURRENCY if (str(line) == "11") else FORMATS.NUMBER),
            )
            for line, values in summary_lines.items()
        ]

        return summary

    async def calculate_low_carbon_fuel_target_summary(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
        compliance_report: ComplianceReport,
    ) -> Tuple[List[ComplianceReportSummaryRowSchema], int]:
        previous_summary = None
        if compliance_report.version > 0:
            previous_summary = await self.repo.get_previous_summary(compliance_report)

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
        compliance_units_prev_issued_for_fuel_supply = (
            previous_summary.line_18_units_to_be_banked if previous_summary else 0
        )  # line 15
        compliance_units_prev_issued_for_fuel_export = (
            previous_summary.line_19_units_to_be_exported if previous_summary else 0
        )  # line 16
        available_balance_for_period = await self.trxn_repo.calculate_available_balance_for_period(
            organization_id, compliance_period_start.year
        )  # line 17 - Available compliance unit balance on March 31, <compliance-year + 1>
        compliance_units_curr_issued_for_fuel_supply = (
            await self.calculate_fuel_supply_compliance_units(compliance_report)
        )  # line 18 fuel supply compliance units total
        compliance_units_curr_issued_for_fuel_export = (
            await self.calculate_fuel_export_compliance_units(compliance_report)
        )  # line 19
        compliance_unit_balance_change_from_assessment = (
            compliance_units_curr_issued_for_fuel_supply
            + compliance_units_curr_issued_for_fuel_export
            - compliance_units_prev_issued_for_fuel_supply  # Subtract Previously Issued
            - compliance_units_prev_issued_for_fuel_export
        )  # line 20 = line 18 + line 19 - line 15 - line 16

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
                line=self._get_line_value(
                    line, compliance_data_service.is_legacy_year()
                ),
                description=(
                    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["description"].format(
                        "{:,}".format(non_compliance_penalty_payable_units * -1)
                    )
                    if (line == 21)
                    else LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["description"]
                ),
                field=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                value=values.get("value", 0),
                format=(FORMATS.CURRENCY if (line == 21) else FORMATS.NUMBER),
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
        line_11 = next(row for row in renewable_fuel_target_summary if row.line == 11)

        non_compliance_summary_lines = {
            11: {"total_value": line_11.total_value},
            21: {"total_value": non_compliance_penalty_payable},
            None: {"total_value": non_compliance_penalty_payable + line_11.total_value},
        }

        non_compliance_penalty_summary = [
            ComplianceReportSummaryRowSchema(
                line=self._get_line_value(
                    line, compliance_data_service.is_legacy_year()
                ),
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
                format=FORMATS.CURRENCY,
            )
            for line, values in non_compliance_summary_lines.items()
        ]

        return non_compliance_penalty_summary

    @service_handler
    async def calculate_fuel_quantities(
        self,
        compliance_report_id: int,
        records: List[Union[FuelSupply, OtherUses]],
        fossil_derived: bool,
    ) -> Dict[str, float]:
        """
        Calculate the total quantities of fuels, separated by fuel category and fossil_derived flag.
        """
        fuel_quantities = self.repo.aggregate_quantities(records, fossil_derived)

        other_uses = await self.repo.aggregate_other_uses_quantity(
            compliance_report_id, fossil_derived
        )

        for key, value in other_uses.items():
            fuel_quantities[key] = fuel_quantities.get(key, 0) + value

        return dict(fuel_quantities)

    @service_handler
    async def calculate_fuel_supply_compliance_units(
        self, report: ComplianceReport
    ) -> int:
        """
        Calculate the total compliance units for Line 18 based on effective fuel supplies.
        """
        # Fetch fuel supply records
        fuel_supply_records = await self.fuel_supply_repo.get_effective_fuel_supplies(
            report.compliance_report_group_uuid, report.compliance_report_id
        )

        # Initialize compliance units sum
        compliance_units_sum = 0.0

        # Calculate compliance units for each fuel supply record
        for fuel_supply in fuel_supply_records:

            TCI = fuel_supply.target_ci or 0  # Target Carbon Intensity
            EER = fuel_supply.eer or 0  # Energy Effectiveness Ratio
            RCI = fuel_supply.ci_of_fuel or 0  # Recorded Carbon Intensity
            UCI = fuel_supply.uci or 0  # Additional Carbon Intensity
            Q = (
                (fuel_supply.quantity or 0)
                + (fuel_supply.q1_quantity or 0)
                + (fuel_supply.q2_quantity or 0)
                + (fuel_supply.q3_quantity or 0)
                + (fuel_supply.q4_quantity or 0)
            )
            ED = fuel_supply.energy_density or 0  # Energy Density

            # Apply the compliance units formula
            compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
            compliance_units_sum += compliance_units

        return round(compliance_units_sum)

    @service_handler
    async def calculate_quarterly_fuel_supply_compliance_units(
        self, report: ComplianceReport
    ) -> list[float | Any]:
        """
        Calculate the total compliance units for the early issuance Summary
        """
        # Fetch fuel supply records
        fuel_supply_records = await self.fuel_supply_repo.get_effective_fuel_supplies(
            report.compliance_report_group_uuid, report.compliance_report_id
        )

        # Initialize compliance units sum
        compliance_units_sum_q1 = 0.0
        compliance_units_sum_q2 = 0.0
        compliance_units_sum_q3 = 0.0
        compliance_units_sum_q4 = 0.0

        # Calculate compliance units for each fuel supply record
        for fuel_supply in fuel_supply_records:
            TCI = fuel_supply.target_ci or 0  # Target Carbon Intensity
            EER = fuel_supply.eer or 0  # Energy Effectiveness Ratio
            RCI = fuel_supply.ci_of_fuel or 0  # Recorded Carbon Intensity
            UCI = fuel_supply.uci or 0  # Additional Carbon Intensity
            ED = fuel_supply.energy_density or 0  # Energy Density

            # Apply the compliance units formula
            compliance_units_sum_q1 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q1_quantity, ED
            )
            compliance_units_sum_q2 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q2_quantity or 0, ED
            )
            compliance_units_sum_q3 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q3_quantity or 0, ED
            )
            compliance_units_sum_q4 += calculate_compliance_units(
                TCI, EER, RCI, UCI, fuel_supply.q4_quantity or 0, ED
            )

        return [
            round(compliance_units_sum_q1),
            round(compliance_units_sum_q2),
            round(compliance_units_sum_q3),
            round(compliance_units_sum_q4),
        ]

    @service_handler
    async def calculate_fuel_export_compliance_units(
        self, report: ComplianceReport
    ) -> int:
        """
        Calculate the total compliance units for Line 19 based on effective fuel supplies.
        """
        # Fetch fuel export records
        fuel_export_records = await self.fuel_export_repo.get_effective_fuel_exports(
            report.compliance_report_group_uuid, report.compliance_report_id
        )

        # Initialize compliance units sum
        compliance_units_sum = 0.0
        # Calculate compliance units for each fuel export record
        for fuel_export in fuel_export_records:
            TCI = fuel_export.target_ci or 0  # Target Carbon Intensity
            EER = fuel_export.eer or 0  # Energy Effectiveness Ratio
            RCI = fuel_export.ci_of_fuel or 0  # Recorded Carbon Intensity
            UCI = fuel_export.uci or 0  # Additional Carbon Intensity
            Q = fuel_export.quantity or 0  # Quantity of Fuel Supplied
            ED = fuel_export.energy_density or 0  # Energy Density

            # Apply the compliance units formula
            compliance_units = calculate_compliance_units(TCI, EER, RCI, UCI, Q, ED)
            compliance_units = -compliance_units
            compliance_units = compliance_units if compliance_units < 0 else 0

            compliance_units_sum += compliance_units

        return round(compliance_units_sum)
