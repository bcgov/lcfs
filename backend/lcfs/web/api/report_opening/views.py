from typing import List

from fastapi import APIRouter, Depends, Request, status

from lcfs.db.models.user.Role import RoleEnum
from lcfs.web.api.report_opening.schema import (
    ReportOpeningSchema,
    ReportOpeningUpdateRequest,
)
from lcfs.web.api.report_opening.services import ReportOpeningService
from lcfs.web.core.decorators import view_handler

router = APIRouter()


@router.get(
    "",
    response_model=List[ReportOpeningSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def list_report_openings(
    request: Request,
    service: ReportOpeningService = Depends(),
) -> List[ReportOpeningSchema]:
    return await service.get_report_openings()


@router.put(
    "",
    response_model=List[ReportOpeningSchema],
    status_code=status.HTTP_200_OK,
)
@view_handler([RoleEnum.ADMINISTRATOR])
async def update_report_openings(
    request: Request,
    payload: ReportOpeningUpdateRequest,
    service: ReportOpeningService = Depends(),
) -> List[ReportOpeningSchema]:
    return await service.update_report_openings(payload)
