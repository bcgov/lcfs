from logging import getLogger
import math
from datetime import datetime
from typing import List, Dict
from datetime import datetime
from fastapi import Depends, Request

from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.web.api.base import PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportCreateSchema,
    ComplianceReportListSchema,
    ComplianceReportSummaryRowSchema
)
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException
from lcfs.web.api.compliance_report.constants import (
    RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
    PRESCRIBED_PENALTY_RATE,
)
from lcfs.web.api.notional_transfer.services import NotionalTransferServices

logger = getLogger(__name__)


class ComplianceReportServices:
    def __init__(
        self,
        request: Request = None, repo: ComplianceReportRepository = Depends(),
        notional_transfer_service: NotionalTransferServices = Depends(
            NotionalTransferServices),
    ) -> None:
        self.request = request
        self.repo = repo
        self.notional_transfer_service = notional_transfer_service

    @service_handler
    async def get_all_compliance_periods(self) -> List[CompliancePeriodSchema]:
        """Fetches all compliance periods and converts them to Pydantic models."""
        periods = await self.repo.get_all_compliance_periods()
        return [CompliancePeriodSchema.model_validate(period) for period in periods]

    @service_handler
    async def create_compliance_report(
        self, organization_id: int, report_data: ComplianceReportCreateSchema
    ) -> ComplianceReportBaseSchema:
        """Creates a new compliance report."""
        period = await self.repo.get_compliance_period(report_data.compliance_period)
        draft_status = await self.repo.get_compliance_report_status_by_desc(
            report_data.status
        )
        report = await self.repo.add_compliance_report(
            ComplianceReport(
                compliance_period=period,
                organization_id=organization_id,
                status=draft_status,
            )
        )
        # Add a new compliance history record for the new draft report
        await self.repo.add_compliance_report_history(report, self.request.user)

        return report

    @service_handler
    async def get_compliance_reports_paginated(
        self, pagination, organization_id: int = None
    ):
        """Fetches all compliance reports"""

        reports, total_count = await self.repo.get_reports_paginated(
            pagination, organization_id
        )
        if len(reports) == 0:
            raise DataNotFoundException("No compliance reports found.")

        return ComplianceReportListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            reports=reports,
        )

    @service_handler
    async def get_compliance_report_by_id(
        self, report_id: int
    ) -> ComplianceReportBaseSchema:
        """Fetches a specific compliance report by ID."""
        report = await self.repo.get_compliance_report_by_id(report_id)
        if report is None:
            raise DataNotFoundException("Compliance report not found.")
        return report

    @service_handler
    async def get_compliance_report_summary(self, report_id: int) -> Dict[str, List[ComplianceReportSummaryRowSchema]]:
        """Generate the comprehensive compliance report summary for a specific compliance report by ID."""

        # Fetch the compliance report details
        compliance_report = await self.repo.get_compliance_report_by_id(report_id)
        if not compliance_report:
            raise DataNotFoundException("Compliance report not found.")

        compliance_period_start = compliance_report.compliance_period.effective_date
        compliance_period_end = compliance_report.compliance_period.expiration_date
        organization_id = compliance_report.organization_id

        # Fetch fuel quantities
        fuel_quantities = await self.repo.calculate_fuel_quantities(report_id)
        fossil_quantities = fuel_quantities['fossil_fuel_quantities']
        renewable_quantities = fuel_quantities['renewable_fuel_quantities']

        # Placeholder values for demonstration purposes
        # need to get these values from the db after fuel supply is implemented
        previous_retained = {'gasoline': 200, 'diesel': 400, 'jet_fuel': 100}

        notional_transfers = await self.notional_transfer_service.get_notional_transfers(compliance_report_id=report_id)

        notional_transfers_sums = {
            'gasoline': 0,
            'diesel': 0,
            'jet_fuel': 0
        }

        for transfer in notional_transfers.notional_transfers:
            # Normalize the fuel category key
            normalized_category = transfer.fuel_category.replace(
                " ", "_").lower()

            # Update the corresponding category sum
            if transfer.received_or_transferred.lower() == "received":
                notional_transfers_sums[normalized_category] += transfer.quantity
            elif transfer.received_or_transferred.lower() == "transferred":
                notional_transfers_sums[normalized_category] -= transfer.quantity

        renewable_fuel_target_summary = self.calculate_renewable_fuel_target_summary(
            fossil_quantities, renewable_quantities, previous_retained, notional_transfers_sums, compliance_period=compliance_period_start.year
        )
        low_carbon_fuel_target_summary = await self.calculate_low_carbon_fuel_target_summary(
            compliance_period_start, compliance_period_end, organization_id
        )
        non_compliance_penalty_summary = self.calculate_non_compliance_penalty_summary()

        summary = {
            'renewableFuelTargetSummary': renewable_fuel_target_summary,
            'lowCarbonFuelTargetSummary': low_carbon_fuel_target_summary,
            'nonCompliancePenaltySummary': non_compliance_penalty_summary
        }

        return summary

    def calculate_renewable_fuel_target_summary(self, fossil_quantities: dict, renewable_quantities: dict, previous_retained: dict, notional_transfers_sums: dict, compliance_period: datetime) -> List[ComplianceReportSummaryRowSchema]:
        # line 3
        tracked_totals = {
            category: fossil_quantities.get(
                category, 0) + renewable_quantities.get(category, 0)
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        # line 4
        if 2024 <= compliance_period <= 2027:
            jet_fuel_percentage = 0 / 100
        elif compliance_period == 2028:
            jet_fuel_percentage = 1 / 100
        elif compliance_period == 2029:
            jet_fuel_percentage = 2 / 100
        else:
            jet_fuel_percentage = 3 / 100

        eligible_renewable_fuel_required = {
            'gasoline': tracked_totals['gasoline'] * 0.05,
            'diesel': tracked_totals['diesel'] * 0.04,
            'jet_fuel': tracked_totals['jet_fuel'] * jet_fuel_percentage,
        }

        # line 6
        retained_renewables = {
            category: min(0.05 * eligible_renewable_fuel_required.get(category, 0),
                          previous_retained.get(category, 0))
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        # line 8
        # These should be calculated based on some business logic
        deferred_renewables = {'gasoline': 9000,
                               'diesel': 2000, 'jet_fuel': 5000}

        # line 9
        renewables_added = {'gasoline': 1000, 'diesel': 2000, 'jet_fuel': 3000}

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
                renewables_added.get(category, 0)
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        # line 11
        non_compliance_penalties = {
            category: max(0, eligible_renewable_fuel_required.get(category, 0) -
                          net_renewable_supplied.get(category, 0)) * PRESCRIBED_PENALTY_RATE[category]
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        summary_lines = {
            '1': {'gasoline': fossil_quantities.get('gasoline', 0), 'diesel': fossil_quantities.get('diesel', 0), 'jet_fuel': fossil_quantities.get('jet_fuel', 0)},
            '2': {'gasoline': renewable_quantities.get('gasoline', 0), 'diesel': renewable_quantities.get('diesel', 0), 'jet_fuel': renewable_quantities.get('jet_fuel', 0)},
            '3': {'gasoline': tracked_totals.get('gasoline', 0), 'diesel': tracked_totals.get('diesel', 0), 'jet_fuel': tracked_totals.get('jet_fuel', 0)},
            '4': {'gasoline': eligible_renewable_fuel_required.get('gasoline', 0), 'diesel': eligible_renewable_fuel_required.get('diesel', 0), 'jet_fuel': eligible_renewable_fuel_required.get('jet_fuel', 0)},
            # Notionally transferred value
            '5': notional_transfers_sums,
            '6': {'gasoline': retained_renewables.get('gasoline', 0), 'diesel': retained_renewables.get('diesel', 0), 'jet_fuel': retained_renewables.get('jet_fuel', 0)},
            '7': {'gasoline': previous_retained.get('gasoline', 0), 'diesel': previous_retained.get('diesel', 0), 'jet_fuel': previous_retained.get('jet_fuel', 0)},
            '8': {'gasoline': deferred_renewables.get('gasoline', 0), 'diesel': deferred_renewables.get('diesel', 0), 'jet_fuel': deferred_renewables.get('jet_fuel', 0)},
            # Renewable obligation added from previous period
            '9': {'gasoline': renewables_added.get('gasoline', 0), 'diesel': renewables_added.get('diesel', 0), 'jet_fuel': renewables_added.get('jet_fuel', 0)},
            '10': {'gasoline': net_renewable_supplied.get('gasoline', 0), 'diesel': net_renewable_supplied.get('diesel', 0), 'jet_fuel': net_renewable_supplied.get('jet_fuel', 0)},
            '11': {'gasoline': non_compliance_penalties.get('gasoline', 0), 'diesel': non_compliance_penalties.get('diesel', 0), 'jet_fuel': non_compliance_penalties.get('jet_fuel', 0)},
        }

        summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=RENEWABLE_FUEL_TARGET_DESCRIPTIONS[line],
                gasoline=values.get('gasoline', 0),
                diesel=values.get('diesel', 0),
                jet_fuel=values.get('jet_fuel', 0)
            )
            for line, values in summary_lines.items()
        ]

        return summary

    async def calculate_low_carbon_fuel_target_summary(
            self, compliance_period_start: datetime, compliance_period_end: datetime, organization_id: int
    ) -> List[ComplianceReportSummaryRowSchema]:

        # replace 200 with sum of export fuels when export fuels is ready
        complianceUnitsExport = 200 * -1

        compliance_units_transferred_out = await self.repo.get_transferred_out_compliance_units(
            compliance_period_start, compliance_period_end, organization_id
        )
        compliance_units_received = await self.repo.get_received_compliance_units(
            compliance_period_start, compliance_period_end, organization_id
        )
        compliance_units_issued = await self.repo.get_issued_compliance_units(
            compliance_period_start, compliance_period_end, organization_id
        )

        low_carbon_summary_lines = {
            '12': {'value': compliance_units_transferred_out},
            '13': {'value': compliance_units_received},
            '14': {'value': compliance_units_issued},
            '15': {'value': 0},
            '16': {'value': 0},
            '17': {'value': 0},
            '18': {'value': 0},
            '19': {'value': complianceUnitsExport},
            '20': {'value': 0},
            '21': {'value': 0},
            '22': {'value': 500},
        }

        low_carbon_fuel_target_summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=LOW_CARBON_FUEL_TARGET_DESCRIPTIONS[line],
                value=values.get('value', 0)
            )
            for line, values in low_carbon_summary_lines.items()
        ]

        return low_carbon_fuel_target_summary

    def calculate_non_compliance_penalty_summary(self) -> List[ComplianceReportSummaryRowSchema]:
        non_compliance_summary_lines = {
            '11': {'gasoline': 100, 'diesel': 0, 'jet_fuel': 0, 'total_value': 100},
            '21': {'gasoline': 100, 'diesel': 0, 'jet_fuel': 0, 'total_value': 0},
            '': {'gasoline': None, 'diesel': None, 'jet_fuel': None, 'total_value': 600}
        }

        non_compliance_penalty_summary = [
            ComplianceReportSummaryRowSchema(
                line=line,
                description=NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS[line],
                gasoline=values.get('gasoline', 0),
                diesel=values.get('diesel', 0),
                jet_fuel=values.get('jet_fuel', 0),
                total_value=values.get('total_value', 0)
            )
            for line, values in non_compliance_summary_lines.items()
        ]

        return non_compliance_penalty_summary
