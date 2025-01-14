import structlog
from lcfs.db.models.user.Role import RoleEnum
from fastapi import APIRouter, Depends, Request
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.dashboard.services import DashboardServices
from lcfs.web.api.dashboard.schema import (
    DirectorReviewCountsSchema,
    TransactionCountsSchema,
    OrganizarionTransactionCountsSchema,
    OrgComplianceReportCountsSchema,
    ComplianceReportCountsSchema
)
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()
logger = structlog.get_logger(__name__)


@router.get("/director-review-counts", response_model=DirectorReviewCountsSchema)
@view_handler([RoleEnum.DIRECTOR])
async def get_director_review_counts(
    request: Request,
    service: DashboardServices = Depends(),
):
    """Endpoint to retrieve counts for director review items"""
    return await service.get_director_review_counts()


@router.get("/transaction-counts", response_model=TransactionCountsSchema)
@view_handler([RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER])
async def get_transaction_counts(
    request: Request,
    service: DashboardServices = Depends(),
):
    """Endpoint to retrieve counts for transaction items"""
    return await service.get_transaction_counts()


@router.get(
    "/org-transaction-counts", response_model=OrganizarionTransactionCountsSchema
)
@view_handler([RoleEnum.TRANSFER])
async def get_org_transaction_counts(
    request: Request,
    service: DashboardServices = Depends(),
):
    """Endpoint to retrieve counts for organizarion transaction items"""
    organization_id = request.user.organization.organization_id
    return await service.get_org_transaction_counts(organization_id)


@router.get(
    "/org-compliance-report-counts", response_model=OrgComplianceReportCountsSchema
)
@view_handler([RoleEnum.COMPLIANCE_REPORTING, RoleEnum.SIGNING_AUTHORITY])
async def get_org_compliance_report_counts(
    request: Request,
    service: DashboardServices = Depends(),
):
    """Endpoint to retrieve counts for organization compliance report items"""
    organization_id = request.user.organization.organization_id
    return await service.get_org_compliance_report_counts(organization_id)


@router.get(
    "/compliance-report-counts",
    response_model=ComplianceReportCountsSchema
)
@view_handler([RoleEnum.ANALYST, RoleEnum.COMPLIANCE_MANAGER])
async def get_compliance_report_counts(
    request: Request,
    service: DashboardServices = Depends(),
):
    """Endpoint to retrieve count of compliance reports pending review"""
    return await service.get_compliance_report_counts()
