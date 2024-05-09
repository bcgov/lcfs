from fastapi import APIRouter, Depends, Request, status
from lcfs.db import dependencies
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.admin_adjustment.schema import AdminAdjustmentCreateSchema, AdminAdjustmentSchema, AdminAdjustmentUpdateSchema
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


@router.put("/", response_model=AdminAdjustmentSchema, status_code=status.HTTP_200_OK)
@view_handler
@roles_required("Government")
async def update_admin_adjustment(
    request: Request,
    admin_adjustment_data: AdminAdjustmentUpdateSchema = ...,
    service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends()
):
    """Endpoint to update an existing admin adjustment."""
    await validate.validate_admin_adjustment_update(request, admin_adjustment_data)
    return await service.update_admin_adjustment(admin_adjustment_data)


@router.post("/", response_model=AdminAdjustmentSchema, status_code=status.HTTP_201_CREATED)
@roles_required("Government")
@view_handler
async def create_admin_adjustment(
    request: Request,
    admin_adjustment_create: AdminAdjustmentCreateSchema = ...,
    service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends(),
):
    """Endpoint to create a new admin adjustment."""
    await validate.validate_admin_adjustment_create(request, admin_adjustment_create)
    return await service.create_admin_adjustment(admin_adjustment_create)
