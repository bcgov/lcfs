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
    Response,
    Depends,
    Query,
)
from fastapi.responses import StreamingResponse

from lcfs.db import dependencies
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.compliance_report.schema import CompliancePeriodSchema, ComplianceReportBaseSchema, ComplianceReportListSchema, FSEOptionsSchema
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation

router = APIRouter()
logger = getLogger("reports_view")
get_async_db = dependencies.get_async_db_session


@router.get("/compliance-periods", response_model=List[CompliancePeriodSchema], status_code=status.HTTP_200_OK)
@view_handler
async def get_compliance_periods(service: ComplianceReportServices = Depends()) -> CompliancePeriodSchema:
    """
    Get a list of compliance periods
    """
    return await service.get_all_compliance_periods()


@router.post(
    "/list",
    response_model=ComplianceReportListSchema,
    status_code=status.HTTP_200_OK,
)
@roles_required("Government")
@view_handler
async def get_compliance_reports(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportListSchema:
    # TODO: Add filter on statuses so that IDIR users won't be able to see draft reports
    return await service.get_compliance_reports_paginated(pagination)


@router.get("/fse-options", response_model=FSEOptionsSchema, status_code=status.HTTP_200_OK)
@view_handler
async def get_fse_options(service: ComplianceReportServices = Depends()) -> FSEOptionsSchema:
    return await service.get_fse_options()


@router.get(
    "/{report_id}",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler
@roles_required("Government")
async def get_compliance_report_by_id(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    return await service.get_compliance_report_by_id(report_id)
