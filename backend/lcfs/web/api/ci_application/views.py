"""
Carbon Intensity (CI) application endpoints.

All five wizard steps are wired:
  Step 1 — Application information
  Step 2 — Proposed fuel pathways
  Step 3 — Documents & GHGenius modelling
  Step 4 — Sign & submit
  Step 5 — Government decision (with comments thread)
"""

import io
from typing import Optional

import structlog
from fastapi import APIRouter, Body, Depends, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from lcfs.db.models.user.Role import RoleEnum
from lcfs.utils.constants import FILE_MEDIA_TYPE
from lcfs.utils.spreadsheet_builder import SpreadsheetBuilder, SpreadsheetColumn
from lcfs.web.api.base import PaginationRequestSchema
from lcfs.web.api.ci_application.schema import (
    CIApplicationAnalystAssignmentSchema,
    CIApplicationDecisionSchema,
    CIGeneratedFuelCodeSchema,
    CIGeneratedFuelCodeUpdateSchema,
    CIApplicationSchema,
    CIApplicationsListSchema,
    CIApplicationUserSchema,
    CIApplicationVerification1Schema,
    CIApplicationVerification2Schema,
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


@router.get(
    "/analysts",
    response_model=list[CIApplicationUserSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def get_available_ci_application_analysts(
    request: Request,
    service: CIApplicationServices = Depends(),
) -> list[CIApplicationUserSchema]:
    return await service.get_available_analysts()


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
    return await service.list_ci_applications(
        pagination,
        organization_id,
        exclude_draft=is_government,
    )


GHGENIUS_TEMPLATE_SHEETS = {
    "Input tables": [
        SpreadsheetColumn("Parameter", "text"),
        SpreadsheetColumn("Value", "text"),
        SpreadsheetColumn("Units", "text"),
        SpreadsheetColumn("Notes", "text"),
    ],
    "Output tables": [
        SpreadsheetColumn("Parameter", "text"),
        SpreadsheetColumn("Value", "text"),
        SpreadsheetColumn("Units", "text"),
        SpreadsheetColumn("Notes", "text"),
    ],
}


# IMPORTANT: this static-path route MUST be declared before the
# ``GET /{ci_application_id}`` route below — otherwise FastAPI tries to
# coerce "ghgenius-template" into an int path param and returns 422.
@router.get(
    "/ghgenius-template",
    response_class=StreamingResponse,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.CI_APPLICANT, RoleEnum.SIGNING_AUTHORITY, RoleEnum.GOVERNMENT])
async def download_ghgenius_template(request: Request) -> StreamingResponse:
    """Return the empty GHGenius input/output xlsx template used in Step 3."""
    builder = SpreadsheetBuilder(file_format="xlsx")
    for sheet_name, columns in GHGENIUS_TEMPLATE_SHEETS.items():
        builder.add_sheet(
            sheet_name=sheet_name,
            columns=columns,
            rows=[],
            styles={"bold_headers": True},
        )
    file_content = builder.build_spreadsheet()
    headers = {
        "Content-Disposition": (
            'attachment; filename="GHGenius-Input-Output-Template.xlsx"'
        )
    }
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=FILE_MEDIA_TYPE["XLSX"].value,
        headers=headers,
    )


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
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def record_government_decision(
    request: Request,
    ci_application_id: int,
    data: CIApplicationDecisionSchema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    """Step 5 — Government decision and status transitions."""
    ci = await validate.validate_access(ci_application_id)
    is_government = user_has_roles(request.user, [RoleEnum.GOVERNMENT])
    return await service.record_decision(ci, data, request.user, is_government)


@router.put(
    "/{ci_application_id}/assign",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def assign_analyst_to_ci_application(
    request: Request,
    ci_application_id: int,
    data: CIApplicationAnalystAssignmentSchema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.assign_analyst_to_application(
        ci, data.assigned_analyst_id, request.user
    )


@router.post(
    "/{ci_application_id}/verification-1",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def complete_ci_application_verification_1(
    request: Request,
    ci_application_id: int,
    data: CIApplicationVerification1Schema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.complete_verification_1(
        ci, data.preliminary_risk_assessment, data.priority_score, request.user
    )


@router.post(
    "/{ci_application_id}/verification-2",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def complete_ci_application_verification_2(
    request: Request,
    ci_application_id: int,
    data: CIApplicationVerification2Schema = Body(
        default=CIApplicationVerification2Schema()
    ),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.complete_verification_2(
        ci, data.preliminary_risk_assessment, data.priority_score, request.user
    )


@router.post(
    "/{ci_application_id}/recommend",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def recommend_ci_application_to_director(
    request: Request,
    ci_application_id: int,
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.recommend_to_director(ci, request.user)


@router.post(
    "/{ci_application_id}/request-pathway-changes",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def request_ci_application_pathway_changes(
    request: Request,
    ci_application_id: int,
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.request_pathway_changes(ci, request.user)


@router.post(
    "/{ci_application_id}/fuel-codes/generate",
    response_model=CIApplicationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def generate_ci_application_fuel_codes(
    request: Request,
    ci_application_id: int,
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIApplicationSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.generate_fuel_codes(ci, request.user)


@router.put(
    "/{ci_application_id}/fuel-codes/{generated_fuel_code_id}",
    response_model=CIGeneratedFuelCodeSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler(
    [
        RoleEnum.GOVERNMENT,
        RoleEnum.ANALYST,
        RoleEnum.COMPLIANCE_MANAGER,
        RoleEnum.DIRECTOR,
    ]
)
async def update_ci_application_generated_fuel_code(
    request: Request,
    ci_application_id: int,
    generated_fuel_code_id: str,
    data: CIGeneratedFuelCodeUpdateSchema = Body(...),
    service: CIApplicationServices = Depends(),
    validate: CIApplicationValidation = Depends(),
) -> CIGeneratedFuelCodeSchema:
    ci = await validate.validate_access(ci_application_id)
    return await service.update_generated_fuel_code(
        ci, generated_fuel_code_id, data, request.user
    )


# Step 5 comment thread is now served by the shared internal_comments
# router at /api/internal_comments/{entityType}/{entityId} with
# entityType="ciApplication". The legacy /comments endpoints on this
# router were removed when CI applications were migrated onto the shared
# commenting framework.
