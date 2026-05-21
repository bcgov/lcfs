import re
import structlog
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple, Optional, Union

from fastapi import Depends
from sqlalchemy import inspect

from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    ReportingFrequency,
)
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.compliance_report.constants import (
    RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
    FORMATS,
    get_low_carbon_penalty_rate,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryRowSchema,
    ComplianceReportSummarySchema,
    ComplianceReportSummaryUpdateSchema,
)
from lcfs.web.api.compliance_report.summary_calculators import (
    ComplianceUnitsCalculator,
    LowCarbonFuelTargetCalculator,
    NonCompliancePenaltyCalculator,
    RenewableFuelTargetCalculator,
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


# Create a global instance
compliance_data_service = ComplianceDataService()


def get_compliance_data_service():
    return compliance_data_service


class ComplianceReportSummaryService:
    """
    Orchestration layer for compliance report summary generation.

    The actual line-by-line calculations live in domain-specific calculator
    classes under ``lcfs.web.api.compliance_report.summary_calculators``:
        - RenewableFuelTargetCalculator (Lines 1-11)
        - LowCarbonFuelTargetCalculator (Lines 12-22)
        - NonCompliancePenaltyCalculator (Lines 11/21 totals)
        - ComplianceUnitsCalculator (Lines 18, 19, quarterly)

    This service composes those calculators, handles DB-model conversion to
    schema, applies exemption overrides, and persists the resulting summary.
    """

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

    # ------------------------------------------------------------------
    # Calculator factories — instantiated lazily per call so that tests can
    # swap out service-level repos (`service.repo = ...`) and have those
    # changes picked up without rebuilding the calculator instances.
    # ------------------------------------------------------------------
    def _renewable_calculator(self) -> RenewableFuelTargetCalculator:
        return RenewableFuelTargetCalculator()

    def _low_carbon_calculator(self) -> LowCarbonFuelTargetCalculator:
        return LowCarbonFuelTargetCalculator(
            repo=self.repo,
            cr_repo=self.cr_repo,
            trxn_repo=self.trxn_repo,
        )

    def _non_compliance_calculator(self) -> NonCompliancePenaltyCalculator:
        return NonCompliancePenaltyCalculator()

    def _compliance_units_calculator(self) -> ComplianceUnitsCalculator:
        return ComplianceUnitsCalculator(
            fuel_supply_repo=self.fuel_supply_repo,
            fuel_export_repo=self.fuel_export_repo,
        )

    async def _should_lock_lines_7_and_9(
        self, compliance_report: ComplianceReport
    ) -> bool:
        """
        Lines 7 and 9 lock for ALL 2025+ reports (original or supplemental)
        when there is a previous assessed report, to prevent modification of
        retention/deferral data after the first compliance period.
        """
        compliance_year = int(compliance_report.compliance_period.description)

        if compliance_year < 2025:
            return False

        prev_compliance_report = (
            await self.cr_repo.get_assessed_compliance_report_by_period(
                compliance_report.organization_id, compliance_year - 1
            )
        )
        return prev_compliance_report is not None

    def convert_summary_to_dict(
        self,
        summary_obj: ComplianceReportSummary,
        compliance_report: ComplianceReport = None,
    ) -> ComplianceReportSummarySchema:
        """Convert a ComplianceReportSummary DB object to a schema."""
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
            lines_6_and_8_locked=summary_obj.is_locked,
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

            if (
                "line_11_fossil_derived_base_fuel" in column.key
                or "line_21_surplus_deficit_ratio" in column.key
            ):
                continue

            if line in range(1, 12):
                self._handle_renewable_line(summary, summary_obj, column.key, line)
            elif line in range(12, 23):
                self._handle_low_carbon_line(summary, summary_obj, column.key, line)

            if line in [11, 21]:
                self._handle_summary_lines(summary, summary_obj, column.key, line)

            if column.key == "total_non_compliance_penalty_payable":
                self._handle_summary_lines(summary, summary_obj, column.key, line)

        summary.low_carbon_fuel_target_summary.sort(key=lambda row: row.line)

        self._apply_exemption_overrides(summary, compliance_report)

        return summary

    def _extract_line_number(self, column_key: str) -> Optional[int]:
        match = re.search(r"line_(\d+)_", column_key)
        return int(match.group(1)) if match else None

    def _handle_renewable_line(
        self, summary, summary_obj, column_key, line: int
    ) -> None:
        existing_element = self._get_or_create_summary_row(
            summary.renewable_fuel_target_summary,
            line,
            default_format=FORMATS.NUMBER if line != 11 else FORMATS.CURRENCY,
            default_descriptions=RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
            summary_obj=summary_obj,
            special_description_func=(
                self._line_4_special_description if line == 4
                else (self._renewable_special_description if line in [6, 8] else None)
            ),
        )

        if line == 11:
            value = float(getattr(summary_obj, column_key) or 0.0)
        else:
            value = int(getattr(summary_obj, column_key) or 0)

        self._assign_fuel_value(existing_element, column_key, value)

    def _handle_low_carbon_line(
        self, summary, summary_obj, column_key, line: int
    ) -> None:
        description = self._format_description(
            line=line,
            descriptions_dict=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
        )
        if line == 21:
            desc = self._non_compliance_special_description(
                line, summary_obj, LOW_CARBON_FUEL_TARGET_DESCRIPTIONS
            )
        elif line == 22:
            compliance_year = (
                int(summary_obj.compliance_report.compliance_period.description)
                if summary_obj.compliance_report
                and summary_obj.compliance_report.compliance_period
                else 2024
            )
            desc = description.replace(
                "{{COMPLIANCE_YEAR_PLUS_1}}", str(compliance_year + 1)
            )
        else:
            desc = description

        summary.low_carbon_fuel_target_summary.append(
            ComplianceReportSummaryRowSchema(
                line=line,
                format=(
                    FORMATS.CURRENCY.value
                    if line == 21
                    else FORMATS.NUMBER.value
                ),
                description=desc,
                field=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line]["field"],
                value=int(getattr(summary_obj, column_key) or 0),
                units="",
                bold=False,
            )
        )

    def _handle_summary_lines(
        self, summary, summary_obj, column_key, line: int
    ) -> None:
        existing_element = self._get_or_create_summary_row(
            summary.non_compliance_penalty_summary,
            line,
            default_format=FORMATS.CURRENCY,
            default_descriptions=NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
            summary_obj=summary_obj,
            special_description_func=(
                self._non_compliance_special_description if line == 21 else None
            ),
        )

        value = float(getattr(summary_obj, column_key) or 0)
        existing_element.total_value += value

    def _get_or_create_summary_row(
        self,
        target_list: list,
        line,
        default_format,
        default_descriptions: dict,
        summary_obj,
        special_description_func=None,
    ) -> ComplianceReportSummaryRowSchema:
        existing_element = next(
            (el for el in target_list if el.line == line),
            None,
        )
        if existing_element:
            return existing_element

        if special_description_func:
            description = special_description_func(
                line, summary_obj, default_descriptions
            )
        else:
            description = self._format_description(line, default_descriptions)

        new_element = ComplianceReportSummaryRowSchema(
            line=line,
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
        if column_key.endswith("_gasoline"):
            element.gasoline = value
        elif column_key.endswith("_diesel"):
            element.diesel = value
        elif column_key.endswith("_jet_fuel"):
            element.jet_fuel = value

    def _format_description(self, line, descriptions_dict):
        return descriptions_dict[line].get("description")

    def _line_4_special_description(self, line, summary_obj, descriptions_dict):
        base_desc = descriptions_dict[line].get("description")
        compliance_period = (
            int(summary_obj.compliance_report.compliance_period.description)
            if summary_obj.compliance_report
            and summary_obj.compliance_report.compliance_period
            else 2024
        )
        diesel_percent_display = "8%" if compliance_period >= 2025 else "4%"
        return base_desc.format(diesel_percent=diesel_percent_display)

    def _renewable_special_description(self, line, summary_obj, descriptions_dict):
        base_desc = descriptions_dict[line].get("description")
        gasoline_cap = int(
            (
                Decimal(
                    str(summary_obj.line_4_eligible_renewable_fuel_required_gasoline or 0)
                )
                * Decimal("0.05")
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
        diesel_cap = int(
            (
                Decimal(
                    str(summary_obj.line_4_eligible_renewable_fuel_required_diesel or 0)
                )
                * Decimal("0.05")
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
        jet_fuel_cap = int(
            (
                Decimal(
                    str(summary_obj.line_4_eligible_renewable_fuel_required_jet_fuel or 0)
                )
                * Decimal("0.05")
            ).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
        return base_desc.format(
            "{:,}".format(gasoline_cap),
            "{:,}".format(diesel_cap),
            "{:,}".format(jet_fuel_cap),
        )

    def _non_compliance_special_description(
        self, line, summary_obj, descriptions_dict
    ):
        base_desc = descriptions_dict[line].get("description")
        penalty_value = (
            getattr(summary_obj, "line_21_non_compliance_penalty_payable", 0) or 0
        )

        compliance_year = (
            int(summary_obj.compliance_report.compliance_period.description)
            if summary_obj.compliance_report
            and summary_obj.compliance_report.compliance_period
            else 2024
        )
        penalty_rate = get_low_carbon_penalty_rate(compliance_year)

        return base_desc.format(
            units="{:,}".format(int(penalty_value / penalty_rate)),
            rate=penalty_rate,
        )

    def _apply_exemption_overrides(
        self,
        summary: ComplianceReportSummarySchema,
        compliance_report: Optional[ComplianceReport],
    ) -> None:
        """
        Zero out penalty-related summary rows when exemption flags are set on
        the compliance report. Mirrors `handle_exempted_status` and also
        applies in pre-Exempted statuses so penalties don't leak into
        summaries, descriptions, or exports.
        """
        if not compliance_report:
            return

        is_renewable_exempted = (
            getattr(compliance_report, "is_renewable_fuel_exempted", False) is True
        )
        is_low_carbon_exempted = (
            getattr(compliance_report, "is_low_carbon_fuel_exempted", False) is True
        )
        if not (is_renewable_exempted or is_low_carbon_exempted):
            return

        def _line_num(row) -> Optional[int]:
            try:
                return int(row.line) if row.line is not None else None
            except (TypeError, ValueError):
                return None

        if is_renewable_exempted:
            for row in summary.renewable_fuel_target_summary or []:
                if _line_num(row) in (4, 11):
                    row.gasoline = 0
                    row.diesel = 0
                    row.jet_fuel = 0
                    row.total_value = 0

        if is_low_carbon_exempted:
            low_carbon_rows = summary.low_carbon_fuel_target_summary or []
            line_17_value = 0
            for row in low_carbon_rows:
                if _line_num(row) == 17:
                    line_17_value = row.value or 0
                    break
            for row in low_carbon_rows:
                line_num = _line_num(row)
                if line_num in (18, 20, 21):
                    row.value = 0
                if line_num == 21:
                    row.description = LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[21][
                        "description"
                    ].split(" (")[0]
                if line_num == 22:
                    row.value = max(line_17_value, 0)

        line_11_total = 0.0
        line_21_total = 0.0
        for row in summary.non_compliance_penalty_summary or []:
            line_num = _line_num(row)
            if line_num == 11:
                if is_renewable_exempted:
                    row.total_value = 0
                line_11_total = row.total_value or 0
            elif line_num == 21:
                if is_low_carbon_exempted:
                    row.total_value = 0
                line_21_total = row.total_value or 0
        for row in summary.non_compliance_penalty_summary or []:
            if row.line is None:
                row.total_value = float(line_11_total) + float(line_21_total)

    @service_handler
    async def update_compliance_report_summary(
        self,
        report_id: int,
        summary_data: ComplianceReportSummaryUpdateSchema,
    ) -> ComplianceReportSummarySchema:
        """Autosave compliance report summary details for a specific summary by ID."""
        compliance_report = await self.cr_repo.get_compliance_report_by_id(report_id)
        compliance_year = None
        if compliance_report and compliance_report.compliance_period:
            compliance_year = int(compliance_report.compliance_period.description)

        await self.repo.save_compliance_report_summary(summary_data, compliance_year)

        # Expire the compliance report and its summary so the recalculation
        # below picks up freshly persisted Line 6/8 values rather than the
        # cached versions in SQLAlchemy's identity map.
        sync_session = self.repo.db.sync_session
        if compliance_report.summary:
            sync_session.expire(compliance_report.summary)
        sync_session.expire(compliance_report)

        return await self.calculate_compliance_report_summary(report_id)

    def _is_eligible_renewable(self, record, compliance_year) -> bool:
        return RenewableFuelTargetCalculator.is_eligible_renewable(
            record, compliance_year
        )

    @service_handler
    async def calculate_compliance_report_summary(
        self, report_id: int
    ) -> ComplianceReportSummarySchema:
        """Recalculate transient summary fields and persist when changed."""
        compliance_report = await self.cr_repo.get_compliance_report_by_id(report_id)
        if not compliance_report:
            raise DataNotFoundException("Compliance report not found.")

        prev_compliance_report = (
            await self.cr_repo.get_assessed_compliance_report_by_period(
                compliance_report.organization_id,
                int(compliance_report.compliance_period.description) - 1,
            )
        )

        previous_year_required = {
            "gasoline": 0,
            "diesel": 0,
            "jet_fuel": 0,
        }
        if prev_compliance_report and prev_compliance_report.summary:
            previous_year_required = {
                "gasoline": prev_compliance_report.summary.line_4_eligible_renewable_fuel_required_gasoline
                or 0,
                "diesel": prev_compliance_report.summary.line_4_eligible_renewable_fuel_required_diesel
                or 0,
                "jet_fuel": prev_compliance_report.summary.line_4_eligible_renewable_fuel_required_jet_fuel
                or 0,
            }

        summary_model = compliance_report.summary
        compliance_data_service.set_nickname(compliance_report.nickname)
        compliance_data_service.set_period(
            int(compliance_report.compliance_period.description)
        )
        # Historical/migrated reports may have a missing summary. Return a
        # minimal empty schema rather than recalculating against nothing.
        if summary_model is None:
            return ComplianceReportSummarySchema(
                summary_id=0,
                compliance_report_id=compliance_report.compliance_report_id,
                is_locked=True,
                quarter=None,
                renewable_fuel_target_summary=[],
                low_carbon_fuel_target_summary=[],
                non_compliance_penalty_summary=[],
                can_sign=False,
                lines_6_and_8_locked=True,
                lines_7_and_9_locked=True,
            )

        # Locked or non-editable reports return the stored summary values to
        # avoid recalculating user-entered lines (e.g., Line 6).
        if summary_model.is_locked or (
            summary_model
            and compliance_report.current_status
            and compliance_report.current_status.status
            not in [
                ComplianceReportStatusEnum.Draft,
                ComplianceReportStatusEnum.Submitted,
                ComplianceReportStatusEnum.Analyst_adjustment,
            ]
        ):
            locked_summary = self.convert_summary_to_dict(
                compliance_report.summary, compliance_report
            )
            locked_summary.lines_7_and_9_locked = (
                locked_summary.lines_7_and_9_locked
                or await self._should_lock_lines_7_and_9(compliance_report)
            )
            locked_summary.lines_6_and_8_locked = True
            return locked_summary

        compliance_period_start = compliance_report.compliance_period.effective_date
        compliance_period_end = compliance_report.compliance_period.expiration_date
        organization_id = compliance_report.organization_id

        compliance_year = int(compliance_report.compliance_period.description)

        if prev_compliance_report and compliance_year >= 2025:
            # 2025+ reports with a prior assessed report: auto-populate &
            # lock Lines 7 and 9 from the previous report's Lines 6/8.
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

            current_line_7_gasoline = (
                summary_model.line_7_previously_retained_gasoline or 0
            )
            current_line_7_diesel = (
                summary_model.line_7_previously_retained_diesel or 0
            )
            current_line_7_jet = (
                summary_model.line_7_previously_retained_jet_fuel or 0
            )

            if current_line_7_gasoline == 0 and previous_retained["gasoline"]:
                current_line_7_gasoline = previous_retained["gasoline"]
            if current_line_7_diesel == 0 and previous_retained["diesel"]:
                current_line_7_diesel = previous_retained["diesel"]
            if current_line_7_jet == 0 and previous_retained["jet_fuel"]:
                current_line_7_jet = previous_retained["jet_fuel"]

            summary_model.line_7_previously_retained_gasoline = current_line_7_gasoline
            summary_model.line_7_previously_retained_diesel = current_line_7_diesel
            summary_model.line_7_previously_retained_jet_fuel = current_line_7_jet

            previous_retained = {
                "gasoline": current_line_7_gasoline,
                "diesel": current_line_7_diesel,
                "jet_fuel": current_line_7_jet,
            }

            current_line_9_gasoline = (
                summary_model.line_9_obligation_added_gasoline or 0
            )
            current_line_9_diesel = (
                summary_model.line_9_obligation_added_diesel or 0
            )
            current_line_9_jet = summary_model.line_9_obligation_added_jet_fuel or 0

            if current_line_9_gasoline == 0 and previous_obligation["gasoline"]:
                current_line_9_gasoline = previous_obligation["gasoline"]
            if current_line_9_diesel == 0 and previous_obligation["diesel"]:
                current_line_9_diesel = previous_obligation["diesel"]
            if current_line_9_jet == 0 and previous_obligation["jet_fuel"]:
                current_line_9_jet = previous_obligation["jet_fuel"]

            summary_model.line_9_obligation_added_gasoline = current_line_9_gasoline
            summary_model.line_9_obligation_added_diesel = current_line_9_diesel
            summary_model.line_9_obligation_added_jet_fuel = current_line_9_jet

            previous_obligation = {
                "gasoline": current_line_9_gasoline,
                "diesel": current_line_9_diesel,
                "jet_fuel": current_line_9_jet,
            }
            # Supplemental versions: seed Lines 6 and 8 from the assessed
            # baseline when they are blank.
            if compliance_report.version > 0:
                if summary_model.line_6_renewable_fuel_retained_gasoline in [None, 0]:
                    summary_model.line_6_renewable_fuel_retained_gasoline = (
                        prev_compliance_report.summary.line_6_renewable_fuel_retained_gasoline
                        or 0
                    )
                if summary_model.line_6_renewable_fuel_retained_diesel in [None, 0]:
                    summary_model.line_6_renewable_fuel_retained_diesel = (
                        prev_compliance_report.summary.line_6_renewable_fuel_retained_diesel
                        or 0
                    )
                if summary_model.line_6_renewable_fuel_retained_jet_fuel in [None, 0]:
                    summary_model.line_6_renewable_fuel_retained_jet_fuel = (
                        prev_compliance_report.summary.line_6_renewable_fuel_retained_jet_fuel
                        or 0
                    )
                if summary_model.line_8_obligation_deferred_gasoline in [None, 0]:
                    summary_model.line_8_obligation_deferred_gasoline = (
                        prev_compliance_report.summary.line_8_obligation_deferred_gasoline
                        or 0
                    )
                if summary_model.line_8_obligation_deferred_diesel in [None, 0]:
                    summary_model.line_8_obligation_deferred_diesel = (
                        prev_compliance_report.summary.line_8_obligation_deferred_diesel
                        or 0
                    )
                if summary_model.line_8_obligation_deferred_jet_fuel in [None, 0]:
                    summary_model.line_8_obligation_deferred_jet_fuel = (
                        prev_compliance_report.summary.line_8_obligation_deferred_jet_fuel
                        or 0
                    )

        elif prev_compliance_report:
            # Pre-2025 reports with a previous report: read previous values
            # without forcing them back into the current summary model.
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
            # No previous assessed report: use current summary values (editable).
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
            normalized_category = transfer.fuel_category.replace(" ", "_").lower()

            total_quantity = transfer.quantity
            if total_quantity is None:
                quarterly_sum = (
                    (transfer.q1_quantity or 0)
                    + (transfer.q2_quantity or 0)
                    + (transfer.q3_quantity or 0)
                    + (transfer.q4_quantity or 0)
                )
                total_quantity = quarterly_sum if quarterly_sum > 0 else 0

            if transfer.received_or_transferred.lower() == "received":
                notional_transfers_sums[normalized_category] += total_quantity
            elif transfer.received_or_transferred.lower() == "transferred":
                notional_transfers_sums[normalized_category] -= total_quantity

        effective_fuel_supplies = (
            await self.fuel_supply_repo.get_effective_fuel_supplies(
                compliance_report.compliance_report_group_uuid,
                compliance_report.compliance_report_id,
                compliance_report.version,
            )
        )

        effective_other_uses = await self.other_uses_repo.get_effective_other_uses(
            compliance_report.compliance_report_group_uuid,
            compliance_report.compliance_report_id,
            return_model=True,
        )

        # Line 1: fossil fuel supplies + other uses.
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

        # Line 2: only renewable volumes that meet the year's eligibility rules.
        filtered_renewable_fuel_supplies = [
            fs
            for fs in effective_fuel_supplies
            if self._is_eligible_renewable(fs, compliance_year)
        ]
        filtered_renewable_other_uses = [
            ou
            for ou in effective_other_uses
            if self._is_eligible_renewable(ou, compliance_year)
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
            previous_year_required=previous_year_required,
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
            non_compliance_penalty_payable_units,
            renewable_fuel_target_summary,
            compliance_period_start.year,
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

        self._apply_exemption_overrides(summary, compliance_report)

        lines_7_and_9_locked = await self._should_lock_lines_7_and_9(compliance_report)
        summary.lines_7_and_9_locked = lines_7_and_9_locked
        existing_summary.lines_7_and_9_locked = lines_7_and_9_locked
        summary.lines_6_and_8_locked = summary_model.is_locked
        existing_summary.lines_6_and_8_locked = summary_model.is_locked

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
        return ComplianceReportSummarySchema(
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

    # ------------------------------------------------------------------
    # Calculation entry points — thin wrappers that delegate to the
    # extracted calculator classes. Kept on the service so existing
    # callers and tests (which may monkey-patch these methods) continue
    # to work unchanged.
    # ------------------------------------------------------------------
    def calculate_renewable_fuel_target_summary(
        self,
        fossil_quantities: dict,
        renewable_quantities: dict,
        previous_retained: dict,
        previous_obligation: dict,
        notional_transfers_sums: dict,
        compliance_period: int,
        prev_summary: ComplianceReportSummary,
        previous_year_required: Optional[dict] = None,
    ) -> List[ComplianceReportSummaryRowSchema]:
        return self._renewable_calculator().calculate(
            fossil_quantities,
            renewable_quantities,
            previous_retained,
            previous_obligation,
            notional_transfers_sums,
            compliance_period,
            prev_summary,
            previous_year_required,
        )

    async def calculate_low_carbon_fuel_target_summary(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
        compliance_report: ComplianceReport,
    ) -> Tuple[List[ComplianceReportSummaryRowSchema], int]:
        # Resolve Lines 18 and 19 via self so that tests which monkey-patch
        # these methods on the service still influence the low-carbon calc.
        line_18 = await self.calculate_fuel_supply_compliance_units(compliance_report)
        line_19 = await self.calculate_fuel_export_compliance_units(compliance_report)
        return await self._low_carbon_calculator().calculate(
            compliance_period_start,
            compliance_period_end,
            organization_id,
            compliance_report,
            line_18,
            line_19,
        )

    def calculate_non_compliance_penalty_summary(
        self,
        non_compliance_penalty_payable_units: int,
        renewable_fuel_target_summary: List[ComplianceReportSummaryRowSchema],
        compliance_year: int,
    ) -> List[ComplianceReportSummaryRowSchema]:
        return self._non_compliance_calculator().calculate(
            non_compliance_penalty_payable_units,
            renewable_fuel_target_summary,
            compliance_year,
        )

    @service_handler
    async def calculate_fuel_supply_compliance_units(
        self, report: ComplianceReport
    ) -> int:
        return await self._compliance_units_calculator().calculate_fuel_supply(report)

    @service_handler
    async def calculate_quarterly_fuel_supply_compliance_units(
        self, report: ComplianceReport
    ) -> list[int]:
        return await self._compliance_units_calculator().calculate_quarterly_fuel_supply(
            report
        )

    @service_handler
    async def calculate_fuel_export_compliance_units(
        self, report: ComplianceReport
    ) -> int:
        return await self._compliance_units_calculator().calculate_fuel_export(report)
