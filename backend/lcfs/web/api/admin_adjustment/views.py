from fastapi import APIRouter, Depends, Request, status
from lcfs.db import dependencies
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentCreateSchema, AdminAdjustmentSchema
from lcfs.web.api.admin_adjustment.validation import AdminAdjustmentValidation
from lcfs.web.core.decorators import roles_required, view_handler

router = APIRouter()
get_async_db = dependencies.get_async_db_session

@router.get("/{admin_adjustment_id}", response_model=AdminAdjustmentSchema)
@view_handler
async def get_admin_adjustment(
    admin_adjustment_id: int,
    service: AdminAdjustmentServices = Depends()
):
    """Endpoint to fetch an admin adjustment by its ID."""
    return await service.get_admin_adjustment(admin_adjustment_id)


@router.put("/{admin_adjustment_id}", response_model=AdminAdjustmentSchema, status_code=status.HTTP_200_OK)
@view_handler
@roles_required("Government")
async def update_admin_adjustment(
    request: Request,
    admin_adjustment_id: int,
    admin_adjustment_data: AdminAdjustmentCreateSchema,
    service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends()
):
    """Endpoint to update an existing admin adjustment."""
    await validate.validate_admin_adjustment(request, admin_adjustment_data)
    admin_adjustment_data.admin_adjustment_id = admin_adjustment_id
    return await service.update_admin_adjustment(admin_adjustment_data)


@router.post("/", response_model=AdminAdjustmentSchema, status_code=status.HTTP_201_CREATED)
@roles_required("Government")
@view_handler
async def create_admin_adjustment(
    request: Request,
    admin_adjustment_create: AdminAdjustmentCreateSchema = ...,
    admin_adjustment_service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends(),
):
    """Endpoint to create a new admin adjustment."""
    await validate.validate_admin_adjustment(request, admin_adjustment_create)
    return await admin_adjustment_service.create_admin_adjustment(admin_adjustment_create)
