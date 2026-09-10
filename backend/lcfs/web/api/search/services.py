from typing import Optional, cast

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from lcfs.db.dependencies import get_async_db_session
from lcfs.db.models.user.UserProfile import UserProfile
from lcfs.web.api.role.schema import is_government_user
from lcfs.web.api.search.entities import SEARCH_ENTITIES
from lcfs.web.api.search.entities.base import SearchContext
from lcfs.web.api.search.query import parse_query
from lcfs.web.api.search.schema import SearchGroup, SearchResponse


class SearchService:
    """Parse one query and collect results from registered entity searches."""

    def __init__(self, db: AsyncSession = Depends(get_async_db_session)):
        self.db = db

    async def search(self, raw_query: str, user: UserProfile) -> SearchResponse:
        """Search every applicable entity in stable display order."""
        query = parse_query(raw_query)
        if query.is_empty:
            return SearchResponse(query=raw_query, groups=[], total=0)

        government_user = is_government_user(user)
        context = SearchContext(
            query=query,
            organization_id=(
                None if government_user else cast(Optional[int], user.organization_id)
            ),
            is_government=government_user,
        )
        groups = await self._search_entities(context)
        return SearchResponse(
            query=raw_query,
            groups=groups,
            total=sum(len(group.items) for group in groups),
            applied_filters=query.applied_filters,
        )

    async def _search_entities(self, context: SearchContext) -> list[SearchGroup]:
        """Execute the registry sequentially on this request's DB session."""
        groups = []
        for entity in SEARCH_ENTITIES:
            items = await entity.execute(self.db, context)
            if items:
                groups.append(
                    SearchGroup(
                        entity_type=entity.entity_type,
                        label=entity.label,
                        items=items,
                    )
                )
        return groups
