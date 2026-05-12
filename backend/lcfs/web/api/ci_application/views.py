"""
Carbon Intensity (CI) application endpoints.

All five wizard steps are wired:
  Step 1 — Application information
  Step 2 — Proposed fuel pathways
  Step 3 — Documents & GHGenius modelling
  Step 4 — Sign & submit
  Step 5 — Government decision (with comments thread)
"""

from typing import Optional

import structlog
from fastapi import APIRouter, Body, Depends, Request, status
from fastapi.responses import JSONResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.ci_application.schema import (
    CIApplicationDecisionSchema,
    CIApplicationSchema,
    CIApplicationsListSchema,
    CIApplicationStep1Schema,
    CIApplicationStep2Schema,
    CIApplicationStep3Schema,
    CIApplicationStep4Schema,
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
# Step 2 — Proposed fuel pathways
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Step 3 — Documents & GHGenius modelling
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Step 4 — Sign & submit
# ---------------------------------------------------------------------------


@router.post(
    "/{ci_application_id}/submit",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.SIGNING_AUTHORITY])
async def submit_ci_application(
    request: Request,
    ci_application_id: int,
    data: CIApplicationStep4Schema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    """
    Step 4 — Sign & submit. Locks the application and transitions Draft
    to Submitted. Restricted to signing authorities.
    """
    ci = await validate.validate_access(ci_application_id)
    return await service.submit_application(ci, data, request.user)


# ---------------------------------------------------------------------------
# Step 5 — Government decision & comments thread
# ---------------------------------------------------------------------------


@router.post(
    "/{ci_application_id}/decision",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.GOVERNMENT, RoleEnum.ANALYST, RoleEnum.DIRECTOR])
async def record_government_decision(
    request: Request,
    ci_application_id: int,
    data: CIApplicationDecisionSchema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    """Step 5 — Government decision (Completed or Withdrawn)."""
    ci = await validate.validate_access(ci_application_id)
    is_government = user_has_roles(request.user, [RoleEnum.GOVERNMENT])
    return await service.record_decision(ci, data, request.user, is_government)


# Step 5 comment thread is now served by the shared internal_comments
# router at /api/internal_comments/{entityType}/{entityId} with
# entityType="ciApplication". The legacy /comments endpoints on this
# router were removed when CI applications were migrated onto the shared
# commenting framework.
