from fastapi import APIRouter, Depends, Request, status
from typing import List
from lcfs.db import dependencies
# Adjust the imports below to point to the correct Issuance modules
from lcfs.web.api.issuance.schema import IssuanceCreate, IssuanceSchema
from lcfs.web.api.issuance.services import IssuanceServices
from lcfs.web.core.decorators import roles_required, view_handler

router = APIRouter()

@router.get("/", response_model=List[IssuanceSchema])
@roles_required("GOVERNMENT")
@view_handler
async def get_all_issuances(
    service: IssuanceServices = Depends()
):
    """Endpoint to fetch all issuances."""
    return await service.get_all_issuances()

@router.get("/{issuance_id}", response_model=IssuanceSchema)
@roles_required("GOVERNMENT")
@view_handler
async def get_issuance(
    issuance_id: int,
    service: IssuanceServices = Depends()
):
    """Endpoint to fetch an issuance by its ID."""
    return await service.get_issuance(issuance_id)

@router.post("/", response_model=IssuanceSchema, status_code=status.HTTP_201_CREATED)
@roles_required("GOVERNMENT")
@view_handler
async def create_issuance(
    request: Request,
    issuance_data: IssuanceCreate,
    service: IssuanceServices = Depends()
):
    """Endpoint to create a new issuance."""
    return await service.create_issuance(issuance_data)

@router.put("/{issuance_id}", response_model=IssuanceSchema)
@roles_required("GOVERNMENT")
@view_handler
async def update_issuance(
    issuance_id: int,
    issuance_data: IssuanceCreate,
    service: IssuanceServices = Depends()
):
    """Endpoint to update an existing issuance."""
    return await service.update_issuance(issuance_id, issuance_data)
