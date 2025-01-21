import structlog
from fastapi import (
    APIRouter,
    Depends,
    Request,
    Body,
)
from starlette import status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.core.decorators import view_handler
from .schema import OrganizationSnapshotSchema
from .services import OrganizationSnapshotService
from ..compliance_report.validation import ComplianceReportValidation

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get(
    "/{compliance_report_id}",
    response_model=OrganizationSnapshotSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_snapshot_by_compliance_report_id(
    request: Request,
    compliance_report_id: int,
    org_snapshot_service: OrganizationSnapshotService = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
) -> OrganizationSnapshotSchema:
    """
    Endpoint to get the organization details snapshot attached to a compliance report
    """
    await report_validate.validate_organization_access(compliance_report_id)
    snapshot = await org_snapshot_service.get_by_compliance_report_id(
        compliance_report_id
    )
    return OrganizationSnapshotSchema.model_validate(snapshot)


@router.put(
    "/{compliance_report_id}",
    response_model=OrganizationSnapshotSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def update_compliance_report_snapshot(
    request: Request,
    compliance_report_id: int,
    org_snapshot_service: OrganizationSnapshotService = Depends(),
    report_validate: ComplianceReportValidation = Depends(),
    request_data: OrganizationSnapshotSchema = Body(...),
) -> OrganizationSnapshotSchema:
    """
    Endpoint to update a compliance report address snapshot
    """
    await report_validate.validate_organization_access(compliance_report_id)
    snapshot = await org_snapshot_service.update(request_data, compliance_report_id)
    return OrganizationSnapshotSchema.model_validate(snapshot)
