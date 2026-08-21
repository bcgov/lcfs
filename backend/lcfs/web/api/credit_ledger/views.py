from typing import List

import structlog
from fastapi import APIRouter, Depends, status, Request, Body, Query, Path
from fastapi.responses import StreamingResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.core.decorators import view_handler
from .schema import CreditLedgerListSchema, PeriodLedgerSchema
from .services import CreditLedgerService
from .validation import CreditLedgerValidation

log = structlog.get_logger(__name__)
router = APIRouter()


@router.post(
    "/organization/{organization_id}",
    response_model=CreditLedgerListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
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
    "/organization/{organization_id}/period/{compliance_year}",
    response_model=PeriodLedgerSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_period_credit_ledger(
    request: Request,
    organization_id: int = Path(..., ge=1),
    compliance_year: int = Path(..., ge=2000, le=2100),
    include_pending: bool = Query(
        default=False,
        description="Include in-flight pending transactions in the ledger.",
    ),
    service: CreditLedgerService = Depends(),
    validate: CreditLedgerValidation = Depends(),
):
    """
    Compliance-period credit ledger for one organization (#4714): completed
    (and optionally pending) transactions with a per-period running balance,
    totals grouped by transaction type, and previous/current assessed balances.
    """
    await validate.validate_organization_access(organization_id)

    return await service.get_period_ledger(
        organization_id=organization_id,
        compliance_period=compliance_year,
        include_pending=include_pending,
    )


@router.get(
    "/organization/{organization_id}/years",
    response_model=List[str],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def get_organization_ledger_years(
    request: Request,
    organization_id: int = Path(..., ge=1),
    service: CreditLedgerService = Depends(),
    validate: CreditLedgerValidation = Depends(),
):
    """
    Get distinct compliance years with ledger data for an organization.
    """
    # ensure user may only fetch their own org
    await validate.validate_organization_access(organization_id)

    return await service.get_organization_years(organization_id=organization_id)


@router.get(
    "/organization/{organization_id}/period/{compliance_year}/export",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SUPPLIER, RoleEnum.GOVERNMENT])
async def export_period_credit_ledger(
    request: Request,
    organization_id: int = Path(..., ge=1),
    compliance_year: int = Path(..., ge=2000, le=2100),
    include_pending: bool = Query(
        default=False,
        description="Include in-flight pending transactions in the export.",
    ),
    format: str = Query(default="xlsx", description="File export format"),
    service: CreditLedgerService = Depends(),
    validate: CreditLedgerValidation = Depends(),
):
    """
    Download one compliance-period ledger, matching the on-screen view row for
    row — same April–March envelope and running balance (#4832).
    """
    await validate.validate_organization_access(organization_id)

    return await service.export_period_ledger(
        organization_id=organization_id,
        compliance_year=compliance_year,
        include_pending=include_pending,
        export_format=format,
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
    format: str = Query(default="xlsx", description="File export format"),
    service: CreditLedgerService = Depends(),
    validate: CreditLedgerValidation = Depends(),
):
    """
    Download the full organization ledger in xlsx format.
    """
    # ensure user may only fetch their own org
    await validate.validate_organization_access(organization_id)

    return await service.export_transactions(
        organization_id=organization_id,
        export_format=format,
    )
