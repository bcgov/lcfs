import structlog
from fastapi import APIRouter, Body, status, Request, Depends
from starlette.responses import StreamingResponse
from typing import List
from lcfs.db.models.user.Role import RoleEnum
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

    result = await service.get_compliance_report_by_id(report_id, request.user, True)
    return result


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
    response_model=ComplianceReportBaseSchema,
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
    update_service: ComplianceReportUpdateService = Depends(),
    validate: ComplianceReportValidation = Depends(),
) -> ComplianceReportBaseSchema:
    """Update an existing compliance report."""
    await validate.validate_organization_access(report_id)
    return await update_service.update_compliance_report(
        report_id, report_data, request.user
    )


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
    return await service.create_supplemental_report(report_id, request.user)


@router.post(
    "/{report_id}/adjustment",
    response_model=ComplianceReportBaseSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.GOVERNMENT])
async def create_government_adjustment(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportBaseSchema:
    """
    Create a government adjustment.
    """
    return await service.create_analyst_adjustment_report(report_id, request.user)


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
    "/{compliance_report_group_uuid}/changelog/fuel-supplies",
    response_model=List[ChangelogFuelSuppliesDTO],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_fuel_supplies_changelog(
    request: Request,
    compliance_report_group_uuid: str,
    service: ComplianceReportServices = Depends(),
) -> List[ChangelogFuelSuppliesDTO]:

    return await service.get_fuel_supplies_changelog_data(compliance_report_group_uuid)


@router.get(
    "/{report_id}/changelog/fuel-exports",
    response_model=List[ChangelogFuelExportsDTO],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_fuel_exports_changelog(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> List[ChangelogFuelExportsDTO]:

    return await service.get_fuel_exports_changelog_data(report_id)


@router.get(
    "/{report_id}/changelog/notional-transfers",
    response_model=List[ChangelogNotionalTransfersDTO],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_notional_transfers_changelog(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> List[ChangelogNotionalTransfersDTO]:

    return await service.get_notional_transfers_changelog_data(report_id)


@router.get(
    "/{report_id}/changelog/other-uses",
    response_model=List[ChangelogOtherUsesDTO],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_other_uses_changelog(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> List[ChangelogOtherUsesDTO]:

    return await service.get_other_uses_changelog_data(report_id)


@router.get(
    "/{report_id}/changelog/alocation-agreements",
    response_model=List[ChangelogAllocationAgreementsDTO],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_allocation_agreements_changelog(
    request: Request,
    report_id: int,
    service: ComplianceReportServices = Depends(),
) -> List[ChangelogAllocationAgreementsDTO]:

    return await service.get_allocation_agreements_changelog_data(report_id)
