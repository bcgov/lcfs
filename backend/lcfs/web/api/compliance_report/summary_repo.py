from collections import defaultdict

import structlog
from datetime import datetime
from fastapi import Depends
from sqlalchemy import (
    select,
    update,
    func,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import Dict
from typing import List, Union

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models import (
    InitiativeAgreement,
    Transfer,
    OtherUses,
    FuelCategory,
    FuelType,
    FuelSupply,
)
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryUpdateSchema,
)
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.core.decorators import repo_handler
from lcfs.web.exception.exceptions import ServiceException

logger = structlog.get_logger(__name__)


class ComplianceReportSummaryRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        fuel_supply_repo: FuelSupplyRepository = Depends(),
    ):
        self.db = db
        self.fuel_supply_repo = fuel_supply_repo

    async def _validate_lines_7_and_9_locked(
        self, 
        summary: ComplianceReportSummaryUpdateSchema, 
        compliance_report: ComplianceReport
    ) -> None:
        """
        Validate that Lines 7 and 9 are not being modified for 2025+ reports with previous assessed report.
        
        Args:
            summary: The summary update data
            compliance_report: The compliance report being updated
            
        Raises:
            ServiceException: If Lines 7 or 9 are being modified when they should be locked
        """
        compliance_year = int(compliance_report.compliance_period.description)
        
        # Only validate for 2025+ reports
        if compliance_year < 2025:
            return
            
        # Check for previous assessed report
        from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
        cr_repo = ComplianceReportRepository(self.db)
        prev_compliance_report = None
        
        if not compliance_report.supplemental_initiator:
            prev_compliance_report = await cr_repo.get_assessed_compliance_report_by_period(
                compliance_report.organization_id,
                compliance_year - 1
            )
        
        # If no previous assessed report, Lines 7 and 9 are editable
        if not prev_compliance_report:
            return
            
        # Get current summary values to compare against
        existing_summary = await self.get_summary_by_report_id(summary.compliance_report_id)
        if not existing_summary:
            return
            
        # Check if Lines 7 or 9 are being modified (they should be locked)
        for row in summary.renewable_fuel_target_summary:
            try:
                line_number = int(row.line)
                if line_number == 7:
                    # Line 7 should be locked - check if values are being changed
                    for fuel_type in ["gasoline", "diesel", "jet_fuel"]:
                        new_value = getattr(row, fuel_type, 0) or 0
                        existing_column = f"line_7_previously_retained_{fuel_type}"
                        existing_value = getattr(existing_summary, existing_column, 0) or 0
                        
                        # Allow small floating point differences
                        if abs(float(new_value) - float(existing_value)) > 0.01:
                            raise ServiceException(
                                f"Line 7 is locked for 2025+ reports when a previous assessed report exists. "
                                f"Cannot modify {fuel_type} value from {existing_value} to {new_value}. "
                                f"This line is automatically populated from Line 6 of the previous year's assessed report."
                            )
                elif line_number == 9:
                    # Line 9 should be locked - check if values are being changed
                    for fuel_type in ["gasoline", "diesel", "jet_fuel"]:
                        new_value = getattr(row, fuel_type, 0) or 0
                        existing_column = f"line_9_obligation_added_{fuel_type}"
                        existing_value = getattr(existing_summary, existing_column, 0) or 0
                        
                        # Allow small floating point differences
                        if abs(float(new_value) - float(existing_value)) > 0.01:
                            raise ServiceException(
                                f"Line 9 is locked for 2025+ reports when a previous assessed report exists. "
                                f"Cannot modify {fuel_type} value from {existing_value} to {new_value}. "
                                f"This line is automatically populated from Line 8 of the previous year's assessed report."
                            )
            except (ValueError, TypeError):
                # Skip non-numeric line numbers
                continue

    @repo_handler
    async def add_compliance_report_summary(
        self, summary: ComplianceReportSummary
    ) -> ComplianceReportSummary:
        """
        Adds a new compliance report summary to the database.
        """
        self.db.add(summary)
        await self.db.flush()
        await self.db.refresh(summary)
        return summary

    @repo_handler
    async def reset_summary_lock(self, compliance_report_id: int):
        query = (
            update(ComplianceReportSummary)
            .where(ComplianceReportSummary.compliance_report_id == compliance_report_id)
            .values(is_locked=False)
        )
        await self.db.execute(query)
        return True

    @repo_handler
    async def save_compliance_report_summary(
        self, summary: ComplianceReportSummaryUpdateSchema, compliance_year: int = None
    ):
        """
        Save the compliance report summary to the database.

        :param summary: The generated summary data
        """
        # Get compliance report to validate locked fields
        compliance_report_query = select(ComplianceReport).where(
            ComplianceReport.compliance_report_id == summary.compliance_report_id
        ).options(joinedload(ComplianceReport.current_status))
        result = await self.db.execute(compliance_report_query)
        compliance_report = result.scalar_one_or_none()
        
        if not compliance_report:
            raise ValueError(f"No compliance report found with ID {summary.compliance_report_id}")
            
        # Validate Lines 7 and 9 for 2025+ reports
        await self._validate_lines_7_and_9_locked(summary, compliance_report)
        
        existing_summary = await self.get_summary_by_report_id(
            summary.compliance_report_id
        )

        if existing_summary:
            summary_obj = existing_summary
        else:
            raise ValueError(
                f"""No summary found with report ID {
                    summary.compliance_report_id}"""
            )

        summary_obj.is_locked = summary.is_locked
        # Update renewable fuel target summary
        for row in summary.renewable_fuel_target_summary:
            line_number = row.line
            for fuel_type in ["gasoline", "diesel", "jet_fuel"]:
                column_name = f"""line_{line_number}_{
                    row.field.lower()}_{fuel_type}"""
                setattr(summary_obj, column_name, int(getattr(row, fuel_type)))

        # Update low carbon fuel target summary
        for row in summary.low_carbon_fuel_target_summary:
            column_name = f"line_{row.line}_{row.field}"
            setattr(
                summary_obj,
                column_name,
                int(row.value),
            )

        # Update non-compliance penalty summary
        # Skip updating calculated penalty columns when penalty override is enabled
        # to preserve original calculated values
        penalty_override_enabled = getattr(summary, 'penalty_override_enabled', False)
        
        if not penalty_override_enabled:
            non_compliance_summary = summary.non_compliance_penalty_summary
            for row in non_compliance_summary:
                if row.line == 11:
                    summary_obj.line_11_fossil_derived_base_fuel_total = row.total_value
                elif row.line == 21:
                    summary_obj.line_21_non_compliance_penalty_payable = row.total_value
                elif row.line is None:  # Total row
                    summary_obj.total_non_compliance_penalty_payable = row.total_value

        # Update penalty override fields - only for 2024 reports and later
        if compliance_year and compliance_year >= 2024:
            if hasattr(summary, 'penalty_override_enabled'):
                summary_obj.penalty_override_enabled = summary.penalty_override_enabled
            if hasattr(summary, 'renewable_penalty_override'):
                summary_obj.renewable_penalty_override = summary.renewable_penalty_override
            if hasattr(summary, 'low_carbon_penalty_override'):
                summary_obj.low_carbon_penalty_override = summary.low_carbon_penalty_override
            if hasattr(summary, 'penalty_override_date'):
                summary_obj.penalty_override_date = summary.penalty_override_date
            if hasattr(summary, 'penalty_override_user'):
                summary_obj.penalty_override_user = summary.penalty_override_user
        else:
            # For pre-2024 reports, ensure penalty override fields are cleared
            summary_obj.penalty_override_enabled = False
            summary_obj.renewable_penalty_override = None
            summary_obj.low_carbon_penalty_override = None
            summary_obj.penalty_override_date = None
            summary_obj.penalty_override_user = None

        # Calculate and update total_non_compliance_penalty_payable based on override state
        if summary_obj.penalty_override_enabled:
            # When override is enabled, total is sum of override values
            renewable_override = summary_obj.renewable_penalty_override or 0
            low_carbon_override = summary_obj.low_carbon_penalty_override or 0
            summary_obj.total_non_compliance_penalty_payable = renewable_override + low_carbon_override
        else:
            # When override is disabled, total is sum of calculated penalty values
            line_11_total = summary_obj.line_11_fossil_derived_base_fuel_total or 0
            line_21_total = summary_obj.line_21_non_compliance_penalty_payable or 0
            summary_obj.total_non_compliance_penalty_payable = line_11_total + line_21_total

        self.db.add(summary_obj)
        await self.db.flush()
        await self.db.refresh(summary_obj)
        return summary_obj

    @repo_handler
    async def get_summary_by_report_id(self, report_id: int) -> ComplianceReportSummary:
        query = select(ComplianceReportSummary).where(
            ComplianceReportSummary.compliance_report_id == report_id
        )

        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_previous_summary(
        self, compliance_report: ComplianceReport
    ) -> ComplianceReportSummary:
        result = await self.db.execute(
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.summary),
            )
            .where(
                ComplianceReport.compliance_report_group_uuid
                == compliance_report.compliance_report_group_uuid,
                ComplianceReport.version == compliance_report.version - 1,
            )
            .limit(1)
        )
        previous_report = result.scalars().first()
        if previous_report is not None:
            return previous_report.summary
        return None

    @repo_handler
    async def get_transferred_out_compliance_units(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
    ) -> int:
        result = await self.db.scalar(
            select(func.sum(Transfer.quantity)).where(
                Transfer.agreement_date.between(
                    compliance_period_start, compliance_period_end
                ),
                Transfer.from_organization_id == organization_id,
                Transfer.current_status_id == 6,  # Recorded
            )
        )
        return result or 0

    @repo_handler
    async def get_received_compliance_units(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
    ) -> int:
        result = await self.db.scalar(
            select(func.sum(Transfer.quantity)).where(
                Transfer.agreement_date.between(
                    compliance_period_start, compliance_period_end
                ),
                Transfer.to_organization_id == organization_id,
                Transfer.current_status_id == 6,  # Recorded
            )
        )
        return result or 0

    @repo_handler
    async def get_issued_compliance_units(
        self,
        compliance_period_start: datetime,
        compliance_period_end: datetime,
        organization_id: int,
    ) -> int:
        result = await self.db.scalar(
            select(func.sum(InitiativeAgreement.compliance_units)).where(
                InitiativeAgreement.transaction_effective_date.between(
                    compliance_period_start, compliance_period_end
                ),
                InitiativeAgreement.to_organization_id == organization_id,
                InitiativeAgreement.current_status_id == 3,  # Approved
            )
        )
        return result or 0

    def aggregate_quantities(
        self, records: List[Union[FuelSupply, OtherUses]], fossil_derived: bool
    ) -> Dict[str, float]:
        """Common aggregation logic for both FuelSupply and OtherUses"""
        fuel_quantities = defaultdict(float)

        for record in records:
            # Check if record matches fossil_derived filter
            if (
                isinstance(record, FuelSupply)
                and record.fuel_type.fossil_derived == fossil_derived
            ):
                fuel_category = self._format_category(record.fuel_category.category)
                fuel_quantities[fuel_category] = fuel_quantities.get(
                    fuel_category, 0
                ) + (record.quantity or 0)
            elif (
                isinstance(record, OtherUses)
                and record.fuel_type.fossil_derived == fossil_derived
            ):
                fuel_category = self._format_category(record.fuel_category.category)
                fuel_quantities[fuel_category] = fuel_quantities.get(
                    fuel_category, 0
                ) + (record.quantity_supplied or 0)

        return dict(fuel_quantities)


    @staticmethod
    def _format_category(category: str) -> str:
        """Format the fuel category string."""
        return category.lower().replace(" ", "_")
