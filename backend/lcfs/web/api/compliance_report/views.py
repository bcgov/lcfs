import structlog
from fastapi import APIRouter, Body, status, Request, Depends
from starlette.responses import StreamingResponse
from typing import List

from lcfs.db.models.compliance import AllocationAgreement
from lcfs.db.models.compliance.FuelExport import FuelExport
from lcfs.db.models.compliance.FuelSupply import FuelSupply
from lcfs.db.models.compliance.NotionalTransfer import NotionalTransfer
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementResponseSchema,
)
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
    CommonPaginatedReportRequestSchema,
    ComplianceReportChangelogSchema,
)
from lcfs.web.api.compliance_report.services import ComplianceReportServices
from lcfs.web.api.compliance_report.summary_service import (
    ComplianceReportSummaryService,
)
from lcfs.web.api.compliance_report.update_service import ComplianceReportUpdateService
from lcfs.web.api.compliance_report.validation import ComplianceReportValidation
from lcfs.web.api.fuel_export.schema import FuelExportSchema
from lcfs.web.api.fuel_supply.schema import FuelSupplyResponseSchema
from lcfs.web.api.notional_transfer.schema import NotionalTransferChangelogSchema
from lcfs.web.api.other_uses.schema import OtherUsesChangelogSchema
from lcfs.web.core.decorators import view_handler

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

    result = await service.get_compliance_report_by_id(report_id, request.user, True)
    return result


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


@router.post(
    "/fuel-supply/changelog",
    response_model=ComplianceReportChangelogSchema[FuelSupplyResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_fuel_supply_changelog(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportChangelogSchema[FuelSupplyResponseSchema]:
    compliance_report_id = request_data.compliance_report_id

    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    return await service.get_changelog_data(
        pagination, compliance_report_id, FuelSupply
    )


@router.post(
    "/other-uses/changelog",
    response_model=ComplianceReportChangelogSchema[OtherUsesChangelogSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_other_uses_changelog(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportChangelogSchema[OtherUsesChangelogSchema]:
    compliance_report_id = request_data.compliance_report_id

    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    changelog = await service.get_changelog_data(
        pagination, compliance_report_id, OtherUses
    )

    return changelog


@router.post(
    "/notional-transfers/changelog",
    response_model=ComplianceReportChangelogSchema[NotionalTransferChangelogSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_notional_transfers_changelog(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportChangelogSchema[NotionalTransferChangelogSchema]:
    compliance_report_id = request_data.compliance_report_id

    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    return await service.get_changelog_data(
        pagination, compliance_report_id, NotionalTransfer
    )


@router.post(
    "/fuel-exports/changelog",
    response_model=ComplianceReportChangelogSchema[FuelExportSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_fuel_exports_changelog(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportChangelogSchema[FuelExportSchema]:
    compliance_report_id = request_data.compliance_report_id

    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    return await service.get_changelog_data(
        pagination, compliance_report_id, FuelExport
    )


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


@router.post(
    "/allocation-agreements/changelog",
    response_model=ComplianceReportChangelogSchema[AllocationAgreementResponseSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_allocation_agreement_changelog(
    request: Request,
    request_data: CommonPaginatedReportRequestSchema = Body(...),
    service: ComplianceReportServices = Depends(),
) -> ComplianceReportChangelogSchema[AllocationAgreementResponseSchema]:
    compliance_report_id = request_data.compliance_report_id

    pagination = PaginationRequestSchema(
        page=request_data.page,
        size=request_data.size,
        sort_orders=request_data.sort_orders,
        filters=request_data.filters,
    )
    # Get the changelog from the service for AllocationAgreement
    changelog_response = await service.get_changelog_data(
        pagination, compliance_report_id, AllocationAgreement
    )

    # Fetch the associated compliance report data
    report = await service.get_compliance_report_by_id(
        compliance_report_id, request.user
    )

    # Convert each allocation agreement to a serializable dict before returning
    serializable_changelog = [
        AllocationAgreementResponseSchema.model_validate(record)
        for record in changelog_response["changelog"]
    ]
    response = {
        **changelog_response,
        "changelog": serializable_changelog,
        "report": report,
    }

    return response


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
