from collections import defaultdict

import asyncio
import structlog
from datetime import datetime
from fastapi import Depends
from sqlalchemy import (
    func,
    select,
    and_,
    asc,
    desc,
    update,
    String,
    cast,
    or_,
    delete,
    exists,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import joinedload
from typing import List, Optional, Dict, Union, TypedDict, Type

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.comment import ComplianceReportInternalComment
from lcfs.db.models.compliance import (
    CompliancePeriod,
    ComplianceReportListView,
    ComplianceReportOrganizationSnapshot,
    FinalSupplyEquipment,
)
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    SupplementalInitiatorType,
    compliance_report_document_association,
)
from lcfs.db.models.compliance.ComplianceReportHistory import ComplianceReportHistory
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.user.Role import RoleEnum
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    ComplianceReportViewSchema,
    ComplianceReportSummaryUpdateSchema,
)
from lcfs.web.api.fuel_supply.repo import FuelSupplyRepository
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import repo_handler

from lcfs.web.api.compliance_report.dtos import (
    ChangelogFuelSuppliesDTO,
    ChangelogOtherUsesDTO,
    ChangelogAllocationAgreementsDTO,
    ChangelogFuelExportsDTO,
    ChangelogNotionalTransfersDTO,
)

logger = structlog.get_logger(__name__)


class ComplianceReportRepository:
    def __init__(
        self,
        db: AsyncSession = Depends(get_async_db_session),
        fuel_supply_repo: FuelSupplyRepository = Depends(),
    ):
        self.db = db
        self.fuel_supply_repo = fuel_supply_repo

    def apply_filters(self, pagination, conditions):
        for filter in pagination.filters:
            filter_value = filter.filter
            # check if the date string is selected for filter
            if filter.filter is None:
                filter_value = [
                    datetime.strptime(filter.date_from, "%Y-%m-%d %H:%M:%S").strftime(
                        "%Y-%m-%d"
                    )
                ]
                if filter.date_to:
                    filter_value.append(
                        datetime.strptime(filter.date_to, "%Y-%m-%d %H:%M:%S").strftime(
                            "%Y-%m-%d"
                        )
                    )
            filter_option = filter.type
            filter_type = filter.filter_type
            if filter.field == "status":
                field = cast(
                    get_field_for_filter(ComplianceReportListView, "report_status"),
                    String,
                )
                # Check if filter_value is a comma-separated string
                if isinstance(filter_value, str) and "," in filter_value:
                    filter_value = filter_value.split(",")  # Convert to list

                if isinstance(filter_value, list):

                    def underscore_string(val):
                        """
                        If the item is an enum member, get its `.value`
                        Then do .replace(" ", "_") so we get underscores
                        """
                        if isinstance(val, ComplianceReportStatusEnum):
                            val = val.value  # convert enum to string
                        return val.replace(" ", "_")

                    filter_value = [underscore_string(val) for val in filter_value]
                    filter_type = "set"
                else:
                    if isinstance(filter_value, ComplianceReportStatusEnum):
                        filter_value = filter_value.value
                    filter_value = filter_value.replace(" ", "_")

            elif filter.field == "type":
                field = get_field_for_filter(ComplianceReportListView, "report_type")
            elif filter.field == "organization":
                field = get_field_for_filter(
                    ComplianceReportListView, "organization_name"
                )
            elif filter.field == "compliance_period":
                field = get_field_for_filter(
                    ComplianceReportListView, "compliance_period"
                )
            else:
                field = get_field_for_filter(ComplianceReportListView, filter.field)

            conditions.append(
                apply_filter_conditions(field, filter_value, filter_option, filter_type)
            )

    @repo_handler
    async def get_all_compliance_periods(self) -> List[CompliancePeriod]:
        # Retrieve all compliance periods from the database
        periods = (
            (
                await self.db.execute(
                    select(CompliancePeriod)
                    .where(CompliancePeriod.effective_status == True)
                    .order_by(CompliancePeriod.display_order.desc())
                )
            )
            .scalars()
            .all()
        )
        current_year = str(datetime.now().year)

        # Check if the current year is already in the list of periods
        if not any(period.description == current_year for period in periods):
            # Get the current maximum display_order value
            max_display_order = await self.db.execute(
                select(func.max(CompliancePeriod.display_order))
            )
            max_display_order_value = max_display_order.scalar() or 0
            # Insert the current year if it doesn't exist
            new_period = CompliancePeriod(
                description=current_year,
                effective_date=datetime.now().date(),
                display_order=max_display_order_value + 1,
            )
            self.db.add(new_period)

            # Retrieve the updated list of compliance periods
            periods = (
                (
                    await self.db.execute(
                        select(CompliancePeriod)
                        .where(CompliancePeriod.effective_status == True)
                        .order_by(CompliancePeriod.display_order.desc())
                    )
                )
                .scalars()
                .all()
            )

        return periods

    @repo_handler
    async def get_compliance_period(self, period: str) -> CompliancePeriod:
        """
        Retrieve a compliance period from the database
        """
        result = await self.db.scalar(
            select(CompliancePeriod).where(CompliancePeriod.description == period)
        )
        return result

    @repo_handler
    async def check_compliance_report(
        self, compliance_report_id: int
    ) -> Optional[ComplianceReport]:
        """
        Identify and retrieve the compliance report by id, including its related objects.
        """
        return await self.db.scalar(
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.organization),
                joinedload(ComplianceReport.compliance_period),
                joinedload(ComplianceReport.current_status),
                joinedload(ComplianceReport.summary),
                joinedload(ComplianceReport.fuel_supplies),
                joinedload(ComplianceReport.other_uses),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.status
                ),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.user_profile
                ),
                joinedload(ComplianceReport.transaction),
            )
            .where(ComplianceReport.compliance_report_id == compliance_report_id)
        )

    @repo_handler
    async def get_compliance_report_status_by_desc(
        self, status: str
    ) -> ComplianceReportStatus:
        """
        Retrieve the compliance report status ID from the database based on the description.
        Replaces spaces with underscores in the status description.
        """
        status_enum = status.replace(" ", "_")  # frontend sends status with spaces
        result = await self.db.execute(
            select(ComplianceReportStatus).where(
                ComplianceReportStatus.status
                == getattr(ComplianceReportStatusEnum, status_enum)
            )
        )
        return result.scalars().first()

    @repo_handler
    async def get_compliance_report_by_period(self, organization_id: int, period: str):
        """
        Identify and retrieve the compliance report of an organization for the given compliance period
        """
        result = await self.db.scalar(
            select(ComplianceReport.compliance_report_id).where(
                and_(
                    ComplianceReport.organization_id == organization_id,
                    CompliancePeriod.description == period,
                    ComplianceReport.compliance_period_id
                    == CompliancePeriod.compliance_period_id,
                )
            )
        )
        return result is not None

    @repo_handler
    async def get_assessed_compliance_report_by_period(
        self, organization_id: int, period: int
    ):
        """
        Identify and retrieve the compliance report of an organization for the given compliance period
        """
        result = (
            (
                await self.db.execute(
                    select(ComplianceReport)
                    .options(
                        joinedload(ComplianceReport.organization),
                        joinedload(ComplianceReport.compliance_period),
                        joinedload(ComplianceReport.current_status),
                        joinedload(ComplianceReport.summary),
                    )
                    .join(
                        CompliancePeriod,
                        ComplianceReport.compliance_period_id
                        == CompliancePeriod.compliance_period_id,
                    )
                    .join(
                        Organization,
                        ComplianceReport.organization_id
                        == Organization.organization_id,
                    )
                    .join(
                        ComplianceReportStatus,
                        ComplianceReport.current_status_id
                        == ComplianceReportStatus.compliance_report_status_id,
                    )
                    .outerjoin(
                        ComplianceReportSummary,
                        ComplianceReport.compliance_report_id
                        == ComplianceReportSummary.compliance_report_id,
                    )
                    .where(
                        and_(
                            ComplianceReport.organization_id == organization_id,
                            CompliancePeriod.description == str(period),
                            ComplianceReportStatus.status
                            == ComplianceReportStatusEnum.Assessed,
                        )
                    )
                )
            )
            .unique()
            .scalars()
            .first()
        )
        return result

    @repo_handler
    async def create_compliance_report(self, report: ComplianceReport):
        """
        Add a new compliance report to the database
        """
        self.db.add(report)
        await self.db.flush()
        await self.db.refresh(
            report,
            [
                "compliance_period",
                "fuel_supplies",
                "fuel_exports",
                "history",
                "notional_transfers",
                "organization",
                "other_uses",
                "current_status",
                "summary",
            ],
        )
        return ComplianceReportBaseSchema.model_validate(report)

    @repo_handler
    async def get_existing_history_for_status(
        self, compliance_report_id: int, current_status_id: int
    ):
        history = await self.db.execute(
            select(ComplianceReportHistory)
            .where(
                and_(
                    ComplianceReportHistory.compliance_report_id
                    == compliance_report_id,
                    ComplianceReportHistory.status_id == current_status_id,
                )
            )
            .order_by(ComplianceReportHistory.create_date.desc())
        )
        return history.scalar_one_or_none()

    @repo_handler
    async def add_compliance_report_history(
        self, report: ComplianceReport, user: UserProfile
    ):
        """
        Add a new compliance report history record to the database
        """
        history = await self.get_existing_history_for_status(
            report.compliance_report_id, report.current_status_id
        )
        if history:
            history.update_date = datetime.now()
            history.create_date = datetime.now()
            history.status_id = report.current_status_id
            history.user_profile_id = user.user_profile_id
            history.display_name = f"{user.first_name} {user.last_name}"
        else:
            history = ComplianceReportHistory(
                compliance_report_id=report.compliance_report_id,
                status_id=report.current_status_id,
                user_profile_id=user.user_profile_id,
                display_name=f"{user.first_name} {user.last_name}",
            )
        self.db.add(history)
        await self.db.flush()
        return history

    @repo_handler
    async def get_reports_paginated(
        self,
        pagination: PaginationRequestSchema,
        user: UserProfile,
    ):
        """
        Retrieve a paginated list of the latest compliance reports from each compliance_report_group_uuid.
        Supports pagination, filtering, and sorting.
        """
        conditions = []
        excluded_statuses = []

        is_analyst = user_has_roles(user, [RoleEnum.ANALYST])
        if not is_analyst:
            excluded_statuses.append(ComplianceReportStatusEnum.Analyst_adjustment)

        is_supplier = user_has_roles(user, [RoleEnum.SUPPLIER])
        if not is_supplier:
            excluded_statuses.append(ComplianceReportStatusEnum.Draft)

        query = await self.get_latest_visible_reports_query(
            excluded_statuses, user.organization_id
        )

        if pagination.filters and len(pagination.filters) > 0:
            self.apply_filters(pagination, conditions)

        # Pagination and offset setup
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

        # Build the main query
        query = query.where(and_(*conditions))

        # Apply sorting from pagination
        if len(pagination.sort_orders) < 1:
            field = get_field_for_filter(ComplianceReportListView, "update_date")
            query = query.order_by(desc(field))

        for order in pagination.sort_orders:
            sort_method = asc if order.direction == "asc" else desc
            if order.field == "status":
                order.field = get_field_for_filter(
                    ComplianceReportListView, "report_status"
                )
            elif order.field == "organization":
                order.field = get_field_for_filter(
                    ComplianceReportListView, "organization_name"
                )
            elif order.field == "type":
                order.field = get_field_for_filter(
                    ComplianceReportListView, "report_type"
                )
            else:
                order.field = get_field_for_filter(
                    ComplianceReportListView, order.field
                )
            query = query.order_by(sort_method(order.field))

        # Execute query with offset and limit for pagination
        query_result = (
            (await self.db.execute(query.offset(offset).limit(limit)))
            .unique()
            .scalars()
            .all()
        )
        # Calculate total number of compliance reports available
        total_count_query = select(func.count()).select_from(query)
        total_count = (await self.db.execute(total_count_query)).scalar()

        # Transform results into Pydantic schemas
        reports = [
            ComplianceReportViewSchema.model_validate(report) for report in query_result
        ]
        return reports, total_count

    @repo_handler
    async def get_compliance_report_by_id(self, report_id: int, is_model: bool = False):
        """
        Retrieve a compliance report from the database by ID
        """
        result = await self.db.execute(
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.organization),
                joinedload(ComplianceReport.compliance_period),
                joinedload(ComplianceReport.current_status),
                joinedload(ComplianceReport.summary),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.status
                ),
                joinedload(ComplianceReport.history)
                .joinedload(ComplianceReportHistory.user_profile)
                .joinedload(UserProfile.organization),
                joinedload(ComplianceReport.transaction),
            )
            .where(ComplianceReport.compliance_report_id == report_id)
        )

        compliance_report = result.scalars().unique().first()

        if not compliance_report:
            return None

        if is_model:
            return compliance_report

        return ComplianceReportBaseSchema.model_validate(compliance_report)

    @repo_handler
    async def get_compliance_report_chain(
        self, group_uuid: str, version: Optional[int] = None
    ):
        # Build base query with all necessary joins
        query = (
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.organization),
                joinedload(ComplianceReport.compliance_period),
                joinedload(ComplianceReport.current_status),
                joinedload(ComplianceReport.summary),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.status
                ),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.user_profile
                ),
                joinedload(ComplianceReport.transaction),
            )
            .where(ComplianceReport.compliance_report_group_uuid == group_uuid)
        )

        # Apply version filter only if version is provided
        if version is not None:
            query = query.where(ComplianceReport.version <= version)

        # Ensure ordering by version
        query = query.order_by(ComplianceReport.version.desc())

        result = await self.db.execute(query)

        compliance_reports = result.scalars().unique().all()

        return [
            ComplianceReportBaseSchema.model_validate(report)
            for report in compliance_reports
        ]

    @repo_handler
    async def get_fuel_type(self, fuel_type_id: int) -> FuelType:
        return await self.db.scalar(
            select(FuelType).where(FuelType.fuel_type_id == fuel_type_id)
        )

    @repo_handler
    async def get_fuel_category(self, fuel_category_id: int) -> FuelCategory:
        return await self.db.scalar(
            select(FuelCategory).where(
                FuelCategory.fuel_category_id == fuel_category_id
            )
        )

    @repo_handler
    async def get_expected_use(self, expected_use_type_id: int) -> ExpectedUseType:
        return await self.db.scalar(
            select(ExpectedUseType).where(
                ExpectedUseType.expected_use_type_id == expected_use_type_id
            )
        )

    @repo_handler
    async def update_compliance_report(
        self, report: ComplianceReport
    ) -> ComplianceReportBaseSchema:
        """Persists the changes made to the ComplianceReport object to the database."""
        try:
            await self.db.flush()

            # Reload the report with all necessary relationships
            refreshed_report = await self.db.scalar(
                select(ComplianceReport)
                .options(
                    joinedload(ComplianceReport.compliance_period),
                    joinedload(ComplianceReport.organization),
                    joinedload(ComplianceReport.current_status),
                    joinedload(ComplianceReport.summary),
                    joinedload(ComplianceReport.history).joinedload(
                        ComplianceReportHistory.status
                    ),
                    joinedload(ComplianceReport.history).joinedload(
                        ComplianceReportHistory.user_profile
                    ),
                )
                .where(
                    ComplianceReport.compliance_report_id == report.compliance_report_id
                )
            )

            if not refreshed_report:
                raise ValueError(
                    f"Could not reload report {report.compliance_report_id}"
                )

            return ComplianceReportBaseSchema.model_validate(refreshed_report)

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating compliance report: {e}")
            raise

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

    # @repo_handler
    # async def get_summary_versions(self, report_id: int):
    #     query = (
    #         select(
    #             ComplianceReportSummary.summary_id,
    #             ComplianceReportSummary.version,
    #             case(
    #                 (
    #                     ComplianceReportSummary.supplemental_report_id.is_(None),
    #                     "Original",
    #                 ),
    #                 else_="Supplemental",
    #             ).label("type"),
    #         )
    #         .where(ComplianceReportSummary.compliance_report_id == report_id)
    #         .order_by(ComplianceReportSummary.version)
    #     )

    #     result = await self.db.execute(query)
    #     return result.all()

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
                fuel_quantities[fuel_category] += record.quantity
            elif (
                isinstance(record, OtherUses)
                and record.fuel_type.fossil_derived == fossil_derived
            ):
                fuel_category = self._format_category(record.fuel_category.category)
                fuel_quantities[fuel_category] += record.quantity_supplied

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

    @repo_handler
    async def aggregate_allocation_agreements(
        self, compliance_report_id: int
    ) -> Dict[str, float]:
        """Aggregate quantities from allocation agreements for renewable fuels."""
        query = (
            select(
                FuelCategory.category,
                func.coalesce(func.sum(AllocationAgreement.quantity), 0).label(
                    "quantity"
                ),
            )
            .select_from(AllocationAgreement)
            .join(FuelType, AllocationAgreement.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                AllocationAgreement.fuel_category_id == FuelCategory.fuel_category_id,
            )
            .where(
                AllocationAgreement.compliance_report_id == compliance_report_id,
                FuelType.fossil_derived.is_(False),
                FuelType.other_uses_fossil_derived.is_(False),
            )
            .group_by(FuelCategory.category)
        )

        result = await self.db.execute(query)
        return {self._format_category(row.category): row.quantity for row in result}

    @staticmethod
    def _format_category(category: str) -> str:
        """Format the fuel category string."""
        return category.lower().replace(" ", "_")

    @repo_handler
    async def get_all_org_reported_years(self, organization_id: int):

        return (
            (
                await self.db.execute(
                    select(CompliancePeriod)
                    .join(
                        ComplianceReport,
                        ComplianceReport.compliance_period_id
                        == CompliancePeriod.compliance_period_id,
                    )
                    .where(ComplianceReport.organization_id == organization_id)
                )
            )
            .scalars()
            .all()
        )

    @repo_handler
    async def get_latest_report_by_group_uuid(
        self, group_uuid: str
    ) -> Optional[ComplianceReport]:
        """
        Retrieve the latest compliance report for a given group_uuid.
        This returns the report with the highest version number within the group.
        """
        result = await self.db.execute(
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.organization),
                joinedload(ComplianceReport.compliance_period),
                joinedload(ComplianceReport.current_status),
                joinedload(ComplianceReport.summary),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.status
                ),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.user_profile
                ),
            )
            .where(ComplianceReport.compliance_report_group_uuid == group_uuid)
            .order_by(ComplianceReport.version.desc())
            .limit(1)
        )
        return result.scalars().first()

    async def get_compliance_report_by_legacy_id(self, legacy_id):
        """
        Retrieve a compliance report from the database by ID
        """
        result = await self.db.execute(
            select(ComplianceReport)
            .options(
                joinedload(ComplianceReport.organization),
                joinedload(ComplianceReport.compliance_period),
                joinedload(ComplianceReport.current_status),
                joinedload(ComplianceReport.summary),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.status
                ),
                joinedload(ComplianceReport.history).joinedload(
                    ComplianceReportHistory.user_profile
                ),
                joinedload(ComplianceReport.transaction),
            )
            .where(ComplianceReport.legacy_id == legacy_id)
        )
        return result.scalars().unique().first()

    @repo_handler
    async def get_compliance_report_group_id(self, report_id):
        """
        Retrieve the compliance report group ID
        """
        result = await self.db.scalar(
            select(ComplianceReport.compliance_report_group_uuid).where(
                ComplianceReport.compliance_report_id == report_id
            )
        )
        return result

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
        return result.scalars().first().summary

    @repo_handler
    async def delete_compliance_report(self, compliance_report_id: int) -> bool:
        """
        Deletes a compliance report and all its related data by ID using concurrent operations.

        This performs a cascading delete of all related entities including:
        - ComplianceReportSummary
        - ComplianceReportHistory
        - ComplianceReportInternalComment
        - NotionalTransfer
        - FuelSupply
        - FuelExport
        - AllocationAgreement
        - OtherUses
        - FinalSupplyEquipment
        - ComplianceReportOrganizationSnapshot
        - Document associations
        """
        # Create a list of delete operations
        delete_operations = [
            # Child tables with no interdependencies
            self.db.execute(
                delete(compliance_report_document_association).where(
                    compliance_report_document_association.c.compliance_report_id
                    == compliance_report_id
                )
            ),
            self.db.execute(
                delete(ComplianceReportOrganizationSnapshot).where(
                    ComplianceReportOrganizationSnapshot.compliance_report_id
                    == compliance_report_id
                )
            ),
            self.db.execute(
                delete(ComplianceReportSummary).where(
                    ComplianceReportSummary.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(ComplianceReportHistory).where(
                    ComplianceReportHistory.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(ComplianceReportInternalComment).where(
                    ComplianceReportInternalComment.compliance_report_id
                    == compliance_report_id
                )
            ),
            self.db.execute(
                delete(NotionalTransfer).where(
                    NotionalTransfer.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(FuelSupply).where(
                    FuelSupply.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(FuelExport).where(
                    FuelExport.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(AllocationAgreement).where(
                    AllocationAgreement.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(OtherUses).where(
                    OtherUses.compliance_report_id == compliance_report_id
                )
            ),
            self.db.execute(
                delete(FinalSupplyEquipment).where(
                    FinalSupplyEquipment.compliance_report_id == compliance_report_id
                )
            ),
        ]

        # Execute all child table deletes concurrently
        await asyncio.gather(*delete_operations)

        # After all child records are deleted, delete the parent report
        await self.db.execute(
            delete(ComplianceReport).where(
                ComplianceReport.compliance_report_id == compliance_report_id
            )
        )

        await self.db.flush()
        logger.info(f"Successfully deleted compliance report {compliance_report_id}")
        return True

    async def get_latest_visible_reports_query(
        self,
        excluded_statuses: List[ComplianceReportStatusEnum],
        user_organization_id=None,
    ):
        # Build a correlated subquery to determine the maximum version for each group,
        # filtering only reports with a status not in the excluded list.

        status_ids = []
        for status in excluded_statuses:
            status = await self.get_compliance_report_status_by_desc(status.value)
            status_ids.append(status.compliance_report_status_id)

        max_version_subq = (
            select(func.max(ComplianceReport.version))
            .where(
                ComplianceReportListView.compliance_report_group_uuid
                == ComplianceReport.compliance_report_group_uuid,
                ComplianceReport.current_status_id.notin_(status_ids),
            )
            .scalar_subquery()
        )

        # Hide government reports unless they are assessed
        if user_organization_id is not None:
            assessed = await self.get_compliance_report_status_by_desc(
                ComplianceReportStatusEnum.Assessed.value
            )
            max_version_subq = max_version_subq.where(
                or_(
                    ComplianceReport.current_status_id
                    == assessed.compliance_report_status_id,
                    or_(
                        ComplianceReport.supplemental_initiator
                        != SupplementalInitiatorType.GOVERNMENT_REASSESSMENT,
                        ComplianceReport.supplemental_initiator.is_(None),
                    ),
                )
            )

        # Build the main query filtering out excluded statuses and ensuring that
        # the report version equals the maximum visible version for that group.
        query = select(ComplianceReportListView).where(
            ComplianceReportListView.report_status_id.notin_(status_ids),
            ComplianceReportListView.version == max_version_subq,
        )

        # Optionally filter by organization_id if it is provided.
        if user_organization_id is not None:
            query = query.where(
                ComplianceReportListView.organization_id == user_organization_id
            )

        return query

    @repo_handler
    async def get_compliance_report_statuses(self):
        """
        Retrieve all compliance report statuses from the database
        """
        result = await self.db.execute(select(ComplianceReportStatus))
        return result.scalars().all()

    class ConfigType(TypedDict):
        field: str
        model: Type
        dto_class: Type
        id_field: str
        relationships: List[tuple[str, str]]

    @repo_handler
    async def get_changelog_data(
        self,
        compliance_report_group_uuid: str,
        config: ConfigType,
    ) -> List:
        try:

            model = config["model"]
            dto = config["dto"]
            relationships = config["relationships"]

            # Build the subquery
            subquery = (
                select(model.compliance_report_id)
                .where(
                    model.compliance_report_id == ComplianceReport.compliance_report_id
                )
                .limit(1)
            )

            # Build the main query
            reports_query = (
                select(ComplianceReport)
                .where(
                    ComplianceReport.compliance_report_group_uuid
                    == compliance_report_group_uuid,
                    exists(subquery),
                )
                .options(
                    *[
                        joinedload(getattr(ComplianceReport, rel)).joinedload(
                            getattr(model, sub_rel)
                        )
                        for rel, sub_rel in relationships
                    ]
                )
                .order_by(ComplianceReport.version.desc())
            )

            # Execute the query and fetch results
            reports = (await self.db.execute(reports_query)).scalars().unique().all()

            # Return the results as DTO objects
            return [dto.model_validate(report) for report in reports]
        except Exception as e:
            logger.error(f"Error in get_changelog_data: {e}", exc_info=True)
            raise
