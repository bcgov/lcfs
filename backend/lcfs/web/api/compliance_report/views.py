"""
Compliance reports endpoints
GET: /reports/compliance-periods (to retreieve the list of compliance periods)
POST: /reports/list (Includes ability to perform sort, filter and pagination) - retrieve the list of compliance reports
GET: /reports/fse-options - retrieve the options that assists the user in filling up the Final Supply Equipment rows.
GET: /reports/<report_id> - retrieve the compliance report by ID
"""

import structlog
from typing import List

from fastapi import APIRouter, Body, status, Request, Depends, HTTPException

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.base import FilterModel, PaginationRequestSchema
from lcfs.web.api.compliance_report.schema import (
    CompliancePeriodSchema,
    ComplianceReportBaseSchema,
    ComplianceReportListSchema,
    ComplianceReportSummarySchema,
    ChainedComplianceReportSchema,
    ComplianceReportUpdateSchema,
    ComplianceReportSummaryUpdateSchema,
)
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.exception.exceptions import DataNotFoundException

from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)


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
    response_model=ChainedComplianceReportSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT])
async def get_compliance_report_by_id(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
    validate: ComplianceReportValidation = Depends(),
) -> ChainedComplianceReportSchema:
    compliance_report = await validate.validate_organization_access(report_id)
    await validate.validate_compliance_report_access(compliance_report)

    mask_statuses = not user_has_roles(request.user, [RoleEnum.GOVERNMENT])

    result = await service.get_compliance_report_by_id(
        report_id, mask_statuses, get_chain=True
    )

    return result


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
    validate: ComplianceReportValidation = Depends(),
) -> ComplianceReportSummarySchema:
    """
    Retrieve the comprehensive compliance report summary for a specific report by ID.
    """
    await validate.validate_organization_access(report_id)
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
    summary_data: ComplianceReportSummaryUpdateSchema,
    summary_service: ComplianceReportSummaryService = Depends(),
    validate: ComplianceReportValidation = Depends(),
) -> ComplianceReportSummarySchema:
    """
    Autosave compliance report summary details for a specific summary by ID.
    """
    await validate.validate_organization_access(report_id)
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
    validate: ComplianceReportValidation = Depends(),
) -> ComplianceReportBaseSchema:
    """Update an existing compliance report."""
    await validate.validate_organization_access(report_id)
    return await update_service.update_compliance_report(report_id, report_data)


@router.post(
    "/{report_id}/supplemental",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.SUPPLIER])
async def create_supplemental_report(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    """
    Create a supplemental compliance report.
    """
    return await service.create_supplemental_report(report_id)
