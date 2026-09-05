from collections import defaultdict
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
from time import perf_counter
from typing import Iterable

from fastapi import Depends
import structlog

from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.compliance.ComplianceReport import (
    QuantityUnitsEnum,
    SupplementalInitiatorType,
)
from lcfs.db.models.compliance.ComplianceReportStatus import ComplianceReportStatusEnum
from lcfs.db.models.fuel.FuelCodeStatus import FuelCodeStatusEnum
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportReviewChartDataSchema,
    ComplianceReportReviewComplianceUnitPointSchema,
    ComplianceReportReviewComparisonPointSchema,
    ComplianceReportReviewComparisonSeriesSchema,
    ComplianceReportReviewFindingSchema,
    ComplianceReportReviewMetricSchema,
    ComplianceReportReviewPolicySchema,
    ComplianceReportReviewSectionSchema,
    ComplianceReportReviewSummarySchema,
)
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.final_supply_equipment.repo import FinalSupplyEquipmentRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException


MATERIAL_PERCENT_THRESHOLD = 25
MATERIAL_VOLUME_THRESHOLD = 100_000

logger = structlog.get_logger(__name__)


class ComplianceReportReviewService:
    def __init__(
        self,
        repo: ComplianceReportRepository = Depends(),
        summary_service: ComplianceReportSummaryService = Depends(),
        fse_repo: FinalSupplyEquipmentRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.summary_service = summary_service
        self.fse_repo = fse_repo

    @service_handler
    async def get_review_summary(
        self, compliance_report_id: int
    ) -> ComplianceReportReviewSummarySchema:
        total_started_at = perf_counter()
        report = await self._timed(
            "get_compliance_report_by_id",
            self.repo.get_compliance_report_by_id(compliance_report_id),
            compliance_report_id=compliance_report_id,
        )
        if not report:
            raise DataNotFoundException("Compliance report not found")

        current_summary = await self._timed(
            "calculate_current_summary",
            self.summary_service.calculate_compliance_report_summary(
                compliance_report_id
            ),
            compliance_report_id=compliance_report_id,
        )
        schedule_records = await self._timed(
            "get_current_schedule_records",
            self._get_schedule_records(compliance_report_id),
            compliance_report_id=compliance_report_id,
        )

        compliance_year = self._to_int(report.compliance_period.description)
        prior_year_report = None
        prior_year_snapshots = []
        prior_fse_snapshots = []
        prior_reports = []
        if compliance_year:
            prior_reports = await self._timed(
                "get_previous_assessed_compliance_reports",
                self.repo.get_previous_assessed_compliance_reports(
                    report.organization_id,
                    compliance_year,
                ),
                compliance_report_id=compliance_report_id,
                organization_id=report.organization_id,
                compliance_year=compliance_year,
            )
            prior_year_report = prior_reports[0] if prior_reports else None

        comparison_report_ids = [
            compliance_report_id,
            *(prior_report.compliance_report_id for prior_report in prior_reports),
        ]
        analytics_totals_by_report = await self._timed(
            "get_comparison_schedule_analytics_totals",
            self.repo.get_review_schedule_analytics_totals_for_reports(
                comparison_report_ids
            ),
            compliance_report_id=compliance_report_id,
            comparison_report_count=len(comparison_report_ids),
        )
        current_chart_totals = analytics_totals_by_report.get(compliance_report_id, {})
        current_chart_totals = self._with_fallback_schedule_totals(
            current_chart_totals, schedule_records
        )

        fuel_code_totals_by_report = await self._timed(
            "get_fuel_supply_fuel_code_totals",
            self.repo.get_review_fuel_supply_fuel_code_totals_for_reports(
                comparison_report_ids
            ),
            compliance_report_id=compliance_report_id,
            comparison_report_count=len(comparison_report_ids),
        )
        current_fuel_code_totals = fuel_code_totals_by_report.get(
            compliance_report_id, {}
        )

        if prior_reports:
            for prior_report in prior_reports:
                prior_year_snapshots.append(
                    (
                        prior_report,
                        analytics_totals_by_report.get(
                            prior_report.compliance_report_id, {}
                        ),
                    )
                )

        fse_summary = await self._timed(
            "get_current_fse_summary",
            self._get_fse_summary(report, compliance_year),
            compliance_report_id=compliance_report_id,
        )
        prior_fse_summary = None
        if prior_reports:
            for prior_report in prior_reports:
                prior_compliance_year = self._to_int(
                    prior_report.compliance_period.description
                )
                prior_summary = await self._timed(
                    "get_prior_fse_summary",
                    self._get_fse_summary(prior_report, prior_compliance_year),
                    compliance_report_id=prior_report.compliance_report_id,
                )
                prior_fse_snapshots.append((prior_report, prior_summary))

        if prior_fse_snapshots:
            prior_fse_summary = prior_fse_snapshots[0][1]
        elif prior_year_report:
            prior_compliance_year = self._to_int(
                prior_year_report.compliance_period.description
            )
            prior_fse_summary = await self._timed(
                "get_prior_fse_summary",
                self._get_fse_summary(prior_year_report, prior_compliance_year),
                compliance_report_id=prior_year_report.compliance_report_id,
            )

        compliance_units_by_fuel = await self._timed(
            "get_compliance_units_by_fuel",
            self.repo.get_review_compliance_units_by_fuel(compliance_report_id),
            compliance_report_id=compliance_report_id,
        )

        previous_version_report_id = await self._timed(
            "get_previous_version_report_id",
            self._get_previous_version_report_id(report),
            compliance_report_id=compliance_report_id,
        )
        previous_version_summary = None
        previous_version_records = None
        if previous_version_report_id:
            previous_version_summary = await self._timed(
                "calculate_previous_version_summary",
                self.summary_service.calculate_compliance_report_summary(
                    previous_version_report_id
                ),
                compliance_report_id=previous_version_report_id,
                current_report_id=compliance_report_id,
            )
            previous_version_records = await self._timed(
                "get_previous_version_schedule_records",
                self._get_schedule_records(previous_version_report_id),
                compliance_report_id=previous_version_report_id,
                current_report_id=compliance_report_id,
            )

        chart_data = self._build_chart_data(
            schedule_records,
            current_chart_totals,
            prior_year_snapshots,
            previous_version_records,
            current_summary,
            previous_version_summary,
            compliance_units_by_fuel,
            current_fuel_code_totals,
            fuel_code_totals_by_report,
            fse_summary,
            prior_fse_snapshots,
            current_label=str(report.compliance_period.description),
            previous_version_label=(
                f"Version {report.version - 1}" if previous_version_summary else ""
            ),
            current_version_label=f"Version {report.version}",
        )

        findings = []
        findings.extend(self._administrative_findings(report, compliance_year))
        findings.extend(self._schedule_findings(schedule_records))
        findings.extend(self._notional_transfer_findings(schedule_records))
        findings.extend(self._fuel_supply_fse_cross_check_findings(schedule_records, fse_summary))
        findings.extend(
            self._fuel_code_findings(schedule_records, compliance_year=compliance_year)
        )
        findings.extend(
            self._fse_findings(fse_summary, prior_fse_summary, compliance_year)
        )
        findings.extend(self._allocation_findings(schedule_records))
        findings.extend(self._summary_findings(current_summary))

        if prior_year_snapshots:
            findings.extend(
                self._historical_variance_findings(
                    current_chart_totals, prior_year_snapshots[0][1]
                )
            )
            findings.extend(
                self._zero_value_narrative_findings(
                    current_chart_totals,
                    prior_year_snapshots[0][1],
                )
            )
            findings.extend(
                self._large_supply_drop_findings(
                    report,
                    current_chart_totals,
                    prior_year_snapshots[0][1],
                )
            )
            findings.extend(
                self._other_uses_variance_findings(
                    schedule_records,
                    current_chart_totals,
                    prior_year_snapshots[0][1],
                )
            )
            findings.extend(
                self._fuel_mix_shift_findings(
                    current_chart_totals,
                    prior_year_snapshots[0][1],
                )
            )
            findings.extend(
                self._correlation_findings(
                    current_chart_totals,
                    prior_year_snapshots[0][1],
                    fse_summary,
                    prior_fse_summary,
                )
            )
            findings.extend(
                self._historical_presence_gap_findings(
                    current_chart_totals,
                    prior_year_snapshots,
                )
            )

        if previous_version_summary:
            findings.extend(
                self._supplemental_summary_findings(
                    current_summary, previous_version_summary
                )
            )

        sections = self._group_sections(findings)
        follow_ups = self._top_follow_up_questions(findings)
        summary = self._build_summary(findings, prior_year_report is not None)

        response = ComplianceReportReviewSummarySchema(
            compliance_report_id=compliance_report_id,
            generated_at=datetime.now(timezone.utc),
            summary=summary,
            sections=sections,
            top_follow_up_questions=follow_ups,
            chart_data=chart_data,
            ai_usage_policy=ComplianceReportReviewPolicySchema(
                should=[
                    "summarize deterministic findings",
                    "compare supplied evidence",
                    "flag anomalies and variances",
                    "prioritize risky areas",
                    "draft analyst follow-up questions",
                ],
                should_not=[
                    "determine compliance",
                    "interpret legislation conclusively",
                    "approve or reject reports",
                    "calculate authoritative values",
                    "make enforcement decisions",
                ],
            ),
            llm_context={
                "instruction": (
                    "Use only the deterministic findings and source facts in this "
                    "payload. Do not calculate authoritative compliance values or "
                    "make approval, rejection, assessment, penalty, or enforcement "
                    "recommendations."
                ),
                "materiality_thresholds": {
                    "percent_change": MATERIAL_PERCENT_THRESHOLD,
                    "absolute_volume": MATERIAL_VOLUME_THRESHOLD,
                },
                "finding_count": len(findings),
                "review_areas": sorted({finding.review_area for finding in findings}),
            },
        )
        self._log_timing(
            "build_review_summary_total",
            total_started_at,
            compliance_report_id=compliance_report_id,
            prior_report_count=len(prior_year_snapshots),
            finding_count=len(findings),
        )
        return response

    async def _timed(self, step: str, awaitable, **context):
        started_at = perf_counter()
        try:
            return await awaitable
        finally:
            self._log_timing(step, started_at, **context)

    def _log_timing(self, step: str, started_at: float, **context) -> None:
        duration_ms = round((perf_counter() - started_at) * 1000, 1)
        logger.info(
            "compliance_report_review_timing",
            step=step,
            duration_ms=duration_ms,
            **context,
        )

    async def _get_schedule_records(self, compliance_report_id: int) -> dict[str, list]:
        (
            fuel_supplies,
            fuel_exports,
            allocation_agreements,
            notional_transfers,
            other_uses,
        ) = (
            await self.repo.get_effective_versioned_records(
                compliance_report_id, FuelSupply
            ),
            await self.repo.get_effective_versioned_records(
                compliance_report_id, FuelExport
            ),
            await self.repo.get_effective_versioned_records(
                compliance_report_id, AllocationAgreement
            ),
            await self.repo.get_effective_versioned_records(
                compliance_report_id, NotionalTransfer
            ),
            await self.repo.get_effective_versioned_records(
                compliance_report_id, OtherUses
            ),
        )
        return {
            "fuel_supplies": fuel_supplies,
            "fuel_exports": fuel_exports,
            "allocation_agreements": allocation_agreements,
            "notional_transfers": notional_transfers,
            "other_uses": other_uses,
        }

    async def _get_fse_summary(self, report, compliance_year: int | None) -> dict:
        if not compliance_year:
            return {}
        return await self.fse_repo.get_review_fse_summary_for_report(
            report.organization_id,
            report.compliance_report_id,
            date(compliance_year, 1, 1),
            date(compliance_year, 12, 31),
        )

    async def _get_schedule_analytics_totals(
        self, compliance_report_id: int, fallback_records: dict[str, list]
    ) -> dict[str, dict[str, float]]:
        totals = await self.repo.get_review_schedule_analytics_totals(
            compliance_report_id
        )
        return self._with_fallback_schedule_totals(totals, fallback_records)

    def _with_fallback_schedule_totals(
        self, totals: dict[str, dict[str, float]], fallback_records: dict[str, list]
    ) -> dict[str, dict[str, float]]:
        fallback_totals = self._schedule_totals_from_records(fallback_records)

        for key, fallback in fallback_totals.items():
            if not totals.get(key):
                totals[key] = fallback

        return totals

    async def _get_previous_version_report_id(self, report) -> int | None:
        if not report.compliance_report_group_uuid or report.version == 0:
            return None

        chain = await self.repo.get_compliance_report_chain(
            report.compliance_report_group_uuid
        )
        previous = next(
            (
                chain_report
                for chain_report in chain
                if chain_report.version == report.version - 1
            ),
            None,
        )
        return previous.compliance_report_id if previous else None

    def _administrative_findings(
        self, report, compliance_year: int | None
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        findings.extend(self._submission_timing_findings(report, compliance_year))

        if report.version > 0:
            findings.append(
                self._finding(
                    "Supplemental impacts",
                    "review",
                    "Supplemental report requires change review",
                    "This report is a supplemental version. Prior assessed or previous-version values should be compared before recommendation or assessment.",
                    "Compliance report metadata",
                    [
                        self._metric("Version", report.version),
                        self._metric(
                            "Supplemental initiator",
                            self._enum_value(report.supplemental_initiator),
                        ),
                    ],
                    "What changed from the previous version, and is the explanation supportable?",
                )
            )

        if not report.assigned_analyst_id:
            findings.append(
                self._finding(
                    "Administrative completeness",
                    "informational",
                    "No analyst assigned",
                    "The report does not currently have an assigned analyst recorded.",
                    "Compliance report metadata",
                    [self._metric("Assigned analyst", "Unassigned")],
                    None,
                )
            )

        return findings

    def _submission_timing_findings(
        self, report, compliance_year: int | None
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        submitted_date = self._history_status_date(
            report, ComplianceReportStatusEnum.Submitted
        )

        if report.version == 0:
            if not compliance_year:
                return findings

            due_date = date(compliance_year + 1, 3, 31)
            if not submitted_date:
                findings.append(
                    self._finding(
                        "Administrative completeness",
                        "review",
                        "Original report submission date unavailable",
                        "The deterministic pre-screen could not identify the submitted date needed to confirm the March 31 deadline.",
                        "Compliance report history",
                        [self._metric("Due date", due_date.isoformat())],
                        "Was the original report submitted by the statutory March 31 deadline?",
                    )
                )
                return findings

            submitted_on = self._date_value(submitted_date)
            is_late = submitted_on > due_date
            findings.append(
                self._finding(
                    "Administrative completeness",
                    "concern" if is_late else "informational",
                    (
                        "Original report submitted after March 31 deadline"
                        if is_late
                        else "Original report submitted by March 31 deadline"
                    ),
                    (
                        f"The original {compliance_year} report was submitted on {submitted_on.isoformat()}, after the {due_date.isoformat()} deadline."
                        if is_late
                        else f"The original {compliance_year} report was submitted on {submitted_on.isoformat()}, on or before the {due_date.isoformat()} deadline."
                    ),
                    "Compliance report history",
                    [
                        self._metric("Submitted date", submitted_on.isoformat()),
                        self._metric("Due date", due_date.isoformat()),
                    ],
                    (
                        "Is there documented rationale for the late submission?"
                        if is_late
                        else None
                    ),
                )
            )
            return findings

        if (
            report.supplemental_initiator
            == SupplementalInitiatorType.GOVERNMENT_INITIATED
        ):
            request_date = self._date_value(report.create_date)
            due_date = request_date + timedelta(days=30)
            if not submitted_date:
                findings.append(
                    self._finding(
                        "Administrative completeness",
                        "review",
                        "Supplemental submission date unavailable",
                        "The supplemental report was government initiated, but the submitted date was not found in report history.",
                        "Compliance report history",
                        [
                            self._metric(
                                "Supplemental requested date",
                                request_date.isoformat(),
                            ),
                            self._metric("30-day due date", due_date.isoformat()),
                        ],
                        "Was the supplemental report submitted within 30 days of the request?",
                    )
                )
                return findings

            submitted_on = self._date_value(submitted_date)
            is_late = submitted_on > due_date
            findings.append(
                self._finding(
                    "Administrative completeness",
                    "concern" if is_late else "informational",
                    (
                        "Supplemental report submitted after 30-day request window"
                        if is_late
                        else "Supplemental report submitted within 30-day request window"
                    ),
                    (
                        f"The government-initiated supplemental was requested on {request_date.isoformat()} and submitted on {submitted_on.isoformat()}, after the {due_date.isoformat()} due date."
                        if is_late
                        else f"The government-initiated supplemental was requested on {request_date.isoformat()} and submitted on {submitted_on.isoformat()}, within the 30-day window ending {due_date.isoformat()}."
                    ),
                    "Compliance report history",
                    [
                        self._metric(
                            "Supplemental requested date",
                            request_date.isoformat(),
                        ),
                        self._metric("Submitted date", submitted_on.isoformat()),
                        self._metric("30-day due date", due_date.isoformat()),
                    ],
                    (
                        "Is there documented rationale for submitting the supplemental after the 30-day request window?"
                        if is_late
                        else None
                    ),
                )
            )

        return findings

    def _schedule_findings(
        self, records: dict[str, list]
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []

        if not records["fuel_supplies"]:
            findings.append(
                self._finding(
                    "Administrative completeness",
                    "concern",
                    "No fuel supply records found",
                    "The report has no active fuel supply records in the effective versioned schedule.",
                    "Fuel supply",
                    [self._metric("Active records", 0)],
                    "Is fuel supply intentionally absent, and is that supported by the report context?",
                )
            )
        else:
            findings.append(
                self._finding(
                    "Administrative completeness",
                    "informational",
                    "Fuel supply records present",
                    "The effective report data includes active fuel supply records.",
                    "Fuel supply",
                    [self._metric("Active records", len(records["fuel_supplies"]))],
                    None,
                )
            )

        if not records["notional_transfers"]:
            findings.append(
                self._finding(
                    "Notional transfers and exports",
                    "informational",
                    "Confirmed no notional transfers reported",
                    "The effective report data does not include active notional transfers for this reporting period.",
                    "Notional transfers",
                    [
                        self._metric("Notional transfers", 0),
                    ],
                    None,
                )
            )
        if not records["fuel_exports"]:
            findings.append(
                self._finding(
                    "Notional transfers and exports",
                    "informational",
                    "Confirmed no exports out of BC reported",
                    "The effective report data does not include active fuel exports for this reporting period.",
                    "Fuel exports",
                    [self._metric("Fuel exports", 0)],
                    None,
                )
            )

        for key, area, title in [
            (
                "allocation_agreements",
                "Allocations and transfers",
                "Allocation agreements require reconciliation",
            ),
            (
                "notional_transfers",
                "Notional transfers and exports",
                "Notional transfers require counterparty review",
            ),
            ("fuel_exports", "Notional transfers and exports", "Fuel exports reported"),
            ("other_uses", "Out-of-province consumption", "Other uses reported"),
        ]:
            if records[key]:
                detail = {
                    "allocation_agreements": "Allocation agreements are reported in the effective data and should reconcile to fuel supply quantities and counterparty information.",
                    "notional_transfers": "Notional transfers are reported in the effective data and should be reviewed against counterparty evidence and compliance-period support.",
                    "fuel_exports": "Fuel exports are reported in the effective data and should reconcile to export quantities, timing, and supporting documentation.",
                    "other_uses": "Other uses are reported in the effective data and should be assessed against business activity, expected use, and any supporting rationale.",
                }[key]
                findings.append(
                    self._finding(
                        area,
                        "review",
                        title,
                        detail,
                        self._source_label(key),
                        [self._metric("Active records", len(records[key]))],
                        "Do the reported volumes reconcile to related schedules, counterparties, and supporting rationale?",
                    )
                )

        return findings

    def _notional_transfer_findings(
        self, records: dict[str, list]
    ) -> list[ComplianceReportReviewFindingSchema]:
        rows = records["notional_transfers"]
        if not rows:
            return []

        transferred_quantity = sum(
            self._number(getattr(row, "quantity", 0))
            for row in rows
            if getattr(getattr(row, "received_or_transferred", None), "value", None)
            == "Transferred"
        )
        received_quantity = sum(
            self._number(getattr(row, "quantity", 0))
            for row in rows
            if getattr(getattr(row, "received_or_transferred", None), "value", None)
            == "Received"
        )
        return [
            self._finding(
                "Notional transfers and exports",
                "review",
                "Notional transfer evidence needs timing review",
                "Notional transfers were reported. The schedule amounts can be summarized deterministically, but agreement timing and evidentiary validity still need manual review against supporting documents.",
                "Notional transfers",
                [
                    self._metric("Transferred quantity", transferred_quantity, units="reported units"),
                    self._metric("Received quantity", received_quantity, units="reported units"),
                    self._metric("Active transfer records", len(rows)),
                ],
                "Do the supporting notional transfer documents align to the correct compliance period and pre-deadline evidence requirements?",
                confidence="medium",
            )
        ]

    def _fuel_code_findings(
        self, records: dict[str, list], compliance_year: int | None
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        rows = [
            *records["fuel_supplies"],
            *records["fuel_exports"],
            *records["allocation_agreements"],
            *records["other_uses"],
        ]

        missing = [row for row in rows if getattr(row, "fuel_code_id", None) is None]
        if missing:
            findings.append(
                self._finding(
                    "Fuel code validation",
                    "review",
                    "Records without fuel codes",
                    "One or more fuel-related records do not reference a fuel code. Some fuels may not require one, but this should be reviewed.",
                    "Fuel-code fields",
                    [self._metric("Records without fuel code", len(missing))],
                    "Are the missing fuel codes expected for these fuel types and provisions?",
                )
            )

        questionable = []
        for row in rows:
            fuel_code = getattr(row, "fuel_code", None)
            if not fuel_code:
                continue
            status = getattr(
                getattr(fuel_code, "fuel_code_status", None), "status", None
            )
            if status != FuelCodeStatusEnum.Approved:
                questionable.append(row)
                continue
            if compliance_year and not self._fuel_code_valid_for_year(
                fuel_code, compliance_year
            ):
                questionable.append(row)

        if questionable:
            findings.append(
                self._finding(
                    "Fuel code validation",
                    "concern",
                    "Fuel-code status or effective dates need review",
                    "One or more referenced fuel codes are not approved or do not appear active for the compliance year.",
                    "Fuel-code reference data",
                    [self._metric("Questionable fuel-code records", len(questionable))],
                    "Which fuel codes are inactive, unapproved, expired, or not yet effective for this compliance period?",
                )
            )
        elif rows and not missing:
            findings.append(
                self._finding(
                    "Fuel code validation",
                    "informational",
                    "Referenced fuel codes appear active",
                    "All referenced fuel codes found by the deterministic pre-screen are approved and active for the compliance year.",
                    "Fuel-code reference data",
                    [self._metric("Referenced fuel-code records", len(rows))],
                    None,
                )
            )

        return findings

    def _fuel_supply_fse_cross_check_findings(
        self,
        records: dict[str, list],
        fse_summary: dict | None,
    ) -> list[ComplianceReportReviewFindingSchema]:
        fuel_supply_kwh = self._fuel_supply_total_kwh(records["fuel_supplies"])
        fse_total_kwh = self._number((fse_summary or {}).get("total_kwh", 0))

        if fuel_supply_kwh <= 0 or fse_total_kwh <= 0:
            return []

        if fuel_supply_kwh == fse_total_kwh:
            return []

        delta = fuel_supply_kwh - fse_total_kwh
        percent_change = self._percent_change(fuel_supply_kwh, fse_total_kwh)
        severity = (
            "concern"
            if abs(delta) >= 1000
            or (percent_change is not None and abs(percent_change) >= 1)
            else "review"
        )
        return [
            self._finding(
                "Fuel supply and FSE cross-check",
                severity,
                "Fuel supply and FSE kWh do not align",
                "The total kWh reported in fuel supply does not match the total kWh reported in the FSE schedule.",
                "Fuel supply and FSE reporting views",
                [
                    self._metric(
                        "Fuel supply total kWh",
                        round(fuel_supply_kwh, 2),
                        comparison_value=round(fse_total_kwh, 2),
                        delta=round(delta, 2),
                        percent_change=percent_change,
                        units="kWh",
                    )
                ],
                "Do the electricity totals align between the fuel supply and FSE sections, and if not, what explains the mismatch?",
            )
        ]

    def _fse_findings(
        self,
        fse_summary: dict | None,
        prior_fse_summary: dict | None,
        compliance_year: int | None,
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        if not fse_summary or not fse_summary.get("equipment_count"):
            return findings

        equipment_count = fse_summary["equipment_count"]
        active_count = fse_summary["active_count"]
        validated_count = fse_summary["validated_count"]
        active_full_year_count = fse_summary["active_full_year_count"]
        level_counts = fse_summary.get("level_counts") or {}
        total_kwh = fse_summary["total_kwh"]
        avg_utilization = fse_summary["avg_capacity_utilization_percent"]

        if active_count == equipment_count and active_full_year_count == equipment_count:
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "informational",
                    "FSE active for the full compliance period",
                    "All reported FSE rows were active and covered the full compliance year.",
                    "FSE reporting view",
                    [
                        self._metric("FSE count", equipment_count),
                        self._metric("Active full-year FSE", active_full_year_count),
                    ],
                    None,
                )
            )
        else:
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "review",
                    "FSE active-period coverage needs review",
                    "One or more FSE rows were inactive or did not cover the full compliance year.",
                    "FSE reporting view",
                    [
                        self._metric("FSE count", equipment_count),
                        self._metric("Active FSE", active_count),
                        self._metric("Active full-year FSE", active_full_year_count),
                    ],
                    "Were inactive or partial-year FSE rows expected, and do the reported kWh values reflect the active period only?",
                )
            )

        if validated_count == equipment_count:
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "informational",
                    "FSE rows are validated",
                    "All reported FSE rows are in validated status.",
                    "FSE reporting view",
                    [self._metric("Validated FSE", validated_count)],
                    None,
                )
            )
        else:
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "review",
                    "FSE validation status needs review",
                    "One or more reported FSE rows are not in validated status.",
                    "FSE reporting view",
                    [
                        self._metric("FSE count", equipment_count),
                        self._metric("Validated FSE", validated_count),
                    ],
                    "Which FSE rows are not validated, and should they be resolved before recommendation or assessment?",
                )
            )

        if level_counts:
            has_level_1 = any("level 1" in level.lower() for level in level_counts)
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "review" if has_level_1 else "informational",
                    (
                        "FSE level mix includes Level 1 equipment"
                        if has_level_1
                        else "FSE level mix identified"
                    ),
                    "Reported FSE include one or more equipment levels. Level 1 or outlet-style equipment may require extra verification that the electricity is transportation use only.",
                    "FSE reporting view",
                    [
                        *[
                            self._metric(f"{level} FSE", count)
                            for level, count in sorted(level_counts.items())
                        ],
                        self._metric("Total FSE", equipment_count),
                    ],
                    (
                        "Does the supporting evidence show the reported FSE electricity is sub-metered or otherwise limited to transportation use, especially for Level 1 or outlet-style equipment?"
                        if has_level_1
                        else None
                    ),
                    confidence="medium",
                )
            )

        if avg_utilization is not None:
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "informational" if avg_utilization < 1 else "review",
                    "FSE capacity utilization pre-screen",
                    (
                        "Average capacity utilization is below 1%; this may be reasonable for organizations with historically low utilization, but should be interpreted against prior reporting."
                        if avg_utilization < 1
                        else "Average capacity utilization is above the low-utilization threshold and should be reviewed for reasonableness against equipment capacity and usage evidence."
                    ),
                    "FSE reporting view",
                    [
                        self._metric(
                            "Average capacity utilization",
                            round(avg_utilization, 2),
                            units="%",
                        )
                    ],
                    (
                        None
                        if avg_utilization < 1
                        else "Does the reported kWh usage appear reasonable for the equipment capacity and active period?"
                    ),
                    confidence="medium",
                )
            )

        average_kwh_per_fse = (
            round(total_kwh / equipment_count, 2) if equipment_count else 0
        )
        if average_kwh_per_fse < 1000:
            prior_average_kwh_per_fse = None
            if prior_fse_summary and prior_fse_summary.get("equipment_count"):
                prior_average_kwh_per_fse = round(
                    self._number(prior_fse_summary.get("total_kwh", 0))
                    / self._number(prior_fse_summary.get("equipment_count", 1)),
                    2,
                )
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "review",
                    "Low FSE charge volume needs rationale",
                    "Reported kWh usage per FSE is below the low-volume threshold and should be supported by evidence or an operational explanation.",
                    "FSE reporting view",
                    [
                        self._metric(
                            "Average kWh per FSE",
                            average_kwh_per_fse,
                            comparison_value=prior_average_kwh_per_fse,
                            units="kWh/FSE",
                        ),
                        self._metric("FSE count", equipment_count),
                        self._metric("Total kWh", round(total_kwh, 2), units="kWh"),
                    ],
                    "Is there supporting rationale or evidence for the low charge volume, such as low utilization, neglected sites, or partial-year activity?",
                    confidence="medium",
                )
            )

        if prior_fse_summary and prior_fse_summary.get("equipment_count"):
            prior_kwh = prior_fse_summary.get("total_kwh", 0)
            percent_change = self._percent_change(total_kwh, prior_kwh)
            delta = total_kwh - prior_kwh
            material_change = self._is_material(delta, percent_change)
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "review" if material_change else "informational",
                    (
                        "Electricity supply changed materially year over year"
                        if material_change
                        else "Electricity supply variance appears within threshold"
                    ),
                    (
                        f"Reported FSE kWh usage changed by {round(delta, 2)} kWh compared with the prior assessed report."
                    ),
                    "FSE reporting view",
                    [
                        self._metric(
                            "Total kWh",
                            round(total_kwh, 2),
                            comparison_value=round(prior_kwh, 2),
                            delta=round(delta, 2),
                            percent_change=percent_change,
                            units="kWh",
                        )
                    ],
                    (
                        "What changed in FSE activity, equipment, or evidence to support the kWh usage variance?"
                        if material_change
                        else None
                    ),
                )
            )

            current_regs = set(fse_summary.get("registration_numbers") or [])
            prior_regs = set(prior_fse_summary.get("registration_numbers") or [])
            new_count = len(current_regs - prior_regs)
            findings.append(
                self._finding(
                    "Electricity/FSE",
                    "review" if new_count else "informational",
                    (
                        "New FSE registrations reported"
                        if new_count
                        else f"No new FSE registrations identified for {compliance_year}"
                    ),
                    (
                        f"{new_count} FSE registration(s) appear in the current report but not in the prior assessed report."
                        if new_count
                        else "The current report uses the same FSE registration set as the prior assessed report."
                    ),
                    "FSE reporting view",
                    [
                        self._metric("Current FSE registrations", len(current_regs)),
                        self._metric("New FSE registrations", new_count),
                    ],
                    (
                        "Were the new FSE added, validated, and supported by appropriate ownership and usage evidence?"
                        if new_count
                        else None
                    ),
                )
            )

        return findings

    def _allocation_findings(
        self, records: dict[str, list]
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        missing_phone_rows = [
            row
            for row in records["allocation_agreements"]
            if not (getattr(row, "transaction_partner_phone", None) or "").strip()
        ]
        if missing_phone_rows:
            findings.append(
                self._finding(
                    "Allocations and transfers",
                    "concern",
                    "Allocation agreement contact details incomplete",
                    "One or more allocation agreements do not include a transaction partner phone number in the effective report data.",
                    "Allocation agreements",
                    [
                        self._metric(
                            "Allocation agreements missing phone",
                            len(missing_phone_rows),
                        ),
                        self._metric(
                            "Total allocation agreements",
                            len(records["allocation_agreements"]),
                        ),
                    ],
                    "Do the allocation agreements include the required counterparty contact details, including phone number?",
                )
            )

        supplied_by_fuel = self._sum_by_fuel_category(
            records["fuel_supplies"], "quantity"
        )
        allocated_by_fuel = self._sum_by_fuel_category(
            records["allocation_agreements"], "quantity"
        )

        for fuel_label, allocated in allocated_by_fuel.items():
            supplied = supplied_by_fuel.get(fuel_label, 0)
            if supplied and allocated > supplied:
                findings.append(
                    self._finding(
                        "Allocations and transfers",
                        "concern",
                        "Allocated volume exceeds supplied volume",
                        "Allocation agreement quantity is greater than fuel supply quantity for the same fuel category and fuel type in the effective report data.",
                        "Allocation agreements",
                        [
                            self._metric(
                                fuel_label,
                                allocated,
                                comparison_value=supplied,
                                delta=allocated - supplied,
                                units="reported units",
                            )
                        ],
                        "Why does allocated volume exceed reported supplied volume for this fuel category and fuel type?",
                    )
                )

        return findings

    def _summary_findings(self, summary) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        line_20 = self._summary_row_value(summary.low_carbon_fuel_target_summary, 20)
        line_21 = self._summary_row_value(summary.non_compliance_penalty_summary, 21)
        renewable_penalty = self._summary_row_value(
            summary.renewable_fuel_target_summary, 11
        )

        if line_20 not in (None, 0):
            severity = "concern" if line_20 < 0 else "review"
            findings.append(
                self._finding(
                    "Summary-line reconciliation",
                    severity,
                    "Non-zero low-carbon surplus or deficit",
                    "Summary line 20 has a non-zero value. The analyst should verify that it reflects the underlying schedules and transaction history.",
                    "Summary line 20",
                    [self._metric("Line 20", line_20, units="compliance units")],
                    "Does line 20 reconcile to the underlying schedules and prior assessed values?",
                )
            )

        if line_21 and line_21 > 0:
            findings.append(
                self._finding(
                    "Legislative sensitivity",
                    "concern",
                    "Low-carbon penalty payable is present",
                    "The non-compliance penalty summary includes a payable amount. This is policy-sensitive and requires manual review.",
                    "Summary line 21",
                    [self._metric("Line 21 penalty", line_21, units="CAD")],
                    "Is the payable amount supported by the calculated summary and any approved override?",
                )
            )

        if renewable_penalty and renewable_penalty > 0:
            findings.append(
                self._finding(
                    "Legislative sensitivity",
                    "concern",
                    "Renewable fuel penalty payable is present",
                    "The renewable fuel target summary includes a payable amount. This is policy-sensitive and requires manual review.",
                    "Summary line 11",
                    [self._metric("Line 11 penalty", renewable_penalty, units="CAD")],
                    "Is the renewable fuel penalty supported by the retained/deferred values and supplied volumes?",
                )
            )

        return findings

    def _historical_variance_findings(
        self,
        current_totals: dict[str, dict[str, float]],
        prior_totals: dict[str, dict[str, float]],
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        for key in self._schedule_keys():
            current = current_totals.get(key, {})
            prior = prior_totals.get(key, {})

            for fuel_type in sorted(set(current) | set(prior)):
                current_value = current.get(fuel_type, 0)
                prior_value = prior.get(fuel_type, 0)
                delta = current_value - prior_value
                percent_change = self._percent_change(current_value, prior_value)
                if not self._is_material(delta, percent_change):
                    continue
                findings.append(
                    self._finding(
                        "Historical variance",
                        "review",
                        f"Material year-over-year change in {fuel_type}",
                        (
                            f"{self._source_label(key)} for {fuel_type} changed by "
                            f"{abs(round(percent_change, 1)) if percent_change is not None else round(abs(delta), 2)}"
                            f"{'%' if percent_change is not None else ' reported units'} "
                            f"compared with the prior-year assessed report and should be explained."
                        ),
                        self._source_label(key),
                        [
                            self._metric(
                                fuel_type,
                                current_value,
                                comparison_value=prior_value,
                                delta=delta,
                                percent_change=percent_change,
                                units="reported units",
                            )
                        ],
                        "What operational or reporting change explains this variance?",
                    )
                )

        return findings

    def _supplemental_summary_findings(
        self, current_summary, previous_summary
    ) -> list[ComplianceReportReviewFindingSchema]:
        current_line_20 = self._summary_row_value(
            current_summary.low_carbon_fuel_target_summary, 20
        )
        previous_line_20 = self._summary_row_value(
            previous_summary.low_carbon_fuel_target_summary, 20
        )
        if current_line_20 == previous_line_20:
            return []

        delta = self._magnitude_gap(current_line_20 or 0, previous_line_20 or 0)
        percent_change = self._percent_change(
            abs(current_line_20 or 0),
            abs(previous_line_20 or 0),
        )
        return [
            self._finding(
                "Supplemental impacts",
                "review",
                "Supplemental changed line 20 outcome",
                "The current version changes the low-carbon surplus/deficit outcome compared with the previous version.",
                "Summary line 20",
                [
                    self._metric(
                        "Line 20",
                        current_line_20,
                        comparison_value=previous_line_20,
                        delta=delta,
                        percent_change=percent_change,
                        units="compliance units",
                    )
                ],
                "Which schedule changes caused the line 20 movement, and is the supplemental rationale supportable?",
            )
        ]

    def _correlation_findings(
        self,
        current_totals: dict[str, dict[str, float]],
        prior_totals: dict[str, dict[str, float]],
        current_fse_summary: dict | None,
        prior_fse_summary: dict | None,
    ) -> list[ComplianceReportReviewFindingSchema]:
        if not current_fse_summary or not prior_fse_summary:
            return []

        current_fse_count = self._number(current_fse_summary.get("equipment_count", 0))
        prior_fse_count = self._number(prior_fse_summary.get("equipment_count", 0))
        if current_fse_count <= 0 or prior_fse_count <= 0:
            return []

        current_supply = sum(current_totals.get("fuel_supplies", {}).values())
        prior_supply = sum(prior_totals.get("fuel_supplies", {}).values())
        supply_delta = current_supply - prior_supply
        supply_percent = self._percent_change(current_supply, prior_supply)
        if not self._is_material(supply_delta, supply_percent):
            return []

        fse_count_delta = current_fse_count - prior_fse_count
        fse_count_percent = self._percent_change(current_fse_count, prior_fse_count)

        current_kwh = self._number(current_fse_summary.get("total_kwh", 0))
        prior_kwh = self._number(prior_fse_summary.get("total_kwh", 0))
        kwh_delta = current_kwh - prior_kwh
        kwh_percent = self._percent_change(current_kwh, prior_kwh)

        same_direction = (
            supply_delta != 0
            and fse_count_delta != 0
            and (supply_delta > 0) == (fse_count_delta > 0)
        )

        if same_direction:
            severity = "informational"
            title = "Fuel supply variance aligns with FSE trend"
            detail = (
                "Fuel supply and FSE counts moved in the same direction compared "
                "with the prior-year assessed report, which is more consistent "
                "with a broader operational trend than an isolated reporting issue."
            )
            follow_up = (
                "Does the reported growth or contraction have supporting business "
                "context, and do the related FSE details remain internally coherent?"
            )
        else:
            severity = "review"
            title = "Fuel supply variance does not align with FSE trend"
            detail = (
                "Fuel supply changed materially, but the FSE trend did not move in "
                "parallel. This may still be valid, but it needs analyst review."
            )
            follow_up = (
                "What explains the supply movement, and is there supporting context "
                "for the weaker or opposite FSE trend?"
            )

        return [
            self._finding(
                "Correlative variance analysis",
                severity,
                title,
                detail,
                "Fuel supply and FSE reporting views",
                [
                    self._metric(
                        "Total fuel supply",
                        current_supply,
                        comparison_value=prior_supply,
                        delta=supply_delta,
                        percent_change=supply_percent,
                        units="reported units",
                    ),
                    self._metric(
                        "FSE count",
                        current_fse_count,
                        comparison_value=prior_fse_count,
                        delta=fse_count_delta,
                        percent_change=fse_count_percent,
                        units="count",
                    ),
                    self._metric(
                        "Total FSE kWh usage",
                        current_kwh,
                        comparison_value=prior_kwh,
                        delta=kwh_delta,
                        percent_change=kwh_percent,
                        units="kWh",
                    ),
                ],
                follow_up,
            )
        ]

    def _historical_presence_gap_findings(
        self,
        current_totals: dict[str, dict[str, float]],
        prior_year_snapshots: list[tuple[object, dict[str, dict[str, float]]]],
    ) -> list[ComplianceReportReviewFindingSchema]:
        if len(prior_year_snapshots) < 2:
            return []

        current_supply = current_totals.get("fuel_supplies", {})
        all_labels = set(current_supply)
        for _, snapshot in prior_year_snapshots:
            all_labels.update(snapshot.get("fuel_supplies", {}))

        findings = []
        for label in sorted(all_labels):
            current_value = current_supply.get(label, 0)
            if current_value != 0:
                continue

            positive_streak = []
            for prior_report, snapshot in prior_year_snapshots:
                prior_value = snapshot.get("fuel_supplies", {}).get(label, 0)
                if prior_value > 0:
                    positive_streak.append(
                        (
                            str(prior_report.compliance_period.description),
                            prior_value,
                        )
                    )
                else:
                    break

            if len(positive_streak) < 2:
                continue

            most_recent_year, most_recent_value = positive_streak[0]
            findings.append(
                self._finding(
                    "Historical presence gap",
                    "concern",
                    f"{label} is no longer reported",
                    "This fuel category and type was reported in consecutive prior assessed periods but is absent from the current effective report data.",
                    "Fuel supply",
                    [
                        self._metric(
                            "Current quantity", current_value, units="reported units"
                        ),
                        self._metric(
                            f"Most recent prior quantity ({most_recent_year})",
                            most_recent_value,
                            units="reported units",
                        ),
                        self._metric(
                            "Consecutive prior years with reported volume",
                            len(positive_streak),
                            units="years",
                        ),
                    ],
                    "Was this fuel intentionally not supplied this year, or is a historically reported fuel now missing from the effective data?",
                )
            )

        return findings

    def _other_uses_variance_findings(
        self,
        records: dict[str, list],
        current_totals: dict[str, dict[str, float]],
        prior_totals: dict[str, dict[str, float]],
    ) -> list[ComplianceReportReviewFindingSchema]:
        current_other_uses = current_totals.get("other_uses", {})
        prior_other_uses = prior_totals.get("other_uses", {})
        findings = []

        for fuel_label in sorted(set(current_other_uses) | set(prior_other_uses)):
            current_value = current_other_uses.get(fuel_label, 0)
            prior_value = prior_other_uses.get(fuel_label, 0)
            delta = current_value - prior_value
            percent_change = self._percent_change(current_value, prior_value)
            if percent_change is None or abs(percent_change) < 20 or abs(delta) == 0:
                continue

            matching_rows = [
                row
                for row in records["other_uses"]
                if self._fuel_label(row) == fuel_label
            ]
            rationale_count = sum(
                1 for row in matching_rows if (getattr(row, "rationale", None) or "").strip()
            )
            direction = "increase" if delta > 0 else "decrease"
            detail = (
                f"{fuel_label} for other uses shows a {abs(round(percent_change, 1))}% year-over-year {direction}. "
                + (
                    f"Supplier rationale is captured on {rationale_count} record(s)."
                    if rationale_count
                    else "No supplier rationale is captured in the schedule rows."
                )
            )
            findings.append(
                self._finding(
                    "Out-of-province consumption",
                    "review",
                    f"Other uses variance needs explanation for {fuel_label}",
                    detail,
                    "Other uses",
                    [
                        self._metric(
                            fuel_label,
                            current_value,
                            comparison_value=prior_value,
                            delta=delta,
                            percent_change=percent_change,
                            units="reported units",
                        ),
                        self._metric("Rows with rationale", rationale_count),
                    ],
                    "What operational change explains the movement in other uses, and is that explanation supported by the supplier evidence?",
                    confidence="medium",
                )
            )

        return findings

    def _zero_value_narrative_findings(
        self,
        current_totals: dict[str, dict[str, float]],
        prior_totals: dict[str, dict[str, float]],
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        for key in ("fuel_exports", "notional_transfers", "other_uses"):
            current_total = self._schedule_total(current_totals, key)
            prior_total = self._schedule_total(prior_totals, key)
            if current_total != 0:
                continue

            if prior_total == 0:
                findings.append(
                    self._finding(
                        self._negative_confirmation_area(key),
                        "informational",
                        self._negative_confirmation_title(key, historical=False),
                        self._negative_confirmation_detail(key, historical=False),
                        self._source_label(key),
                        [self._metric(self._source_label(key), 0, units="reported units")],
                        None,
                    )
                )
            else:
                findings.append(
                    self._finding(
                        self._negative_confirmation_area(key),
                        "review",
                        self._negative_confirmation_title(key, historical=True),
                        self._negative_confirmation_detail(key, historical=True),
                        self._source_label(key),
                        [
                            self._metric(
                                self._source_label(key),
                                current_total,
                                comparison_value=prior_total,
                                delta=current_total - prior_total,
                                percent_change=self._percent_change(
                                    current_total, prior_total
                                ),
                                units="reported units",
                            )
                        ],
                        f"What explains the cessation of reported {self._source_label(key).lower()} activity compared with the prior assessed report?",
                        confidence="medium",
                    )
                )

        return findings

    def _large_supply_drop_findings(
        self,
        report,
        current_totals: dict[str, dict[str, float]],
        prior_totals: dict[str, dict[str, float]],
    ) -> list[ComplianceReportReviewFindingSchema]:
        current_supply = self._schedule_total(current_totals, "fuel_supplies")
        prior_supply = self._schedule_total(prior_totals, "fuel_supplies")
        percent_change = self._percent_change(current_supply, prior_supply)
        if percent_change is None or percent_change > -50:
            return []

        rationale = self._report_rationale_reference(
            report,
            [
                "reporting responsibility",
                "supply agreement",
                "sourced from",
                "wholesaler",
                "retailer",
            ],
        )
        detail = (
            f"A significant {abs(round(percent_change, 1))}% year-over-year decrease in total fuel supply was detected. "
            + (
                f"This appears to be documented in the available report text: {rationale}."
                if rationale
                else "No reporting-responsibility rationale was found in the available report data. Follow-up inquiry is required."
            )
        )
        return [
            self._finding(
                "Historical variance",
                "concern" if not rationale else "review",
                "Critical supply decrease requires reporting-responsibility review",
                detail,
                "Fuel supply",
                [
                    self._metric(
                        "Total fuel supply",
                        current_supply,
                        comparison_value=prior_supply,
                        delta=current_supply - prior_supply,
                        percent_change=percent_change,
                        units="reported units",
                    )
                ],
                (
                    "Does the supply decrease reflect a documented shift in reporting responsibility or supply agreements?"
                    if not rationale
                    else None
                ),
                confidence="medium",
            )
        ]

    def _fuel_mix_shift_findings(
        self,
        current_totals: dict[str, dict[str, float]],
        prior_totals: dict[str, dict[str, float]],
    ) -> list[ComplianceReportReviewFindingSchema]:
        current_supply = current_totals.get("fuel_supplies", {})
        prior_supply = prior_totals.get("fuel_supplies", {})

        hdrd_label = next(
            (
                label
                for label in current_supply.keys() | prior_supply.keys()
                if "hdrd" in label.lower()
            ),
            None,
        )
        fossil_diesel_label = next(
            (
                label
                for label in current_supply.keys() | prior_supply.keys()
                if "fossil" in label.lower() and "diesel" in label.lower()
            ),
            None,
        )
        if not hdrd_label or not fossil_diesel_label:
            return []

        hdrd_current = current_supply.get(hdrd_label, 0)
        hdrd_prior = prior_supply.get(hdrd_label, 0)
        fossil_current = current_supply.get(fossil_diesel_label, 0)
        fossil_prior = prior_supply.get(fossil_diesel_label, 0)

        hdrd_percent = self._percent_change(hdrd_current, hdrd_prior)
        fossil_percent = self._percent_change(fossil_current, fossil_prior)
        if (
            hdrd_percent is None
            or fossil_percent is None
            or hdrd_percent <= 0
            or fossil_percent >= 0
            or not self._is_material(hdrd_current - hdrd_prior, hdrd_percent)
            or not self._is_material(fossil_current - fossil_prior, fossil_percent)
        ):
            return []

        return [
            self._finding(
                "Fuel code validation",
                "review",
                "Fuel mix indicates a possible blending shift",
                (
                    f"The report shows a {abs(round(hdrd_percent, 1))}% increase in {hdrd_label} "
                    f"alongside a {abs(round(fossil_percent, 1))}% decrease in {fossil_diesel_label}. "
                    "This is consistent with a possible blending shift and should be reviewed against lower carbon fuel target expectations."
                ),
                "Fuel supply",
                [
                    self._metric(
                        hdrd_label,
                        hdrd_current,
                        comparison_value=hdrd_prior,
                        delta=hdrd_current - hdrd_prior,
                        percent_change=hdrd_percent,
                        units="reported units",
                    ),
                    self._metric(
                        fossil_diesel_label,
                        fossil_current,
                        comparison_value=fossil_prior,
                        delta=fossil_current - fossil_prior,
                        percent_change=fossil_percent,
                        units="reported units",
                    ),
                ],
                "Does the fuel mix change reflect an intentional blending strategy supported by the lower carbon fuel target summary?",
                confidence="medium",
            )
        ]

    def _build_chart_data(
        self,
        current_records: dict[str, list],
        current_chart_totals: dict[str, dict[str, float]],
        prior_year_snapshots: list[tuple[object, dict[str, dict]]],
        previous_version_records: dict[str, list] | None,
        current_summary,
        previous_summary,
        compliance_units_by_fuel: list[dict],
        current_fuel_code_totals: dict[str, float],
        fuel_code_totals_by_report: dict[int, dict[str, float]],
        fse_summary: dict | None,
        prior_fse_snapshots: list[tuple[object, dict]],
        current_label: str,
        previous_version_label: str,
        current_version_label: str,
    ) -> ComplianceReportReviewChartDataSchema:
        historical = []
        fse_summary_by_report_id = {
            prior_report.compliance_report_id: prior_summary
            for prior_report, prior_summary in prior_fse_snapshots
        }
        historical.extend(
            self._build_supply_fse_trend_series(
                current_chart_totals,
                prior_year_snapshots,
                fse_summary,
                prior_fse_snapshots,
                current_label,
            )
        )
        historical.extend(
            self._build_fuel_presence_heatmap_series(
                current_chart_totals,
                prior_year_snapshots,
                current_label,
            )
        )
        for prior_report, prior_totals in prior_year_snapshots:
            prior_label = str(prior_report.compliance_period.description)
            for key in self._schedule_keys():
                points = self._comparison_points(
                    current_chart_totals.get(key, {}),
                    prior_totals.get(key, {}),
                    units="reported units",
                )
                if points:
                    historical.append(
                        ComplianceReportReviewComparisonSeriesSchema(
                            title=f"{self._source_label(key)} by fuel category and type",
                            current_label=current_label,
                            comparison_label=prior_label,
                            points=points,
                        )
                    )

            fuel_code_points = self._comparison_points(
                current_fuel_code_totals,
                fuel_code_totals_by_report.get(prior_report.compliance_report_id, {}),
                units="reported units",
            )
            if fuel_code_points:
                historical.append(
                    ComplianceReportReviewComparisonSeriesSchema(
                        title="Fuel supply by fuel code",
                        current_label=current_label,
                        comparison_label=prior_label,
                        points=fuel_code_points,
                    )
                )

            prior_fse_summary = fse_summary_by_report_id.get(
                prior_report.compliance_report_id, {}
            )
            if fse_summary and prior_fse_summary:
                historical.extend(
                    self._fse_chart_series(
                        fse_summary,
                        prior_fse_summary,
                        current_label,
                        prior_label,
                    )
                )

        supplemental = []
        if previous_version_records:
            for key, field in [
                ("fuel_supplies", "quantity"),
                ("fuel_exports", "quantity"),
                ("allocation_agreements", "quantity"),
                ("notional_transfers", "quantity"),
                ("other_uses", "quantity_supplied"),
            ]:
                points = self._comparison_points(
                    self._sum_by_fuel_category(current_records[key], field),
                    self._sum_by_fuel_category(previous_version_records[key], field),
                    units="reported units",
                )
                if points:
                    supplemental.append(
                        ComplianceReportReviewComparisonSeriesSchema(
                            title=f"{self._source_label(key)} supplemental impact",
                            current_label=current_version_label,
                            comparison_label=previous_version_label,
                            points=points,
                        )
                    )

        if previous_summary:
            current_line_20 = self._summary_row_value(
                current_summary.low_carbon_fuel_target_summary, 20
            )
            previous_line_20 = self._summary_row_value(
                previous_summary.low_carbon_fuel_target_summary, 20
            )
            supplemental.append(
                ComplianceReportReviewComparisonSeriesSchema(
                    title="Summary line 20 supplemental impact",
                    current_label=current_version_label,
                    comparison_label=previous_version_label,
                    points=[
                        self._comparison_point(
                            "Line 20",
                            current_line_20 or 0,
                            previous_line_20 or 0,
                            delta_mode="magnitude_gap",
                            units="compliance units",
                        )
                    ],
                )
            )

        return ComplianceReportReviewChartDataSchema(
            historical_variance=historical,
            supplemental_impact=supplemental,
            compliance_units_by_fuel=[
                ComplianceReportReviewComplianceUnitPointSchema(**point)
                for point in compliance_units_by_fuel
            ],
        )

    def _fse_chart_series(
        self,
        current: dict,
        prior: dict,
        current_label: str,
        prior_label: str,
    ) -> list[ComplianceReportReviewComparisonSeriesSchema]:
        series = []

        current_total_kwh = self._number(current.get("total_kwh", 0))
        prior_total_kwh = self._number(prior.get("total_kwh", 0))
        current_utilization = current.get("avg_capacity_utilization_percent")
        prior_utilization = prior.get("avg_capacity_utilization_percent")
        usage_points = []
        if current_total_kwh > 0 or prior_total_kwh > 0:
            usage_points.append(
                self._comparison_point(
                    "Total kWh usage",
                    current_total_kwh,
                    prior_total_kwh,
                    units="kWh",
                )
            )
        if current_utilization is not None or prior_utilization is not None:
            usage_points.append(
                self._comparison_point(
                    "Average capacity utilization",
                    current_utilization if current_utilization is not None else 0,
                    prior_utilization if prior_utilization is not None else 0,
                    units="%",
                )
            )

        if usage_points:
            series.append(
                ComplianceReportReviewComparisonSeriesSchema(
                    title="FSE kWh usage and capacity utilization",
                    current_label=current_label,
                    comparison_label=prior_label,
                    points=usage_points,
                )
            )

        current_equipment_counts = {
            "Total FSE": current.get("equipment_count", 0),
            "Active FSE": current.get("active_count", 0),
            "Validated FSE": current.get("validated_count", 0),
        }
        prior_equipment_counts = {
            "Total FSE": prior.get("equipment_count", 0),
            "Active FSE": prior.get("active_count", 0),
            "Validated FSE": prior.get("validated_count", 0),
        }
        for level in sorted(
            set(current.get("level_counts") or {})
            | set(prior.get("level_counts") or {})
        ):
            current_equipment_counts[f"{level} FSE"] = (
                current.get("level_counts") or {}
            ).get(level, 0)
            prior_equipment_counts[f"{level} FSE"] = (
                prior.get("level_counts") or {}
            ).get(level, 0)

        equipment_points = self._comparison_points(
            current_equipment_counts,
            prior_equipment_counts,
            units="count",
        )
        if equipment_points:
            series.append(
                ComplianceReportReviewComparisonSeriesSchema(
                    title="FSE equipment counts",
                    current_label=current_label,
                    comparison_label=prior_label,
                    points=equipment_points,
                )
            )

        return series

    def _build_supply_fse_trend_series(
        self,
        current_chart_totals: dict[str, dict[str, float]],
        prior_year_snapshots: list[tuple[object, dict[str, dict[str, float]]]],
        current_fse_summary: dict | None,
        prior_fse_snapshots: list[tuple[object, dict]],
        current_label: str,
    ) -> list[ComplianceReportReviewComparisonSeriesSchema]:
        if not current_fse_summary:
            return []

        prior_fse_by_report_id = {
            prior_report.compliance_report_id: prior_summary
            for prior_report, prior_summary in prior_fse_snapshots
        }
        current_supply = sum(current_chart_totals.get("fuel_supplies", {}).values())
        current_fse_count = self._number(current_fse_summary.get("equipment_count", 0))
        if current_fse_count <= 0:
            return []

        series = []
        for prior_report, prior_totals in prior_year_snapshots:
            prior_fse_summary = prior_fse_by_report_id.get(
                prior_report.compliance_report_id
            )
            if (
                not prior_fse_summary
                or self._number(prior_fse_summary.get("equipment_count", 0)) <= 0
            ):
                continue

            series.append(
                ComplianceReportReviewComparisonSeriesSchema(
                    title="Fuel supply and FSE count trend",
                    current_label=current_label,
                    comparison_label=str(prior_report.compliance_period.description),
                    points=[
                        self._comparison_point(
                            "Total fuel supply",
                            current_supply,
                            sum(prior_totals.get("fuel_supplies", {}).values()),
                            units="reported units",
                        ),
                        self._comparison_point(
                            "FSE count",
                            current_fse_count,
                            self._number(prior_fse_summary.get("equipment_count", 0)),
                            units="count",
                        ),
                    ],
                )
            )

        return series

    def _build_fuel_presence_heatmap_series(
        self,
        current_chart_totals: dict[str, dict[str, float]],
        prior_year_snapshots: list[tuple[object, dict[str, dict[str, float]]]],
        current_label: str,
    ) -> list[ComplianceReportReviewComparisonSeriesSchema]:
        current_supply = current_chart_totals.get("fuel_supplies", {})
        series = []
        for prior_report, prior_totals in prior_year_snapshots:
            points = self._comparison_points(
                current_supply,
                prior_totals.get("fuel_supplies", {}),
                units="reported units",
            )
            if points:
                series.append(
                    ComplianceReportReviewComparisonSeriesSchema(
                        title="Fuel supply presence by fuel category and type",
                        current_label=current_label,
                        comparison_label=str(prior_report.compliance_period.description),
                        points=points,
                    )
                )
        return series

    def _comparison_points(
        self, current: dict[str, float], comparison: dict[str, float], units: str
    ) -> list[ComplianceReportReviewComparisonPointSchema]:
        points = []
        for label in sorted(set(current) | set(comparison)):
            current_value = current.get(label, 0)
            comparison_value = comparison.get(label, 0)
            if current_value == 0 and comparison_value == 0:
                continue
            points.append(
                self._comparison_point(
                    label,
                    current_value,
                    comparison_value,
                    units=units,
                )
            )
        return points

    def _comparison_point(
        self,
        label: str,
        current_value: float,
        comparison_value: float,
        units: str,
        delta_mode: str = "signed",
    ) -> ComplianceReportReviewComparisonPointSchema:
        if delta_mode == "magnitude_gap":
            delta = self._magnitude_gap(current_value, comparison_value)
            percent_change = self._percent_change(
                abs(current_value),
                abs(comparison_value),
            )
        else:
            delta = current_value - comparison_value
            percent_change = self._percent_change(current_value, comparison_value)
        return ComplianceReportReviewComparisonPointSchema(
            label=label,
            current_value=current_value,
            comparison_value=comparison_value,
            delta=delta,
            percent_change=percent_change,
            units=units,
        )

    def _group_sections(
        self, findings: list[ComplianceReportReviewFindingSchema]
    ) -> list[ComplianceReportReviewSectionSchema]:
        grouped = defaultdict(list)
        for finding in findings:
            grouped[finding.review_area].append(finding)

        sections = []
        for area in sorted(grouped):
            area_findings = grouped[area]
            status = "clear"
            if any(f.severity == "concern" for f in area_findings):
                status = "concern"
            elif area_findings:
                status = "review"
            sections.append(
                ComplianceReportReviewSectionSchema(
                    section=area,
                    status=status,
                    findings=area_findings,
                )
            )
        return sections

    def _top_follow_up_questions(
        self, findings: list[ComplianceReportReviewFindingSchema]
    ) -> list[str]:
        ordered = sorted(
            [finding for finding in findings if finding.suggested_follow_up],
            key=lambda finding: {"concern": 0, "review": 1, "informational": 2}[
                finding.severity
            ],
        )
        questions = []
        seen = set()
        for finding in ordered:
            normalized_question = " ".join(finding.suggested_follow_up.split()).lower()
            if normalized_question in seen:
                continue
            seen.add(normalized_question)
            questions.append(finding.suggested_follow_up)
            if len(questions) == 3:
                break
        return questions

    def _build_summary(self, findings, has_prior_year_baseline: bool) -> str:
        concern_count = sum(1 for finding in findings if finding.severity == "concern")
        review_count = sum(1 for finding in findings if finding.severity == "review")
        baseline = (
            "Prior-year assessed comparison was available."
            if has_prior_year_baseline
            else "No prior-year assessed comparison was available."
        )
        highlights = self._summary_highlights(findings)
        if concern_count:
            intro = (
                f"Deterministic pre-screen found {concern_count} concern(s) and "
                f"{review_count} review item(s)."
            )
            return " ".join([intro, *highlights, baseline]).strip()
        if review_count:
            intro = (
                f"Deterministic pre-screen found {review_count} item(s) for analyst review."
            )
            return " ".join([intro, *highlights, baseline]).strip()
        if highlights:
            return " ".join([*highlights, baseline]).strip()
        return (
            "Deterministic pre-screen did not find material concerns using the "
            f"current rule set. {baseline}"
        )

    def _summary_highlights(
        self, findings: list[ComplianceReportReviewFindingSchema]
    ) -> list[str]:
        priority = {"concern": 0, "review": 1, "informational": 2}
        seen_areas = set()
        highlights = []
        for finding in sorted(findings, key=lambda item: priority[item.severity]):
            if finding.review_area in seen_areas:
                continue
            if not finding.detail:
                continue
            seen_areas.add(finding.review_area)
            highlights.append(finding.detail)
            if len(highlights) == 3:
                break
        return highlights

    def _negative_confirmation_area(self, key: str) -> str:
        return {
            "fuel_exports": "Notional transfers and exports",
            "notional_transfers": "Notional transfers and exports",
            "other_uses": "Out-of-province consumption",
        }.get(key, self._source_label(key))

    def _negative_confirmation_title(self, key: str, historical: bool) -> str:
        if historical:
            return {
                "fuel_exports": "No exports reported this year",
                "notional_transfers": "No notional transfers reported this year",
                "other_uses": "No other uses reported this year",
            }.get(key, f"No {self._source_label(key).lower()} reported this year")
        return {
            "fuel_exports": "Confirmed no reportable exports",
            "notional_transfers": "Confirmed no reportable notional transfers",
            "other_uses": "Confirmed no reportable other uses",
        }.get(key, f"Confirmed no {self._source_label(key).lower()} reported")

    def _negative_confirmation_detail(self, key: str, historical: bool) -> str:
        if historical:
            return (
                f"No {self._source_label(key).lower()} were reported in the current effective data, "
                "which differs from the prior assessed report. No rationale was found in the available data."
            )
        return (
            f"The current effective data does not include reportable {self._source_label(key).lower()} "
            "and this is consistent with the prior assessed report."
        )

    def _schedule_total(
        self, totals: dict[str, dict[str, float]], key: str
    ) -> float:
        return sum(totals.get(key, {}).values())

    def _report_rationale_reference(
        self, report, keywords: list[str]
    ) -> str | None:
        text_sources = [
            getattr(report, "supplemental_note", None),
            getattr(report, "assessment_statement", None),
            getattr(report, "nickname", None),
        ]
        for text in text_sources:
            if not text:
                continue
            lowered = text.lower()
            for keyword in keywords:
                if keyword in lowered:
                    return str(text).strip()
        return None

    def _schedule_keys(self) -> list[str]:
        return [
            "fuel_supplies",
            "fuel_exports",
            "allocation_agreements",
            "notional_transfers",
            "other_uses",
        ]

    def _schedule_totals_from_records(
        self, records: dict[str, list]
    ) -> dict[str, dict[str, float]]:
        return {
            "fuel_supplies": self._sum_by_fuel_category(
                records["fuel_supplies"], "quantity"
            ),
            "fuel_exports": self._sum_by_fuel_category(
                records["fuel_exports"], "quantity"
            ),
            "allocation_agreements": self._sum_by_fuel_category(
                records["allocation_agreements"], "quantity"
            ),
            "notional_transfers": self._sum_by_fuel_category(
                records["notional_transfers"], "quantity"
            ),
            "other_uses": self._sum_by_fuel_category(
                records["other_uses"], "quantity_supplied"
            ),
        }

    def _sum_by_fuel_type(
        self, rows: Iterable, quantity_field: str
    ) -> dict[str, float]:
        totals = defaultdict(float)
        for row in rows:
            fuel_type = getattr(getattr(row, "fuel_type", None), "fuel_type", None)
            key = str(fuel_type or "Unknown fuel type")
            totals[key] += self._number(getattr(row, quantity_field, 0))
        return dict(totals)

    def _sum_by_fuel_category(
        self, rows: Iterable, quantity_field: str
    ) -> dict[str, float]:
        totals = defaultdict(float)
        for row in rows:
            totals[self._fuel_label(row)] += self._number(
                getattr(row, quantity_field, 0)
            )
        return dict(totals)

    def _fuel_label(self, row) -> str:
        fuel_category = getattr(getattr(row, "fuel_category", None), "category", None)
        fuel_type = getattr(getattr(row, "fuel_type", None), "fuel_type", None)
        key = str(fuel_category or "Unknown fuel category")
        if fuel_type:
            key = f"{key} - {fuel_type}"
        return key

    def _summary_row_value(self, rows, line_number: int) -> float | None:
        row = next((item for item in rows if item.line == line_number), None)
        if not row:
            return None
        for attr in ("value", "total_value"):
            value = getattr(row, attr, None)
            if value not in (None, ""):
                return self._number(value)
        return None

    def _fuel_code_valid_for_year(self, fuel_code, compliance_year: int) -> bool:
        start = date(compliance_year, 1, 1)
        end = date(compliance_year, 12, 31)
        effective = fuel_code.effective_date
        expiration = fuel_code.expiration_date
        return (not effective or effective <= end) and (
            not expiration or expiration >= start
        )

    def _history_status_date(self, report, status: ComplianceReportStatusEnum):
        history = getattr(report, "history", None) or []
        matching_dates = [
            entry.create_date
            for entry in history
            if getattr(getattr(entry, "status", None), "status", None) == status
            and getattr(entry, "create_date", None)
        ]
        if not matching_dates:
            return None
        return min(matching_dates)

    def _date_value(self, value) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return datetime.fromisoformat(str(value)).date()

    def _is_material(self, delta: float, percent_change: float | None) -> bool:
        return abs(delta) >= MATERIAL_VOLUME_THRESHOLD or (
            percent_change is not None
            and abs(percent_change) >= MATERIAL_PERCENT_THRESHOLD
            and abs(delta) > 0
        )

    def _percent_change(self, current: float, previous: float) -> float | None:
        if previous == 0:
            return None
        return round(((current - previous) / abs(previous)) * 100, 1)

    def _finding(
        self,
        review_area: str,
        severity: str,
        title: str,
        detail: str,
        source: str,
        evidence: list[ComplianceReportReviewMetricSchema],
        suggested_follow_up: str | None,
        confidence: str = "high",
    ) -> ComplianceReportReviewFindingSchema:
        return ComplianceReportReviewFindingSchema(
            review_area=review_area,
            severity=severity,
            title=title,
            detail=detail,
            source=source,
            evidence=evidence,
            suggested_follow_up=suggested_follow_up,
            confidence=confidence,
        )

    def _metric(
        self,
        label: str,
        value,
        comparison_value=None,
        delta=None,
        percent_change=None,
        units: str | None = None,
    ) -> ComplianceReportReviewMetricSchema:
        return ComplianceReportReviewMetricSchema(
            label=label,
            value=self._clean_value(value),
            comparison_value=self._clean_value(comparison_value),
            delta=self._clean_value(delta),
            percent_change=self._clean_value(percent_change),
            units=units,
        )

    def _source_label(self, key: str) -> str:
        return {
            "fuel_supplies": "Fuel supply",
            "fuel_exports": "Fuel exports",
            "allocation_agreements": "Allocation agreements",
            "notional_transfers": "Notional transfers",
            "other_uses": "Other uses",
        }.get(key, key)

    def _clean_value(self, value):
        if isinstance(value, Decimal):
            return float(value)
        return value

    def _number(self, value) -> float:
        if value in (None, ""):
            return 0
        if isinstance(value, Decimal):
            return float(value)
        return float(value)

    def _fuel_supply_total_kwh(self, rows: Iterable) -> float:
        total = 0.0
        for row in rows:
            units = getattr(row, "units", None)
            unit_value = getattr(units, "value", units)
            if unit_value != QuantityUnitsEnum.Kilowatt_hour.value:
                continue
            total += self._number(getattr(row, "quantity", 0))
        return total

    def _magnitude_gap(self, current_value, comparison_value) -> float:
        return abs(abs(self._number(current_value)) - abs(self._number(comparison_value)))

    def _to_int(self, value) -> int | None:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _enum_value(self, value):
        return getattr(value, "value", value)
