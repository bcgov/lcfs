import structlog
from fastapi import APIRouter, Body, status, Request, Depends
from starlette.responses import StreamingResponse
from typing import List, Literal

from lcfs.db.models.user.Role import RoleEnum
from lcfs.services.s3.client import DocumentService
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.common.schema import CompliancePeriodBaseSchema
from lcfs.web.api.compliance_report.export import ComplianceReportExporter
from lcfs.web.api.compliance_report.schema import (
    ComplianceReportBaseSchema,
    ComplianceReportListSchema,
    ComplianceReportStatusSchema,
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
from lcfs.web.core.decorators import view_handler

from lcfs.web.api.compliance_report.dtos import (
    ChangelogFuelSuppliesDTO,
    ChangelogAllocationAgreementsDTO,
    ChangelogFuelExportsDTO,
    ChangelogNotionalTransfersDTO,
    ChangelogOtherUsesDTO,
)

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get(
    "/compliance-periods",
    response_model=List[CompliancePeriodBaseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_compliance_periods(
    request: Request, service: ComplianceReportServices = Depends()
) -> list[CompliancePeriodBaseSchema]:
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
    return await service.get_compliance_reports_paginated(pagination, request.user)


@router.get(
    "/statuses",
    response_model=List[ComplianceReportStatusSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_compliance_report_statuses(
    request: Request,
    service: ComplianceReportServices = Depends(),
) -> List[ComplianceReportStatusSchema]:
    """
    Retrieve the comprehensive compliance report summary for a specific report by ID.
    """
    return await service.get_compliance_report_statuses(request.user)


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

    return await service.get_compliance_report_chain(report_id, request.user)


@router.get(
    "/{report_id}/summary",
    response_model=ComplianceReportSummarySchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
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
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.ANALYST]
)
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
    compliance_report = await validate.validate_organization_access(report_id)
    await validate.validate_compliance_report_access(compliance_report)
    return await summary_service.update_compliance_report_summary(
        report_id, summary_data
    )


@router.put(
    "/{report_id}",
    response_model=ChainedComplianceReportSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.COMPLIANCE_REPORTING,
        RoleEnum.SIGNING_AUTHORITY,
    ]
)
async def update_compliance_report(
    request: Request,
    report_id: int,
    report_data: ComplianceReportUpdateSchema,
    service: ComplianceReportServices = Depends(),
    update_service: ComplianceReportUpdateService = Depends(),
    validate: ComplianceReportValidation = Depends(),
) -> ChainedComplianceReportSchema:
    """Update an existing compliance report."""
    await validate.validate_organization_access(report_id)
    await update_service.update_compliance_report(report_id, report_data, request.user)

    return await service.get_compliance_report_chain(report_id, request.user)


@router.post(
    "/{report_id}/supplemental",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def create_supplemental_report(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    """
    Create a supplemental compliance report.
    """
    new_report = await service.create_supplemental_report(report_id, request.user)
    return new_report


@router.post(
    "/{report_id}/adjustment",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def create_government_adjustment(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    """
    Create a government adjustment.
    """
    new_report = await service.create_analyst_adjustment_report(report_id, request.user)
    return new_report


@router.post(
    "/{report_id}/idir-supplemental",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST])
async def create_government_initiated_supplemental_report(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    """
    Create a government-initiated supplemental compliance report (Analyst action).
    Results in a new Draft report for the supplier.
    """
    new_report = await service.create_government_initiated_supplemental_report(
        report_id, request.user
    )
    return new_report


@router.get(
    "/{report_id}/export",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT]
)
async def export_compliance_report(
    request: Request,
    report_id: int,
    export_service: ComplianceReportExporter = Depends(),
    validate: ComplianceReportValidation = Depends(),
) -> StreamingResponse:
    """
    Retrieve the comprehensive compliance report summary for a specific report by ID.
    """
    await validate.validate_organization_access(report_id)
    return await export_service.export(report_id)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
@view_handler([RoleEnum.GOVERNMENT])
async def delete_compliance_report(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> None:
    """
    Delete a compliance report either in Analyst Adjustment or re-assessed state.
    """
    await service.delete_compliance_report(report_id, request.user)


@router.get(
    "/{compliance_report_group_uuid}/changelog/{data_type}",
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_changelog(
    request: Request,
    compliance_report_group_uuid: str,
    data_type: Literal[
        "fuel-supplies",
        "fuel-exports",
        "notional-transfers",
        "other-uses",
        "allocation-agreements",
    ],
    service: ComplianceReportServices = Depends(),
) -> List:
    response_model_map = {
        "fuel_supplies": ChangelogFuelSuppliesDTO,
        "fuel_exports": ChangelogFuelExportsDTO,
        "notional_transfers": ChangelogNotionalTransfersDTO,
        "other_uses": ChangelogOtherUsesDTO,
        "allocation_agreements": ChangelogAllocationAgreementsDTO,
    }

    # Convert kebab-case to snake_case for database mapping
    data_type_snake = data_type.replace("-", "_")
    router.routes[-1].response_model = List[response_model_map[data_type_snake]]

    return await service.get_changelog_data(
        compliance_report_group_uuid, data_type_snake
    )
