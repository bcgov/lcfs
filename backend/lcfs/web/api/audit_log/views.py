from functools import cache
from fastapi import APIRouter, Depends, Query
from typing import List, Optional

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.core.decorators import view_handler
from .services import AuditLogService
from .schema import AuditLogResponseSchema
from starlette import status
from fastapi import Request 

router = APIRouter()


@router.get(
    "/",
    response_model=AuditLogResponseSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def get_audit_log(
    request: Request,
    table_name: Optional[str] = Query(None, description="Filter by table name"),
    operation: Optional[str] = Query(None, description="Filter by operation"),
    service: AuditLogService = Depends(),
):
    """
    Get audit logs with optional filters for `table_name` and `operation`.
    """
    return await service.get_audit_log(table_name=table_name, operation=operation)