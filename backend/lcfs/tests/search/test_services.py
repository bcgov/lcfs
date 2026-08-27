from typing import Optional, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.search.entities.base import EntitySearch, SearchContext
from lcfs.web.api.search.schema import SearchResultItem
from lcfs.web.api.search.services import SearchService


def _result(entity_type: str, entity_id: int) -> SearchResultItem:
    return SearchResultItem(
        entity_type=entity_type,
        entity_id=entity_id,
        title=f"Result {entity_id}",
        subtitle="",
        route=f"/{entity_type}/{entity_id}",
    )


def _user(organization_id: Optional[int] = None) -> UserProfile:
    user = MagicMock(spec=UserProfile)
    user.organization_id = organization_id
    return cast(UserProfile, user)


@pytest.mark.anyio
async def test_empty_query_does_not_execute_entity_searches(monkeypatch):
    handler = AsyncMock(return_value=[_result("organization", 1)])
    monkeypatch.setattr(
        "lcfs.web.api.search.services.SEARCH_ENTITIES",
        (EntitySearch("organization", "Organizations", handler),),
    )
    service = SearchService(AsyncMock(spec=AsyncSession))

    response = await service.search("   ", _user())

    assert response.query == "   "
    assert response.groups == []
    assert response.total == 0
    assert response.applied_filters == {}
    handler.assert_not_awaited()


@pytest.mark.anyio
async def test_search_preserves_registry_order_and_omits_empty_groups(monkeypatch):
    first_handler = AsyncMock(return_value=[_result("organization", 1)])
    empty_handler = AsyncMock(return_value=[])
    last_handler = AsyncMock(return_value=[_result("user", 2), _result("user", 3)])
    monkeypatch.setattr(
        "lcfs.web.api.search.services.SEARCH_ENTITIES",
        (
            EntitySearch("organization", "Organizations", first_handler),
            EntitySearch("transfer", "Transfers", empty_handler),
            EntitySearch("user", "Users", last_handler),
        ),
    )
    monkeypatch.setattr(
        "lcfs.web.api.search.services.is_government_user", lambda _user: True
    )
    db = AsyncMock(spec=AsyncSession)
    service = SearchService(db)

    response = await service.search("parkland active", _user(42))

    assert [group.entity_type for group in response.groups] == [
        "organization",
        "user",
    ]
    assert response.total == 3
    assert response.applied_filters == {"status": "active"}
    for handler in (first_handler, empty_handler, last_handler):
        handler.assert_awaited_once()
        called_db, context = handler.await_args.args
        assert called_db is db
        assert isinstance(context, SearchContext)
        assert context.is_government
        assert context.organization_id is None
        assert context.query.text == "parkland"


@pytest.mark.anyio
async def test_supplier_organization_is_propagated_to_every_entity(monkeypatch):
    contexts: list[SearchContext] = []

    async def capture_context(
        _db: AsyncSession, context: SearchContext
    ) -> list[SearchResultItem]:
        contexts.append(context)
        return []

    monkeypatch.setattr(
        "lcfs.web.api.search.services.SEARCH_ENTITIES",
        (EntitySearch("transfer", "Transfers", capture_context),),
    )
    monkeypatch.setattr(
        "lcfs.web.api.search.services.is_government_user", lambda _user: False
    )
    service = SearchService(AsyncMock(spec=AsyncSession))

    await service.search("transfers", _user(17))

    assert len(contexts) == 1
    assert not contexts[0].is_government
    assert contexts[0].organization_id == 17
