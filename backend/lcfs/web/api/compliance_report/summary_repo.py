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
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportSummaryUpdateSchema,
)
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.core.decorators import repo_handler

logger = structlog.get_logger(__name__)


class ComplianceReportSummaryRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        fuel_supply_repo: FuelSupplyRepository = Depends(),
    ):
        self.db = db
        self.fuel_supply_repo = fuel_supply_repo

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
        self, summary: ComplianceReportSummaryUpdateSchema
    ):
        """
        Save the compliance report summary to the database.

        :param summary: The generated summary data
        """
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
        non_compliance_summary = summary.non_compliance_penalty_summary
        for row in non_compliance_summary:
            if row.line == 11:
                summary_obj.line_11_fossil_derived_base_fuel_total = row.total_value
            elif row.line == 21:
                summary_obj.line_21_non_compliance_penalty_payable = row.total_value
            elif row.line is None:  # Total row
                summary_obj.total_non_compliance_penalty_payable = row.total_value

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

    @repo_handler
    async def aggregate_other_uses_quantity(
        self, compliance_report_id: int, fossil_derived: bool
    ) -> Dict[str, float]:
        """Aggregate quantities from other uses."""
        query = (
            select(
                FuelCategory.category,
                func.coalesce(func.sum(OtherUses.quantity_supplied), 0).label(
                    "quantity"
                ),
            )
            .select_from(OtherUses)
            .join(FuelType, OtherUses.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                OtherUses.fuel_category_id == FuelCategory.fuel_category_id,
            )
            .where(
                OtherUses.compliance_report_id == compliance_report_id,
                FuelType.fossil_derived.is_(fossil_derived),
                FuelType.other_uses_fossil_derived.is_(fossil_derived),
            )
            .group_by(FuelCategory.category)
        )

        result = await self.db.execute(query)
        return {self._format_category(row.category): row.quantity for row in result}

    @staticmethod
    def _format_category(category: str) -> str:
        """Format the fuel category string."""
        return category.lower().replace(" ", "_")
