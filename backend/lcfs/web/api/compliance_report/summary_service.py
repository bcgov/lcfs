from typing import List, Dict
from fastapi import Depends
from lcfs.web.api.compliance_report.schema import ComplianceReportSummaryRowSchema
from lcfs.web.api.compliance_report.constants import (
    RENEWABLE_FUEL_TARGET_DESCRIPTIONS,
    LOW_CARBON_FUEL_TARGET_DESCRIPTIONS,
    NON_COMPLIANCE_PENALTY_SUMMARY_DESCRIPTIONS,
    PRESCRIBED_PENALTY_RATE,
)
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.core.decorators import service_handler
from lcfs.web.exception.exceptions import DataNotFoundException

class ComplianceReportSummaryService:
    def __init__(self, repo: ComplianceReportRepository = Depends()):
        self.repo = repo

    @service_handler
    async def get_compliance_report_summary(self, report_id: int) -> Dict[str, List[ComplianceReportSummaryRowSchema]]:
        """Generate the comprehensive compliance report summary for a specific compliance report by ID."""

        fossil_quantities = await self.repo.get_fossil_quantities(report_id)
        renewable_quantities = await self.repo.get_renewable_quantities(report_id)
        previous_retained = await self.repo.get_previous_retained(report_id)
        notional_transfers = await self.repo.get_notional_transfers(report_id)

        fossil_quantities = {'gasoline': 10000, 'diesel': 20000, 'jet_fuel': 3000}
        renewable_quantities = {'gasoline': 5000, 'diesel': 15000, 'jet_fuel': 1000}
        previous_retained = {'gasoline': 200, 'diesel': 400, 'jet_fuel': 100}


        notional_transfers_sums = {
            'gasoline': 0,
            'diesel': 0,
            'jet_fuel': 0
        }

        for transfer in notional_transfers.notional_transfers:
            normalized_category = transfer.fuel_category.replace(" ", "_").lower()
            if normalized_category in notional_transfers_sums:
                notional_transfers_sums[normalized_category] += transfer.quantity

        renewable_fuel_target_summary = self.calculate_renewable_fuel_target_summary(
            fossil_quantities, renewable_quantities, previous_retained, notional_transfers_sums)
        low_carbon_fuel_target_summary = self.calculate_low_carbon_fuel_target_summary()
        non_compliance_penalty_summary = self.calculate_non_compliance_penalty_summary()

        summary = {
            'renewableFuelTargetSummary': renewable_fuel_target_summary,
            'lowCarbonFuelTargetSummary': low_carbon_fuel_target_summary,
            'nonCompliancePenaltySummary': non_compliance_penalty_summary
        }

        return summary

    def calculate_renewable_fuel_target_summary(self, fossil_quantities: dict, renewable_quantities: dict, previous_retained: dict, notional_transfers_sums: dict) -> List[ComplianceReportSummaryRowSchema]:
        tracked_totals = {
            category: fossil_quantities.get(
                category, 0) + renewable_quantities.get(category, 0)
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        eligible_renewable_required = 40000

        notionally_transferred_renewables = {
            'gasoline': 1000, 'diesel': 1500, 'jet_fuel': 2000}

        retained_renewables = {
            category: min(0.05 * eligible_renewable_required,
                          previous_retained.get(category, 0))
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        deferred_renewables = {'gasoline': 9000,
                               'diesel': 2000, 'jet_fuel': 5000}

        renewables_added = {'gasoline': 1000, 'diesel': 2000, 'jet_fuel': 3000}

        net_renewable_supplied = {
            category:
                renewable_quantities.get(category, 0) +
                notionally_transferred_renewables.get(category, 0) -
                retained_renewables.get(category, 0) +
                previous_retained.get(category, 0) +
                deferred_renewables.get(category, 0) -
                renewables_added.get(category, 0)
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        non_compliance_penalties = {
            category: max(0, eligible_renewable_required -
                          net_renewable_supplied.get(category, 0)) * PRESCRIBED_PENALTY_RATE[category]
            for category in ['gasoline', 'diesel', 'jet_fuel']
        }

        summary_lines = {
            '1': {'gasoline': fossil_quantities.get('gasoline', 0), 'diesel': fossil_quantities.get('diesel', 0), 'jet_fuel': fossil_quantities.get('jet_fuel', 0)},
            '2': {'gasoline': renewable_quantities.get('gasoline', 0), 'diesel': renewable_quantities.get('diesel', 0), 'jet_fuel': renewable_quantities.get('jet_fuel', 0)},
            '3': {'gasoline': tracked_totals.get('gasoline', 0), 'diesel': tracked_totals.get('diesel', 0), 'jet_fuel': tracked_totals.get('jet_fuel', 0)},
            '4': {'gasoline': eligible_renewable_required, 'diesel': eligible_renewable_required, 'jet_fuel': eligible_renewable_required},
            '5': notional_transfers_sums,
            '6': {'gasoline': retained_renewables.get('gasoline', 0), 'diesel': retained_renewables.get('diesel', 0), 'jet_fuel': retained_renewables.get('jet_fuel', 0)},
            '7': {'gasoline': previous_retained.get('gasoline', 0), 'diesel': previous_retained.get('diesel', 0), 'jet_fuel': previous_retained.get('jet_fuel', 0)},
            '8': {'gasoline': deferred_renewables.get('gasoline', 0), 'diesel': deferred_renewables.get('diesel', 0), 'jet_fuel': deferred_renewables.get('jet_fuel', 0)},
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

    def calculate_low_carbon_fuel_target_summary(self) -> List[ComplianceReportSummaryRowSchema]:

        complianceUnitsExport = 200 * -1

        low_carbon_summary_lines = {
            '12': {'value': 7310},
            '13': {'value': 6650},
            '14': {'value': 660},
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
