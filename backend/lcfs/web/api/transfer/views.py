from fastapi import APIRouter, Depends, Request, status
from typing import List
from lcfs.db import dependencies
from lcfs.web.api.transfer.schema import TransferCreate, TransferSchema, TransferUpdate
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


@router.post("/", response_model=TransferSchema, status_code=status.HTTP_201_CREATED)
@roles_required("SUPPLIER")
@view_handler
async def create_transfer(
    request: Request,
    transfer_data: TransferCreate,
    service: TransferServices = Depends()
):
    """Endpoint to create a new transfer."""
    return await service.create_transfer(transfer_data)


@router.put("/{transfer_id}/draft", response_model=TransferSchema, status_code=status.HTTP_200_OK)
@roles_required("SUPPLIER")
@view_handler
async def update_transfer_draft(
    request: Request,
    transfer_id: int,
    transfer_data: TransferCreate,
    service: TransferServices = Depends()
):
    """Endpoint to update an existing transfer."""
    return await service.update_transfer_draft(transfer_id, transfer_data)


@router.put("/{transfer_id}", response_model=TransferSchema, status_code=status.HTTP_200_OK)
@roles_required("SUPPLIER")
@view_handler
async def update_transfer(
    request: Request,
    transfer_id: int,
    transfer_data: TransferUpdate,
    service: TransferServices = Depends()
):
    """Endpoint to set an existing transfers status to 'Deleted'."""
    return await service.update_transfer(transfer_id, transfer_data)
