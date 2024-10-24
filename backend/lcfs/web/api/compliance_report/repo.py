from logging import getLogger
from typing import List, Optional, Dict
from collections import defaultdict
from datetime import datetime
from lcfs.db.models.organization.Organization import Organization
from lcfs.db.models.fuel.FuelType import FuelType
from lcfs.db.models.fuel.FuelCategory import FuelCategory
from lcfs.db.models.fuel.ExpectedUseType import ExpectedUseType
from sqlalchemy import func, select, and_, asc, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
    get_enum_value,
)
from lcfs.db.models.compliance import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import (
    ComplianceReport,
    ReportingFrequency,
)
from lcfs.db.models.compliance.ComplianceReportSummary import ComplianceReportSummary
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    ComplianceReportSummarySchema,
)
from lcfs.db.models.compliance.ComplianceReportHistory import ComplianceReportHistory
from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.transfer.Transfer import Transfer
from lcfs.db.models.initiative_agreement.InitiativeAgreement import InitiativeAgreement
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.db.models.compliance.FuelSupply import FuelSupply

logger = getLogger("compliance_reports_repo")


class ComplianceReportRepository:
    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

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
                field = get_field_for_filter(ComplianceReportStatus, "status")
                normalized_value = filter_value.lower()
                enum_value_map = {
                    enum_val.value.lower(): enum_val
                    for enum_val in ComplianceReportStatusEnum
                }
                filter_value = enum_value_map.get(normalized_value)
            elif filter.field == "organization":
                field = get_field_for_filter(Organization, "name")
            elif filter.field == "type":
                field = get_field_for_filter(ComplianceReport, "reporting_frequency")
                filter_value = (
                    ReportingFrequency.ANNUAL.value
                    if filter_value.lower().startswith("c")
                    else ReportingFrequency.QUARTERLY.value
                )
            elif filter.field == "compliance_period":
                field = get_field_for_filter(CompliancePeriod, "description")
            else:
                field = get_field_for_filter(ComplianceReport, filter.field)

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
                joinedload(ComplianceReport.supplemental_reports),
            )
            .where(ComplianceReport.compliance_report_id == compliance_report_id)
        )

    @repo_handler
    async def get_compliance_report_status_by_desc(self, status: str) -> int:
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
    async def add_compliance_report(self, report: ComplianceReport):
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
    async def get_compliance_report_history(self, report: ComplianceReport):
        history = await self.db.execute(
            select(ComplianceReportHistory)
            .where(
                and_(
                    ComplianceReportHistory.compliance_report_id
                    == report.compliance_report_id,
                    ComplianceReportHistory.status_id == report.current_status_id,
                )
            )
            .order_by(ComplianceReportHistory.create_date.desc())
        )
        return history.scalar_one_or_none()

    @repo_handler
    async def add_compliance_report_history(self, report: ComplianceReport, user):
        """
        Add a new compliance report history record to the database
        """
        history = await self.get_compliance_report_history(report)
        if history:
            history.update_date = datetime.now()
            history.create_date = datetime.now()
            history.status_id = report.current_status_id
            history.user_profile_id = user.user_profile_id
        else:
            history = ComplianceReportHistory(
                compliance_report_id=report.compliance_report_id,
                status_id=report.current_status_id,
                user_profile_id=user.user_profile_id,
            )
        self.db.add(history)
        await self.db.flush()
        return history

    @repo_handler
    async def get_reports_paginated(
        self, pagination: PaginationRequestSchema, organization_id: int = None
    ):
        """
        Retrieve a paginated list of compliance reports from the database
        Supports pagination and sorting.
        """
        # Build the base query statement
        conditions = []
        if organization_id:
            conditions.append(ComplianceReport.organization_id == organization_id)

        if pagination.filters and len(pagination.filters) > 0:
            self.apply_filters(pagination, conditions)
        # Apply pagination and sorting parameters
        offset = 0 if (pagination.page < 1) else (pagination.page - 1) * pagination.size
        limit = pagination.size

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
            )
            .join(
                ComplianceReportStatus,
                ComplianceReport.current_status_id
                == ComplianceReportStatus.compliance_report_status_id,
            )
            .where(and_(*conditions))
        )
        # Apply sorts
        for order in pagination.sort_orders:
            sort_method = asc if order.direction == "asc" else desc
            # Add the sorting condition to the query
            if order.field == "status":
                order.field = get_field_for_filter(ComplianceReportStatus, "status")
                query = query.join(
                    ComplianceReportStatus,
                    ComplianceReport.current_status_id
                    == ComplianceReportStatus.compliance_report_status_id,
                )
            elif order.field == "compliance_period":
                order.field = get_field_for_filter(CompliancePeriod, "description")
                query = query.join(
                    CompliancePeriod,
                    ComplianceReport.compliance_period_id
                    == CompliancePeriod.compliance_period_id,
                )
            elif order.field == "organization":
                order.field = get_field_for_filter(Organization, "name")
                query = query.join(
                    Organization,
                    ComplianceReport.organization_id == Organization.organization_id,
                )
            elif order.field == "type":
                order.field = get_field_for_filter(ComplianceReport, "report_type")
            else:
                order.field = get_field_for_filter(ComplianceReport, order.field)
            query = query.order_by(sort_method(order.field))

        query_result = (await self.db.execute(query)).unique().scalars().all()
        total_count = len(query_result)
        reports = (
            (await self.db.execute(query.offset(offset).limit(limit)))
            .unique()
            .scalars()
            .all()
        )
        return [
            ComplianceReportBaseSchema.model_validate(report) for report in reports
        ], total_count

    @repo_handler
    async def get_compliance_report_by_id(self, report_id: int, is_model: bool = False):
        """
        Retrieve a compliance report from the database by ID
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
                        joinedload(ComplianceReport.history).joinedload(
                            ComplianceReportHistory.status
                        ),
                        joinedload(ComplianceReport.history).joinedload(
                            ComplianceReportHistory.user_profile
                        ),
                    )
                    .where(ComplianceReport.compliance_report_id == report_id)
                )
            )
            .unique()
            .scalars()
            .first()
        )
        if is_model:
            return result
        else:
            return ComplianceReportBaseSchema.model_validate(result)

    # @repo_handler
    # async def get_intended_use_types(self) -> List[EndUseType]:
    #     """
    #     Retrieve a list of intended use types from the database
    #     """
    #     return (
    #         (
    #             await self.db.execute(
    #                 select(EndUseType).where(EndUseType.intended_use == True)
    #             )
    #         )
    #         .scalars()
    #         .all()
    #     )

    # @repo_handler
    # async def get_intended_use_by_name(self, intended_use: str) -> EndUseType:
    #     """
    #     Retrieve intended use type by name from the database
    #     """
    #     result = await self.db.scalar(
    #         select(EndUseType).where(EndUseType.name == intended_use)
    #     )
    #     return result

    # @repo_handler
    # async def get_levels_of_equipment(self) -> List[LevelOfEquipment]:
    #     """
    #     Retrieve a list of levels of equipment from the database
    #     """
    #     return (await self.db.execute(select(LevelOfEquipment))).scalars().all()

    # @repo_handler
    # async def get_levels_of_equipment_by_name(self, name: str) -> LevelOfEquipment:
    #     """
    #     Get the levels of equipment by name
    #     """
    #     return (
    #         (
    #             await self.db.execute(
    #                 select(LevelOfEquipment).where(LevelOfEquipment.name == name)
    #             )
    #         )
    #         .scalars()
    #         .all()
    #     )

    # @repo_handler
    # async def get_fuel_measurement_types(self) -> List[FuelMeasurementType]:
    #     """
    #     Retrieve a list of levels of equipment from the database
    #     """
    #     return (await self.db.execute(select(FuelMeasurementType))).scalars().all()

    # @repo_handler
    # async def get_fuel_measurement_type_by_type(self, type: str) -> FuelMeasurementType:
    #     """
    #     Get the levels of equipment by name
    #     """
    #     return (
    #         (
    #             await self.db.execute(
    #                 select(FuelMeasurementType).where(FuelMeasurementType.type == type)
    #             )
    #         )
    #         .scalars()
    #         .all()
    #     )

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
    async def save_compliance_report_summary(
        self, report_id: int, summary: ComplianceReportSummarySchema
    ):
        """
        Save the compliance report summary to the database.

        :param report_id: The ID of the compliance report
        :param summary: The generated summary data
        """
        existing_summary = await self.get_summary_by_report_id(report_id)

        if existing_summary:
            summary_obj = existing_summary
        else:
            raise ValueError(f"No summary found with report ID {report_id}")

        # Update renewable fuel target summary
        for row in summary.renewable_fuel_target_summary:
            line_number = row.line
            for fuel_type in ["gasoline", "diesel", "jet_fuel"]:
                column_name = f"line_{line_number}_{row.field.lower()}_{fuel_type}"
                setattr(
                    summary_obj,
                    column_name,
                    int(getattr(row, fuel_type) or getattr(summary_obj, column_name)),
                )

        # Update low carbon fuel target summary
        for row in summary.low_carbon_fuel_target_summary:
            column_name = f"line_{row.line}_{row.field}"
            setattr(
                summary_obj,
                column_name,
                int(row.value or getattr(summary_obj, column_name)),
            )

        # Update non-compliance penalty summary
        non_compliance_summary = summary.non_compliance_penalty_summary
        for row in non_compliance_summary:
            if row.line == "11":
                summary_obj.line_11_fossil_derived_base_fuel_total = row.total_value
            elif row.line == "21":
                summary_obj.line_21_non_compliance_penalty_payable = row.total_value
            elif row.line == "":  # Total row
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

    @repo_handler
    async def calculate_fuel_quantities(
        self, compliance_report_id: int, fossil_derived: bool
    ) -> Dict[str, float]:
        fuel_quantities = defaultdict(float)

        def aggregate_fuel_quantities(result):
            for row in result:
                fuel_category = row.category.lower().replace(" ", "_")
                fuel_quantities[fuel_category] += row.quantity

        # Aggregate fuel supply quantities
        fuel_supply_query = (
            select(
                FuelCategory.category,
                func.coalesce(func.sum(FuelSupply.quantity), 0).label("quantity"),
            )
            .select_from(FuelSupply)
            .join(FuelType, FuelSupply.fuel_type_id == FuelType.fuel_type_id)
            .join(
                FuelCategory,
                FuelSupply.fuel_category_id == FuelCategory.fuel_category_id,
            )
            .where(
                FuelSupply.compliance_report_id == compliance_report_id,
                FuelType.fossil_derived.is_(fossil_derived),
                FuelType.other_uses_fossil_derived.is_(fossil_derived),
            )
            .group_by(FuelCategory.category)
        )

        aggregate_fuel_quantities(await self.db.execute(fuel_supply_query))

        # Aggregate other uses quantities
        other_uses_query = (
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

        aggregate_fuel_quantities(await self.db.execute(other_uses_query))

        # Aggregate allocation agreement quantities for renewable fuels
        if not fossil_derived:
            allocation_agreement_query = (
                select(
                    FuelCategory.category,
                    func.coalesce(func.sum(AllocationAgreement.quantity), 0).label(
                        "quantity"
                    ),
                )
                .select_from(AllocationAgreement)
                .join(
                    FuelType, AllocationAgreement.fuel_type_id == FuelType.fuel_type_id
                )
                .join(
                    FuelCategory,
                    AllocationAgreement.fuel_category_id
                    == FuelCategory.fuel_category_id,
                )
                .where(
                    AllocationAgreement.compliance_report_id == compliance_report_id,
                    FuelType.fossil_derived.is_(False),
                    FuelType.other_uses_fossil_derived.is_(False),
                )
                .group_by(FuelCategory.category)
            )
            aggregate_fuel_quantities(await self.db.execute(allocation_agreement_query))

        return dict(fuel_quantities)

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

    async def get_last_report_in_chain(
        self, original_report_id: int
    ) -> Optional[ComplianceReport]:
        result = await self.db.execute(
            select(ComplianceReport)
            .where(ComplianceReport.original_report_id == original_report_id)
            .order_by(ComplianceReport.chain_index.desc())
            .limit(1)
        )
        return result.scalars().first()
