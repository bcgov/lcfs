from fastapi import APIRouter, Depends, Request, status
from typing import List

from lcfs.web.api.transfer.validation import TransferValidation
from lcfs.db import dependencies
from lcfs.web.api.transfer.schema import TransferCreateSchema, TransferSchema
from lcfs.web.api.transfer.services import TransferServices
from lcfs.web.core.decorators import roles_required, view_handler

router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.get("/", response_model=List[TransferSchema])
@view_handler
async def get_all_transfers(
    service: TransferServices = Depends()
):
    """Endpoint to fetch all transfers."""
    return await service.get_all_transfers()


@router.get("/{transfer_id}", response_model=TransferSchema)
@view_handler
async def get_transfer(
    transfer_id: int,
    service: TransferServices = Depends()
):
    """Endpoint to fetch a transfer by its ID."""
    return await service.get_transfer(transfer_id)


@router.put("/{transfer_id}", response_model=TransferSchema, status_code=status.HTTP_200_OK)
@view_handler
@roles_required("Government")
async def update_transfer(
    request: Request,
    transfer_id: int,
    transfer_data: TransferCreateSchema,
    service: TransferServices = Depends(),
    validate: TransferValidation = Depends()
):
    """Endpoint to set an existing transfers status to 'Deleted'."""
    await validate.update_transfer(request, transfer_data)
    transfer_data.transfer_id = transfer_id
    return await service.update_transfer(transfer_data)
