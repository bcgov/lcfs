import structlog
from fastapi import APIRouter, Depends, status, Request, Body

from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import view_handler
from lcfs.web.api.audit_log.services import AuditLogService
from lcfs.web.api.audit_log.schema import AuditLogListSchema, AuditLogSchema
from lcfs.db.models.user.Role import RoleEnum

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.post(
    "/list",
    response_model=AuditLogListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])
async def get_audit_logs_paginated(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: AuditLogService = Depends(),
):
    """
    Fetches a list of audit logs with pagination and filtering.
    """
    return await service.get_audit_logs_paginated(pagination)


@router.get(
    "/{audit_log_id}",
    response_model=AuditLogSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ADMINISTRATOR])
async def get_audit_log_by_id(
    request: Request,
    audit_log_id: int,
    service: AuditLogService = Depends(),
):
    """
    Retrieve an audit log entry by ID.
    """
    return await service.get_audit_log_by_id(audit_log_id)
