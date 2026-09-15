from typing import Optional

from pydantic import Field

from lcfs.web.api.base import BaseSchema


class SearchResultDetail(BaseSchema):
    """One labelled fact displayed within a search result."""

    label: str
    value: str


class SearchResultItem(BaseSchema):
    """Normalized result contract shared by every searchable entity."""

    entity_type: str
    entity_id: int
    title: str
    subtitle: str
    route: str
    status: Optional[str] = None
    meta: Optional[str] = None
    match_context: Optional[str] = None
    details: list[SearchResultDetail] = Field(default_factory=list)


class SearchGroup(BaseSchema):
    """Results belonging to one registered entity type."""

    entity_type: str
    label: str
    items: list[SearchResultItem]


class SearchResponse(BaseSchema):
    """Complete response returned by global search."""

    query: str
    groups: list[SearchGroup]
    total: int
    applied_filters: dict[str, str] = Field(default_factory=dict)
