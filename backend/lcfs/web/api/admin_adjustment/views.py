from fastapi import APIRouter, Depends, Request, status
from lcfs.db import dependencies
from lcfs.web.api.admin_adjustment.services import AdminAdjustmentServices
from lcfs.web.api.admin_adjustment.schema import (
    AdminAdjustmentCreateSchema,
    AdminAdjustmentSchema,
    AdminAdjustmentUpdateSchema,
)
from lcfs.web.api.admin_adjustment.validation import AdminAdjustmentValidation
from lcfs.web.core.decorators import view_handler
from lcfs.db.models.user.Role import RoleEnum

router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get("/{admin_adjustment_id}", response_model=AdminAdjustmentSchema)
@view_handler(["*"])
async def get_admin_adjustment(
    request: Request,
    admin_adjustment_id: int,
    service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends(),
):
    """Endpoint to fetch an admin adjustment by its ID."""
    await validate.validate_organization_access(admin_adjustment_id)
    return await service.get_admin_adjustment(admin_adjustment_id)


@router.put(
    "/", response_model=AdminAdjustmentSchema, status_code=status.HTTP_202_ACCEPTED
)
@view_handler([RoleEnum.GOVERNMENT])
async def update_admin_adjustment(
    request: Request,
    admin_adjustment_data: AdminAdjustmentUpdateSchema = ...,
    service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends(),
):
    """Endpoint to update an existing admin adjustment."""
    await validate.validate_admin_adjustment_update(request, admin_adjustment_data)
    return await service.update_admin_adjustment(admin_adjustment_data)


@router.post(
    "/", response_model=AdminAdjustmentSchema, status_code=status.HTTP_201_CREATED
)
@view_handler([RoleEnum.ANALYST])
async def create_admin_adjustment(
    request: Request,
    admin_adjustment_create: AdminAdjustmentCreateSchema = ...,
    service: AdminAdjustmentServices = Depends(),
    validate: AdminAdjustmentValidation = Depends(),
):
    """Endpoint to create a new admin adjustment."""
    await validate.validate_admin_adjustment_create(request, admin_adjustment_create)
    return await service.create_admin_adjustment(admin_adjustment_create)
