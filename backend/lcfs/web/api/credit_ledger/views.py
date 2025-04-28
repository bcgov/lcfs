from typing import Optional

import structlog
from fastapi import APIRouter, Depends, status, Request, Body, Query, Path
from fastapi.responses import StreamingResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import view_handler
from .schema import CreditLedgerListSchema
from .services import CreditLedgerService
from .validation import CreditLedgerValidation

log = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/organization/{organization_id}",
    response_model=CreditLedgerListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER])
async def get_credit_ledger(
    request: Request,
    organization_id: int = Path(..., ge=1),
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: CreditLedgerService = Depends(),
    validate: CreditLedgerValidation = Depends(),
):
    """
    Paginated ledger for one organization.
    """
    # ensure user may only fetch their own org
    await validate.validate_organization_access(organization_id)

    return await service.get_ledger_paginated(
        organization_id=organization_id,
        pagination=pagination,
    )


@router.get(
    "/organization/{organization_id}/export",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def export_credit_ledger(
    request: Request,
    organization_id: int,
    compliance_year: Optional[int] = Query(default=None),
    format: str = Query(default="xlsx", description="File export format"),
    service: CreditLedgerService = Depends(),
    validate: CreditLedgerValidation = Depends(),
):
    """
    Download the ledger in xlsx format.
    """
    # ensure user may only fetch their own org
    await validate.validate_organization_access(organization_id)

    return await service.export_transactions(
        organization_id=organization_id,
        compliance_year=compliance_year,
        export_format=format,
    )
