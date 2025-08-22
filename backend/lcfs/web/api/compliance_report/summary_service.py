import re
import structlog
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple, Dict, Optional, Union

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

    async def _should_lock_lines_7_and_9(
        self, compliance_report: ComplianceReport
    ) -> bool:
        """
        Check if Lines 7 and 9 should be locked for 2025+ reports with previous assessed report.

        Returns:
            bool: True if Lines 7 and 9 should be locked (non-editable)
        """
        compliance_year = int(compliance_report.compliance_period.description)

        # Only lock for 2025+ reports
        if compliance_year < 2025:
            return False

        # Check for previous assessed report
        if not compliance_report.supplemental_initiator:
            prev_compliance_report = (
                await self.cr_repo.get_assessed_compliance_report_by_period(
                    compliance_report.organization_id, compliance_year - 1
                )
            )
            return prev_compliance_report is not None

        return False

    def convert_summary_to_dict(
        self,
        summary_obj: ComplianceReportSummary,
        compliance_report: ComplianceReport = None,
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
            penalty_override_enabled=(
                summary_obj.penalty_override_enabled
                if compliance_report
                and int(compliance_report.compliance_period.description) >= 2024
                else False
            ),
            renewable_penalty_override=(
                summary_obj.renewable_penalty_override
                if compliance_report
                and int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
            low_carbon_penalty_override=(
                summary_obj.low_carbon_penalty_override
                if compliance_report
                and int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
            penalty_override_date=(
                summary_obj.penalty_override_date
                if compliance_report
                and int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
            penalty_override_user=(
                summary_obj.penalty_override_user
                if compliance_report
                and int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
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
        if line == 11:  # Line 11 is the penalty and needs decimals
            value = float(getattr(summary_obj, column_key) or 0.0)
        else:  # Other lines (1-10) are volumes and should be integers
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
        elif line == 22:
            # Handle year replacement for line 22
            compliance_year = (
                int(summary_obj.compliance_report.compliance_period.description)
                if summary_obj.compliance_report
                and summary_obj.compliance_report.compliance_period
                else 2024  # fallback year
            )
            desc = description.replace(
                "{{COMPLIANCE_YEAR_PLUS_1}}", str(compliance_year + 1)
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
        self,
        element: ComplianceReportSummaryRowSchema,
        column_key: str,
        value: Union[int, float],
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
        # Get compliance report to determine the year for penalty override validation
        compliance_report = await self.cr_repo.get_compliance_report_by_id(report_id)
        compliance_year = None
        if compliance_report and compliance_report.compliance_period:
            compliance_year = int(compliance_report.compliance_period.description)

        await self.repo.save_compliance_report_summary(summary_data, compliance_year)
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
            locked_summary = self.convert_summary_to_dict(
                compliance_report.summary, compliance_report
            )
            # If the summary is locked, Lines 7 and 9 are also locked
            locked_summary.lines_7_and_9_locked = True
            return locked_summary

        compliance_period_start = compliance_report.compliance_period.effective_date
        compliance_period_end = compliance_report.compliance_period.expiration_date
        organization_id = compliance_report.organization_id

        # Placeholder values for demonstration purposes
        # need to get these values from the db after fuel supply is implemented

        # Auto-populate Lines 7 and 9 for 2025+ reports from previous assessed report
        compliance_year = int(compliance_report.compliance_period.description)

        if prev_compliance_report and compliance_year >= 2025:
            # For 2025+ reports with previous assessed report: auto-populate and lock Lines 7 & 9
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

            # Update the current summary model with auto-populated values for Lines 7 and 9
            summary_model.line_7_previously_retained_gasoline = previous_retained[
                "gasoline"
            ]
            summary_model.line_7_previously_retained_diesel = previous_retained[
                "diesel"
            ]
            summary_model.line_7_previously_retained_jet_fuel = previous_retained[
                "jet_fuel"
            ]

            summary_model.line_9_obligation_added_gasoline = previous_obligation[
                "gasoline"
            ]
            summary_model.line_9_obligation_added_diesel = previous_obligation["diesel"]
            summary_model.line_9_obligation_added_jet_fuel = previous_obligation[
                "jet_fuel"
            ]

        elif prev_compliance_report:
            # For pre-2025 reports with previous report: use previous values but don't force update
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
            # No previous assessed report: use current summary values (editable)
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

            # Calculate total quantity - use quarterly fields if main quantity is None
            total_quantity = transfer.quantity
            if total_quantity is None:
                # Sum up quarterly quantities for quarterly notional transfers
                quarterly_sum = (
                    (transfer.q1_quantity or 0)
                    + (transfer.q2_quantity or 0)
                    + (transfer.q3_quantity or 0)
                    + (transfer.q4_quantity or 0)
                )
                total_quantity = quarterly_sum if quarterly_sum > 0 else 0

            # Update the corresponding category sum
            if transfer.received_or_transferred.lower() == "received":
                notional_transfers_sums[normalized_category] += total_quantity
            elif transfer.received_or_transferred.lower() == "transferred":
                notional_transfers_sums[normalized_category] -= total_quantity

        # Get effective fuel supplies using the updated logic
        effective_fuel_supplies = (
            await self.fuel_supply_repo.get_effective_fuel_supplies(
                compliance_report.compliance_report_group_uuid,
                compliance_report.compliance_report_id,
                compliance_report.version,
            )
        )

        # Get effective other uses
        effective_other_uses = await self.other_uses_repo.get_effective_other_uses(
            compliance_report.compliance_report_group_uuid,
            compliance_report.compliance_report_id,
            return_model=True,
        )

        # Fetch fuel quantities
        # line 1 - Filter fossil fuel supplies and other uses
        filtered_fossil_fuel_supplies = [
            fs for fs in effective_fuel_supplies if fs.fuel_type.fossil_derived
        ]

        filtered_fossil_other_uses = [
            ou for ou in effective_other_uses if ou.fuel_type.fossil_derived
        ]

        all_fossil_records = [
            *filtered_fossil_fuel_supplies,
            *filtered_fossil_other_uses,
        ]

        fossil_quantities = self.repo.aggregate_quantities(all_fossil_records, True)
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

        renewable_quantities = self.repo.aggregate_quantities(
            all_renewable_records, False
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

        # Check if Lines 7 and 9 should be locked (for draft/editable reports)
        lines_7_and_9_locked = await self._should_lock_lines_7_and_9(compliance_report)
        summary.lines_7_and_9_locked = lines_7_and_9_locked
        existing_summary.lines_7_and_9_locked = lines_7_and_9_locked

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
            penalty_override_enabled=(
                summary_model.penalty_override_enabled
                if int(compliance_report.compliance_period.description) >= 2024
                else False
            ),
            renewable_penalty_override=(
                summary_model.renewable_penalty_override
                if int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
            low_carbon_penalty_override=(
                summary_model.low_carbon_penalty_override
                if int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
            penalty_override_date=(
                summary_model.penalty_override_date
                if int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
            penalty_override_user=(
                summary_model.penalty_override_user
                if int(compliance_report.compliance_period.description) >= 2024
                else None
            ),
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
        # Define constants as Decimal
        DECIMAL_ZERO = Decimal("0")
        GAS_PERC = Decimal("0.05")
        DIESEL_PERC = Decimal("0.08") if compliance_period >= 2025 else Decimal("0.04")
        GAS_RATE = Decimal(str(PRESCRIBED_PENALTY_RATE["gasoline"]))
        DIESEL_RATE = Decimal(str(PRESCRIBED_PENALTY_RATE["diesel"]))
        JET_RATE = Decimal(str(PRESCRIBED_PENALTY_RATE["jet_fuel"]))

        # Convert input dicts to use Decimal values
        def to_decimal_dict(d):
            return {k: Decimal(str(v or 0)) for k, v in d.items()}

        decimal_fossil_quantities = to_decimal_dict(fossil_quantities)
        decimal_renewable_quantities = to_decimal_dict(renewable_quantities)
        decimal_previous_retained = to_decimal_dict(previous_retained)
        decimal_previous_obligation = to_decimal_dict(previous_obligation)
        decimal_notional_transfers_sums = to_decimal_dict(notional_transfers_sums)

        # line 3: Use Decimal
        decimal_tracked_totals = {
            category: decimal_fossil_quantities.get(category, DECIMAL_ZERO)
            + decimal_renewable_quantities.get(category, DECIMAL_ZERO)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        # line 4: Determine jet fuel percentage as Decimal
        if 2024 <= compliance_period <= 2027:
            jet_fuel_perc = DECIMAL_ZERO
        elif compliance_period == 2028:
            jet_fuel_perc = Decimal("0.01")
        elif compliance_period == 2029:
            jet_fuel_perc = Decimal("0.02")
        else:
            jet_fuel_perc = Decimal("0.03")

        # Calculate required amounts using Decimal
        decimal_eligible_renewable_fuel_required = {
            "gasoline": decimal_tracked_totals.get("gasoline", DECIMAL_ZERO) * GAS_PERC,
            "diesel": decimal_tracked_totals.get("diesel", DECIMAL_ZERO) * DIESEL_PERC,
            "jet_fuel": decimal_tracked_totals.get("jet_fuel", DECIMAL_ZERO)
            * jet_fuel_perc,
        }

        # line 6 & 8: Always preserve user-entered values, but cap at 5% of current line 4
        decimal_retained_renewables = {}
        decimal_deferred_renewables = {}

        for category in ["gasoline", "diesel", "jet_fuel"]:
            # Calculate the 5% cap based on current line 4 value, rounded to nearest integer
            current_required_quantity_dec = (
                decimal_eligible_renewable_fuel_required.get(category, DECIMAL_ZERO)
            )
            max_retained = (current_required_quantity_dec * Decimal("0.05")).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )

            # Always preserve line 6 value from current summary (user's input)
            # but cap it at 5% of current line 4
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
            decimal_retained_renewables[category] = min(line_6_value, max_retained)

            # Similarly for line 8 - preserve but cap at 5% of current line 4
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
            decimal_deferred_renewables[category] = min(line_8_value, max_retained)

        # line 10: Calculate net supplied using Decimal
        decimal_net_renewable_supplied = {
            category: decimal_renewable_quantities.get(category, DECIMAL_ZERO)
            + decimal_notional_transfers_sums.get(category, DECIMAL_ZERO)
            - decimal_retained_renewables.get(category, DECIMAL_ZERO)
            + decimal_previous_retained.get(category, DECIMAL_ZERO)
            + decimal_deferred_renewables.get(category, DECIMAL_ZERO)
            - decimal_previous_obligation.get(category, DECIMAL_ZERO)
            for category in ["gasoline", "diesel", "jet_fuel"]
        }

        # line 11: Calculate penalties using Decimal and quantize
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

        # Prepare summary_lines dictionary, converting Decimal back to float for schema compatibility
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
                "gasoline": int(
                    decimal_eligible_renewable_fuel_required.get(
                        "gasoline", DECIMAL_ZERO
                    )
                ),
                "diesel": int(
                    decimal_eligible_renewable_fuel_required.get("diesel", DECIMAL_ZERO)
                ),
                "jet_fuel": int(
                    decimal_eligible_renewable_fuel_required.get(
                        "jet_fuel", DECIMAL_ZERO
                    )
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

        # For Line 15 and 16, we should only use values from assessed reports
        # Get the last assessed report for this organization and compliance period
        assessed_report = await self.cr_repo.get_assessed_compliance_report_by_period(
            organization_id, compliance_period_start.year
        )

        compliance_units_transferred_out = int(
            await self.repo.get_transferred_out_compliance_units(
                compliance_period_start, compliance_period_end, organization_id
            )
        )  # line 12
        compliance_units_received = int(
            await self.repo.get_received_compliance_units(
                compliance_period_start, compliance_period_end, organization_id
            )
        )  # line 13
        compliance_units_issued = int(
            await self.repo.get_issued_compliance_units(
                compliance_period_start, compliance_period_end, organization_id
            )
        )  # line 14
        # Line 15: Only use values from assessed reports
        compliance_units_prev_issued_for_fuel_supply = int(
            assessed_report.summary.line_18_units_to_be_banked
            if assessed_report and assessed_report.summary
            else 0
        )  # line 15
        # Line 16: Only use values from assessed reports
        compliance_units_prev_issued_for_fuel_export = int(
            assessed_report.summary.line_19_units_to_be_exported
            if assessed_report and assessed_report.summary
            else 0
        )  # line 16

        # For supplemental reports with a locked summary, use the stored line_17 value
        # This preserves the available balance from when the supplemental report was created
        # For draft reports (not locked), always recalculate Line 17 dynamically
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
            # Calculate the available balance using the specific period end formula for Line 17
            available_balance_for_period = int(
                await self.trxn_repo.calculate_line_17_available_balance_for_period(
                    organization_id,
                    compliance_period_start.year,
                )
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
            + compliance_unit_balance_change_from_assessment
        )
        non_compliance_penalty_payable_units = (
            calculated_penalty_units if (calculated_penalty_units < 0) else 0
        )
        non_compliance_penalty_payable = (
            int(
                (
                    Decimal(str(non_compliance_penalty_payable_units))
                    * Decimal("-600.0")
                ).max(Decimal("0"))
            )
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

    def calculate_non_compliance_penalty_summary(
        self,
        non_compliance_penalty_payable_units: int,
        renewable_fuel_target_summary: List[ComplianceReportSummaryRowSchema],
    ) -> List[ComplianceReportSummaryRowSchema]:
        non_compliance_penalty_payable = (
            Decimal(str(non_compliance_penalty_payable_units)) * Decimal("-600.0")
        ).max(Decimal("0"))
        line_11 = next(row for row in renewable_fuel_target_summary if row.line == 11)
        # Convert line 11 total value to Decimal for accurate addition
        line_11_total_decimal = Decimal(str(line_11.total_value))

        non_compliance_summary_lines = {
            11: {"total_value": line_11_total_decimal},
            21: {"total_value": non_compliance_penalty_payable},
            None: {
                "total_value": non_compliance_penalty_payable + line_11_total_decimal
            },
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
                gasoline=float(values.get("gasoline", 0)),
                diesel=float(values.get("diesel", 0)),
                jet_fuel=float(values.get("jet_fuel", 0)),
                total_value=float(values.get("total_value", 0)),
                format=FORMATS.CURRENCY,
            )
            for line, values in non_compliance_summary_lines.items()
        ]

        return non_compliance_penalty_summary

    @service_handler
    async def calculate_fuel_supply_compliance_units(
        self, report: ComplianceReport
    ) -> int:
        """
        Calculate the total compliance units for Line 18 based on effective fuel supplies.
        """
        # Fetch fuel supply records
        fuel_supply_records = await self.fuel_supply_repo.get_effective_fuel_supplies(
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
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
            report.compliance_report_group_uuid,
            report.compliance_report_id,
            report.version,
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
