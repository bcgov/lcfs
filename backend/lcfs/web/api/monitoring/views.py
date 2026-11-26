from fastapi import APIRouter, Request

from lcfs.web.core.decorators import public_view_handler
from lcfs.web.core.rate_limit import RATE_LIMIT_EXEMPT

router = APIRouter()


@router.get("/health")
@public_view_handler(rate_limit=RATE_LIMIT_EXEMPT)
async def health_check(request: Request) -> str:
    """
    Checks the health of a project.

    It returns 200 if the project is healthy.
    """
    return "healthy"
