"""Shared contract for independently maintained entity searches."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from lcfs.web.api.search.query import SearchQuery
from lcfs.web.api.search.schema import SearchResultItem

RESULT_LIMIT = 8


@dataclass(frozen=True)
class SearchContext:
    """Caller and query information shared by every entity search."""

    query: SearchQuery
    organization_id: Optional[int]
    is_government: bool

    @property
    def can_access_organization_records(self) -> bool:
        """Prevent an unbound supplier account from seeing scoped records."""
        return self.is_government or self.organization_id is not None


SearchHandler = Callable[
    [AsyncSession, SearchContext], Awaitable[list[SearchResultItem]]
]


@dataclass(frozen=True)
class EntitySearch:
    """One registered entity search and its result-group metadata."""

    entity_type: str
    label: str
    handler: SearchHandler

    async def execute(
        self, db: AsyncSession, context: SearchContext
    ) -> list[SearchResultItem]:
        """Execute the entity handler through one uniform interface."""
        return await self.handler(db, context)


def where_present(statement: Any, *predicates: Optional[ColumnElement[bool]]) -> Any:
    """Apply optional predicates without repeating defensive branching."""
    for predicate in predicates:
        if predicate is not None:
            statement = statement.where(predicate)
    return statement
