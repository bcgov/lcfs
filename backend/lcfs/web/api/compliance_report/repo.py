from logging import getLogger
from typing import List
from datetime import datetime
from lcfs.db.models.organization.Organization import Organization
from sqlalchemy import func, select, and_, asc, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from lcfs.web.api.base import (
    PaginationRequestSchema,
    apply_filter_conditions,
    get_field_for_filter,
)
from lcfs.db.models.compliance import CompliancePeriod
from lcfs.db.models.compliance.ComplianceReport import ComplianceReport
from lcfs.db.models.compliance.ComplianceReportStatus import (
    ComplianceReportStatus,
    ComplianceReportStatusEnum,
)
from lcfs.web.api.compliance_report.schema import ComplianceReportBaseSchema
from lcfs.db.models.compliance.ComplianceReportHistory import ComplianceReportHistory
from lcfs.web.core.decorators import repo_handler
from lcfs.db.dependencies import get_async_db_session

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
                filter_value = getattr(ComplianceReportStatusEnum, filter_value)
            elif filter.field == "organization":
                field = get_field_for_filter(Organization, "name")
            elif filter.field == "type":
                pass
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
    async def get_compliance_report_status_by_desc(self, status: str) -> int:
        """
        Retrieve the compliance report status ID from the database based on the description
        """
        result = await self.db.scalar(
            select(ComplianceReportStatus).where(
                ComplianceReportStatus.status
                == getattr(ComplianceReportStatusEnum, status)
            )
        )
        return result

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
                )
            )
        )
        return result is not None

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
                "history",
                "notional_transfers",
                "organization",
                "other_uses",
                "snapshots",
                "status",
            ],
        )
        return ComplianceReportBaseSchema.model_validate(report)

    @repo_handler
    async def add_compliance_report_history(self, report: ComplianceReport, user):
        """
        Add a new compliance report history record to the database
        """
        history = ComplianceReportHistory(
            compliance_report_id=report.compliance_report_id,
            status_id=report.status_id,
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
        # Form queries to get the total count and the paginated results
        unique_ids_query = select(ComplianceReport.compliance_report_id).where(
            and_(*conditions)
        )
        query = select(ComplianceReport).options(
            joinedload(ComplianceReport.organization),
            joinedload(ComplianceReport.compliance_period),
            joinedload(ComplianceReport.status),
        )
        # get resultset
        query_result = (
            (await self.db.execute(unique_ids_query)).unique().scalars().all()
        )
        for order in pagination.sort_orders:
            sort_method = asc if order.direction == "asc" else desc
            query = query.order_by(sort_method(order.field))

        unique_ids = (
            (await self.db.execute(unique_ids_query.offset(offset).limit(limit)))
            .unique()
            .scalars()
            .all()
        )
        # report_id_list = [report.compliance_report_id for report in unique_ids]
        # Execute the main query
        reports = (
            (
                await self.db.execute(
                    query.where(
                        and_(
                            ComplianceReport.compliance_report_id.in_(unique_ids),
                            *conditions,
                        )
                    )
                    .offset(offset)
                    .limit(limit)
                )
            )
            .scalars()
            .unique()
            .all()
        )
        total_count = len(query_result)
        return [
            ComplianceReportBaseSchema.model_validate(report) for report in reports
        ], total_count
