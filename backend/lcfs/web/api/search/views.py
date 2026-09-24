from fastapi import APIRouter, Depends, Query, Request

from lcfs.web.api.search.schema import SearchResponse
from lcfs.web.api.search.services import SearchService
from lcfs.web.core.decorators import view_handler

router = APIRouter()


@router.get("/", response_model=SearchResponse)
@view_handler(["*"])
async def global_search(
    request: Request,
    q: str = Query(min_length=2, max_length=100),
    service: SearchService = Depends(),
) -> SearchResponse:
    return await service.search(q, request.user)
