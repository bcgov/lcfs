"""
Carbon Intensity (CI) application endpoints.

Step 1 of the workflow ("Application information") is fully wired:
table options, listing, detail, create, update, delete.

The remaining steps live as stubs at the bottom of this file so the URL
surface and OpenAPI contract are reserved while subsequent feature work
fills them in.
"""

from typing import Optional

import structlog
from fastapi import APIRouter, Body, Depends, Request, status
from fastapi.responses import JSONResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.ci_application.schema import (
    CIApplicationSchema,
    CIApplicationsListSchema,
    CIApplicationStep1Schema,
    CIApplicationStep2Schema,
    CIApplicationStep3Schema,
    CITableOptionsSchema,
)
from lcfs.web.api.ci_application.services import CIApplicationServices
from lcfs.web.api.ci_application.validation import CIApplicationValidation
from lcfs.web.api.role.schema import user_has_roles
from lcfs.web.core.decorators import view_handler

router = APIRouter()
logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------


@router.get(
    "/table-options",
    response_model=CITableOptionsSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_table_options(
    request: Request,
    service: CIApplicationServices = Depends(),
) -> CITableOptionsSchema:
    """Lookup data needed to render the CI application form (Step 1)."""
    return await service.get_table_options()


# ---------------------------------------------------------------------------
# Listing & detail
# ---------------------------------------------------------------------------


@router.post(
    "/list",
    response_model=CIApplicationsListSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def list_ci_applications(
    request: Request,
    pagination: PaginationRequestSchema = Body(..., embed=False),
    service: CIApplicationServices = Depends(),
) -> CIApplicationsListSchema:
    """List CI applications. Suppliers see their own; government sees all."""
    is_government = user_has_roles(request.user, [RoleEnum.GOVERNMENT])
    organization_id: Optional[int] = None
    if not is_government:
        org = request.user.organization
        if not org:
            return CIApplicationsListSchema(
                ci_applications=[],
                pagination={
                    "total": 0,
                    "page": pagination.page,
                    "size": pagination.size,
                    "total_pages": 0,
                },
            )
        organization_id = org.organization_id
    return await service.list_ci_applications(pagination, organization_id)


@router.get(
    "/{ci_application_id}",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_ci_application(
    request: Request,
    ci_application_id: int,
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    await validate.validate_access(ci_application_id)
    return await service.get_ci_application(ci_application_id)


# ---------------------------------------------------------------------------
# Step 1 — Application information (create / update / delete draft)
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_201_CREATED,
)
@view_handler([RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY])
async def create_ci_application(
    request: Request,
    data: CIApplicationStep1Schema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    """Create a new draft CI application from Step 1 form data."""
    organization_id = validate.require_supplier_organization()
    return await service.create_draft(organization_id, data, request.user)


@router.put(
    "/{ci_application_id}/step1",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY])
async def update_ci_application_step1(
    request: Request,
    ci_application_id: int,
    data: CIApplicationStep1Schema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.update_step1(ci, data, request.user)


@router.delete(
    "/{ci_application_id}",
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY])
async def delete_ci_application(
    request: Request,
    ci_application_id: int,
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
):
    ci = await validate.validate_access(ci_application_id)
    await service.delete_draft(ci)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "CI application deleted."},
    )


# ---------------------------------------------------------------------------
# Steps 2-5 — stubbed endpoints reserved for subsequent feature work.
# Returning HTTP 501 keeps the OpenAPI surface stable while signalling
# clearly that the implementation has not landed yet.
# ---------------------------------------------------------------------------


def _not_implemented(step: str):
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content={"message": f"{step} is not yet implemented."},
    )


@router.put(
    "/{ci_application_id}/step2",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY])
async def update_ci_application_step2(
    request: Request,
    ci_application_id: int,
    data: CIApplicationStep2Schema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    """Step 2 — Proposed fuel pathways. Replaces the entire pathway set."""
    ci = await validate.validate_access(ci_application_id)
    return await service.update_step2(ci, data, request.user)


@router.put(
    "/{ci_application_id}/step3",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY])
async def update_ci_application_step3(
    request: Request,
    ci_application_id: int,
    data: CIApplicationStep3Schema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    """Step 3 — Documents & GHGenius modelling. Validates required uploads."""
    ci = await validate.validate_access(ci_application_id)
    return await service.update_step3(ci, data, request.user)


@router.post(
    "/{ci_application_id}/submit",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
@view_handler([RoleEnum.SIGNING_AUTHORITY])
async def submit_ci_application(request: Request, ci_application_id: int):
    """Step 4 — Sign & submit. To be implemented."""
    return _not_implemented("Step 4 (Sign & submit)")


@router.post(
    "/{ci_application_id}/decision",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.DIRECTOR])
async def record_government_decision(request: Request, ci_application_id: int):
    """Step 5 — Government decision. To be implemented."""
    return _not_implemented("Step 5 (Government decision)")
