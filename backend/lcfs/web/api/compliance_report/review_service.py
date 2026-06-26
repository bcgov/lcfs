from collections import defaultdict
from datetime import datetime, timezone, date
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
    ) -> None:
        self.repo = repo
        self.summary_service = summary_service

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
            current_label=str(report.compliance_period.description),
            previous_version_label=(
                f"Version {report.version - 1}" if previous_version_summary else ""
            ),
            current_version_label=f"Version {report.version}",
        )

        findings = []
        findings.extend(self._administrative_findings(report))
        findings.extend(self._schedule_findings(schedule_records))
        findings.extend(
            self._fuel_code_findings(schedule_records, compliance_year=compliance_year)
        )
        findings.extend(self._allocation_findings(schedule_records))
        findings.extend(self._summary_findings(current_summary))

        if prior_year_snapshots:
            findings.extend(
                self._historical_variance_findings(
                    current_chart_totals, prior_year_snapshots[0][1]
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
        self, report
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
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

        if not records["notional_transfers"] and not records["fuel_exports"]:
            findings.append(
                self._finding(
                    "Notional transfers and exports",
                    "informational",
                    "No notional transfers or exports reported",
                    "The effective report data does not include active notional transfers or fuel exports.",
                    "Notional transfers and fuel exports",
                    [
                        self._metric("Notional transfers", 0),
                        self._metric("Fuel exports", 0),
                    ],
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
                findings.append(
                    self._finding(
                        area,
                        "review",
                        title,
                        "This section has active records and should be included in manual reconciliation.",
                        self._source_label(key),
                        [self._metric("Active records", len(records[key]))],
                        "Do the reported volumes reconcile to related schedules, counterparties, and supporting rationale?",
                    )
                )

        return findings

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

    def _allocation_findings(
        self, records: dict[str, list]
    ) -> list[ComplianceReportReviewFindingSchema]:
        findings = []
        supplied_by_fuel = self._sum_by_fuel_type(records["fuel_supplies"], "quantity")
        allocated_by_fuel = self._sum_by_fuel_type(
            records["allocation_agreements"], "quantity"
        )

        for fuel_type, allocated in allocated_by_fuel.items():
            supplied = supplied_by_fuel.get(fuel_type, 0)
            if supplied and allocated > supplied:
                findings.append(
                    self._finding(
                        "Allocations and transfers",
                        "concern",
                        "Allocated volume exceeds supplied volume",
                        "Allocation agreement quantity is greater than fuel supply quantity for the same fuel type in the effective report data.",
                        "Allocation agreements",
                        [
                            self._metric(
                                fuel_type,
                                allocated,
                                comparison_value=supplied,
                                delta=allocated - supplied,
                                units="reported units",
                            )
                        ],
                        "Why does allocated volume exceed reported supplied volume for this fuel type?",
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
                        "The effective schedule total changed materially compared with the prior-year assessed report.",
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

        delta = (current_line_20 or 0) - (previous_line_20 or 0)
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
                        units="compliance units",
                    )
                ],
                "Which schedule changes caused the line 20 movement, and is the supplemental rationale supportable?",
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
        current_label: str,
        previous_version_label: str,
        current_version_label: str,
    ) -> ComplianceReportReviewChartDataSchema:
        historical = []
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
                            title=f"{self._source_label(key)} by fuel type",
                            current_label=current_label,
                            comparison_label=prior_label,
                            points=points,
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
                    self._sum_by_fuel_type(current_records[key], field),
                    self._sum_by_fuel_type(previous_version_records[key], field),
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
    ) -> ComplianceReportReviewComparisonPointSchema:
        delta = current_value - comparison_value
        return ComplianceReportReviewComparisonPointSchema(
            label=label,
            current_value=current_value,
            comparison_value=comparison_value,
            delta=delta,
            percent_change=self._percent_change(current_value, comparison_value),
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
        if concern_count:
            return f"Deterministic pre-screen found {concern_count} concern(s) and {review_count} review item(s). {baseline}"
        if review_count:
            return f"Deterministic pre-screen found {review_count} item(s) for analyst review. {baseline}"
        return f"Deterministic pre-screen did not find material concerns using the current rule set. {baseline}"

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
            "fuel_supplies": self._sum_by_fuel_type(
                records["fuel_supplies"], "quantity"
            ),
            "fuel_exports": self._sum_by_fuel_type(records["fuel_exports"], "quantity"),
            "allocation_agreements": self._sum_by_fuel_type(
                records["allocation_agreements"], "quantity"
            ),
            "notional_transfers": self._sum_by_fuel_type(
                records["notional_transfers"], "quantity"
            ),
            "other_uses": self._sum_by_fuel_type(
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

    def _to_int(self, value) -> int | None:
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _enum_value(self, value):
        return getattr(value, "value", value)
