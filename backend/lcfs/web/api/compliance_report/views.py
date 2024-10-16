"""
Compliance reports endpoints
GET: /reports/compliance-periods (to retreieve the list of compliance periods)
POST: /reports/list (Includes ability to perform sort, filter and pagination) - retrieve the list of compliance reports
GET: /reports/fse-options - retrieve the options that assists the user in filling up the Final Supply Equipment rows.
GET: /reports/<report_id> - retrieve the compliance report by ID
"""

from logging import getLogger
from typing import List

from fastapi import (
    APIRouter,
    Body,
    status,
    Request,
    Depends,
)

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.base import FilterModel, PaginationRequestSchema
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportListSchema,
    ComplianceReportSummarySchema,
    ComplianceReportUpdateSchema,
)
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = getLogger("reports_view")


@router.get(
    "/compliance-periods",
    response_model=List[CompliancePeriodSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_compliance_periods(
    request: Request, service: ComplianceReportServices = Depends()
) -> list[CompliancePeriodSchema]:
    """
    Get a list of compliance periods
    """
    return await service.get_all_compliance_periods()


@router.post(
    "/list",
    response_model=ComplianceReportListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_compliance_reports(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportListSchema:
    # Add filter on statuses so that IDIR users won't be able to see draft reports
    pagination.filters.append(
        FilterModel(field="status", filter="Draft", filter_type="text", type="notEqual")
    )
    return await service.get_compliance_reports_paginated(pagination)


@router.get(
    "/{report_id}",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_compliance_report_by_id(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    return await service.get_compliance_report_by_id(report_id)


@router.get(
    "/{report_id}/summary",
    response_model=ComplianceReportSummarySchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_compliance_report_summary(
    request: Request,
    report_id: int,
    summary_service: ComplianceReportSummaryService = Depends(),
) -> ComplianceReportSummarySchema:
    """
    Retrieve the comprehensive compliance report summary for a specific report by ID.
    """
    return await summary_service.calculate_compliance_report_summary(report_id)


@router.put(
    "/{report_id}/summary",
    response_model=ComplianceReportSummarySchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def update_compliance_report_summary(
    request: Request,
    report_id: int,
    summary_data: ComplianceReportSummarySchema,
    summary_service: ComplianceReportSummaryService = Depends(),
) -> ComplianceReportSummarySchema:
    """
    Autosave compliance report summary details for a specific summary by ID.
    """
    return await summary_service.update_compliance_report_summary(
        report_id, summary_data
    )


@view_handler(["*"])
@router.put(
    "/{report_id}",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.SUPPLIER])
async def update_compliance_report(
    request: Request,
    report_id: int,
    report_data: ComplianceReportUpdateSchema,
    update_service: ComplianceReportUpdateService = Depends(),
) -> ComplianceReportBaseSchema:
    """Update an existing compliance report."""
    # TODO role validation for different status updates need to be added here
    return await update_service.update_compliance_report(report_id, report_data)
