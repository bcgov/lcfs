import structlog
from typing import Optional
from fastapi import APIRouter, Depends, status, Request, Body

from lcfs.web.core.decorators import view_handler
from lcfs.web.api.government_notification.services import GovernmentNotificationService
from lcfs.web.api.government_notification.schema import (
    GovernmentNotificationSchema,
    GovernmentNotificationUpdateSchema,
)
from lcfs.db.models.user.Role import RoleEnum

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get(
    "/current",
    response_model=Optional[GovernmentNotificationSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler(["*"])
async def get_current_notification(
    request: Request,
    service: GovernmentNotificationService = Depends(),
):
    """
    Fetches the current government notification.
    Available to all authenticated users (both BCeID and IDIR).
    Returns null if no notification exists.
    """
    return await service.get_current_notification()


@router.put(
    "/",
    response_model=GovernmentNotificationSchema,
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR])
async def update_notification(
    request: Request,
    notification_data: GovernmentNotificationUpdateSchema = Body(..., embed=False),
    service: GovernmentNotificationService = Depends(),
):
    """
    Updates the government notification.
    Only Compliance Manager and Director IDIR users can perform this action.
    If no notification exists, it will be created.
    """
    return await service.update_notification(notification_data)


@router.delete(
    "/",
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.COMPLIANCE_MANAGER, RoleEnum.DIRECTOR])
async def delete_notification(
    request: Request,
    service: GovernmentNotificationService = Depends(),
):
    """
    Deletes the government notification.
    Only Compliance Manager and Director IDIR users can perform this action.
    Returns a message indicating success or if no notification existed.
    """
    deleted = await service.delete_notification()
    if deleted:
        return {"message": "Government notification deleted successfully"}
    return {"message": "No government notification exists to delete"}
