from logging import getLogger
from fastapi import APIRouter, Depends, Request
from lcfs.web.core.decorators import roles_required, view_handler
from lcfs.web.api.dashboard.services import DashboardServices
from lcfs.web.api.dashboard.schema import DirectorReviewCountsSchema

router = APIRouter()
logger = getLogger("dashboard_view")

@router.get("/director-review-counts", response_model=DirectorReviewCountsSchema)
@roles_required("Director")
@view_handler
async def get_director_review_counts(
    request: Request,
    service: DashboardServices = Depends(),
):
    """Endpoint to retrieve counts for director review items"""
    return await service.get_director_review_counts()