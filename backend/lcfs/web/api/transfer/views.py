from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from lcfs.db import dependencies
from lcfs.db.models import Transfer, Issuance, TransferHistory, IssuanceHistory
from lcfs.web.api.transfer import schema
from sqlalchemy import select
from datetime import datetime

from lcfs.web.api.transfer.schema import TransferCreate, TransferSchema  # Adjust import paths as needed
from lcfs.web.api.transfer.services import TransferServices  # Adjust import path as needed
from lcfs.web.core.decorators import roles_required, view_handler  # Adjust import path as needed


router = APIRouter()
get_async_db = dependencies.get_async_db_session


@router.post("/", response_model=TransferSchema, status_code=status.HTTP_201_CREATED)
# @roles_required("SUPPLIER")
@view_handler
async def create_transfer(
    request: Request,
    transfer_data: TransferCreate,
    service: TransferServices = Depends()
):
    try:
        new_transfer = await service.create_transfer(transfer_data)
        return new_transfer
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/", response_model=List[TransferSchema])
async def get_transfers(db: AsyncSession = Depends(get_async_db)):
    try:
        transfers = (await db.execute(select(Transfer))).scalars().all()
        return transfers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/transfer_histories/", response_model=schema.TransferHistory)
async def create_transfer_history(
    transfer_history: schema.TransferHistory, db: AsyncSession = Depends(get_async_db)
):
    try:
        new_transfer_history = TransferHistory(**transfer_history.dict())
        db.add(new_transfer_history)
        await db.commit()
        await db.refresh(new_transfer_history)
        return new_transfer_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/transfer_histories/", response_model=List[schema.TransferHistory])
async def get_transfer_histories(db: AsyncSession = Depends(get_async_db)):
    try:
        transfer_histories = await db.execute(TransferHistory.query().all())
        return transfer_histories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get(
    "/transfer_histories/{transfer_history_id}", response_model=schema.TransferHistory
)
async def get_transfer_history(
    transfer_history_id: int, db: AsyncSession = Depends(get_async_db)
):
    try:
        transfer_history = await db.execute(
            models.TransferHistory.query().get(transfer_history_id)
        )
        if transfer_history is None:
            raise HTTPException(status_code=404, detail="Transfer history not found")
        return transfer_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.put(
    "/transfer_histories/{transfer_history_id}", response_model=schema.TransferHistory
)
async def update_transfer_history(
    transfer_history_id: int,
    transfer_history: schema.TransferHistory,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        db_transfer_history = await db.execute(
            TransferHistory.query().get(transfer_history_id)
        )
        if db_transfer_history is None:
            raise HTTPException(status_code=404, detail="Transfer history not found")

        for field, value in transfer_history.dict().items():
            setattr(db_transfer_history, field, value)

        await db.commit()
        await db.refresh(db_transfer_history)
        return db_transfer_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.delete("/transfer_histories/{transfer_history_id}")
async def delete_transfer_history(
    transfer_history_id: int, db: AsyncSession = Depends(get_async_db)
):
    try:
        transfer_history = await db.execute(
            TransferHistory.query().get(transfer_history_id)
        )
        if transfer_history is None:
            raise HTTPException(status_code=404, detail="Transfer history not found")

        db.delete(transfer_history)
        await db.commit()
        return {"message": "Transfer history deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/issuances/", response_model=schema.IssuanceSchema)
async def create_issuance(
    issuance: schema.IssuanceSchema, db: AsyncSession = Depends(get_async_db)
):
    try:
        new_issuance = Issuance(**issuance.dict())
        db.add(new_issuance)
        await db.commit()
        await db.refresh(new_issuance)
        return new_issuance
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/issuances/", response_model=List[schema.IssuanceSchema])
async def get_issuances(db: AsyncSession = Depends(get_async_db)):
    try:
        issuances = await db.execute(Issuance.query().all())
        return issuances
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/issuances/{issuance_id}", response_model=schema.IssuanceSchema)
async def get_issuance(issuance_id: int, db: AsyncSession = Depends(get_async_db)):
    try:
        issuance = await db.execute(Issuance.query().get(issuance_id))
        if issuance is None:
            raise HTTPException(status_code=404, detail="Issuance not found")
        return issuance
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.put("/issuances/{issuance_id}", response_model=schema.IssuanceSchema)
async def update_issuance(
    issuance_id: int,
    issuance: schema.IssuanceSchema,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        db_issuance = await db.execute(Issuance.query().get(issuance_id))
        if db_issuance is None:
            raise HTTPException(status_code=404, detail="Issuance not found")

        for field, value in issuance.dict().items():
            setattr(db_issuance, field, value)

        await db.commit()
        await db.refresh(db_issuance)
        return db_issuance
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.delete("/issuances/{issuance_id}")
async def delete_issuance(issuance_id: int, db: AsyncSession = Depends(get_async_db)):
    try:
        issuance = await db.execute(Issuance.query().get(issuance_id))
        if issuance is None:
            raise HTTPException(status_code=404, detail="Issuance not found")

        db.delete(issuance)
        await db.commit()
        return {"message": "Issuance deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.post("/issuance_histories/", response_model=schema.IssuanceHistorySchema)
async def create_issuance_history(
    issuance_history: schema.IssuanceHistorySchema,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        new_issuance_history = IssuanceHistory(**issuance_history.dict())
        db.add(new_issuance_history)
        await db.commit()
        await db.refresh(new_issuance_history)
        return new_issuance_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/issuance_histories/", response_model=List[schema.IssuanceHistorySchema])
async def get_issuance_histories(db: AsyncSession = Depends(get_async_db)):
    try:
        issuance_histories = await db.execute(IssuanceHistory.query().all())
        return issuance_histories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get(
    "/issuance_histories/{issuance_history_id}",
    response_model=schema.IssuanceHistorySchema,
)
async def get_issuance_history(
    issuance_history_id: int, db: AsyncSession = Depends(get_async_db)
):
    try:
        issuance_history = await db.execute(
            IssuanceHistory.query().get(issuance_history_id)
        )
        if issuance_history is None:
            raise HTTPException(status_code=404, detail="Issuance history not found")
        return issuance_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.put(
    "/issuance_histories/{issuance_history_id}",
    response_model=schema.IssuanceHistorySchema,
)
async def update_issuance_history(
    issuance_history_id: int,
    issuance_history: schema.IssuanceHistorySchema,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        db_issuance_history = await db.execute(
            IssuanceHistory.query().get(issuance_history_id)
        )
        if db_issuance_history is None:
            raise HTTPException(status_code=404, detail="Issuance history not found")

        for field, value in issuance_history.dict().items():
            setattr(db_issuance_history, field, value)

        await db.commit()
        await db.refresh(db_issuance_history)
        return db_issuance_history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.delete("/issuance_histories/{issuance_history_id}")
async def delete_issuance_history(
    issuance_history_id: int, db: AsyncSession = Depends(get_async_db)
):
    try:
        issuance_history = await db.execute(
            IssuanceHistory.query().get(issuance_history_id)
        )
        if issuance_history is None:
            raise HTTPException(status_code=404, detail="Issuance history not found")

        db.delete(issuance_history)
        await db.commit()
        return {"message": "Issuance history deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
