from unittest.mock import AsyncMock

import pytest

from lcfs.web.api.search.schema import (
    SearchGroup,
    SearchResponse,
    SearchResultDetail,
    SearchResultItem,
)
from lcfs.web.api.search.services import SearchService


@pytest.mark.anyio
async def test_search_endpoint_returns_the_frontend_contract(client, fastapi_app):
    service = AsyncMock(spec=SearchService)
    service.search.return_value = SearchResponse(
        query="prin",
        groups=[
            SearchGroup(
                entity_type="fuel_code",
                label="Fuel codes",
                items=[
                    SearchResultItem(
                        entity_type="fuel_code",
                        entity_id=42,
                        title="PROXY42.1",
                        subtitle="Example supplier",
                        route="/fuel-codes/42/view",
                        details=[
                            SearchResultDetail(
                                label="Facility",
                                value="Prince George",
                            ),
                        ],
                    ),
                ],
            ),
        ],
        total=1,
    )
    fastapi_app.dependency_overrides[SearchService] = lambda: service

    try:
        response = await client.get("/api/search/", params={"q": "prin"})
    finally:
        fastapi_app.dependency_overrides.pop(SearchService, None)

    assert response.status_code == 200
    assert response.json() == {
        "query": "prin",
        "groups": [
            {
                "entityType": "fuel_code",
                "label": "Fuel codes",
                "items": [
                    {
                        "entityType": "fuel_code",
                        "entityId": 42,
                        "title": "PROXY42.1",
                        "subtitle": "Example supplier",
                        "route": "/fuel-codes/42/view",
                        "status": None,
                        "meta": None,
                        "matchContext": None,
                        "details": [
                            {"label": "Facility", "value": "Prince George"},
                        ],
                    },
                ],
            },
        ],
        "total": 1,
        "appliedFilters": {},
    }
    service.search.assert_awaited_once()


@pytest.mark.anyio
async def test_search_endpoint_rejects_queries_outside_length_limits(
    client,
    fastapi_app,
):
    service = AsyncMock(spec=SearchService)
    fastapi_app.dependency_overrides[SearchService] = lambda: service

    try:
        too_short = await client.get("/api/search/", params={"q": "a"})
        too_long = await client.get("/api/search/", params={"q": "x" * 101})
    finally:
        fastapi_app.dependency_overrides.pop(SearchService, None)

    assert too_short.status_code == 422
    assert too_long.status_code == 422
    service.search.assert_not_awaited()
