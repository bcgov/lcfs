from typing import Any, List
from typing_extensions import deprecated
from fastapi import Query

from pydantic import BaseModel, Field


def row_to_dict(row, schema):
    d = {}
    for field in schema.__fields__.values():
        if isinstance(field.type_, BaseModel):
            d[field.name] = row_to_dict(d[field.name], field.type_)
            continue
        d[field.name] = getattr(row, field.name)
    return d


class SortOrder(BaseModel):
    field: str
    direction: str


class FilterModel(BaseModel):
    filter_type: str = Field(Query(default="text", alias="filterType"))
    type: str = Field(Query(default="contains", alias="type"))
    filter: Any = Field(Query(default="", alias="filter"))
    field: str = Field(Query(default="", alias="field"))


class PaginationRequestSchema(BaseModel):
    page: int = Field(Query(default=0, alias="page-number"))
    size: int = Field(Query(default=20, alias="items-per-page"))
    sortOrders: List[SortOrder] = Field(Query(default=[], alias="sort-order"))
    filters: List[FilterModel] = Field(Query(defautl=[], alias="filters"))

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class PaginationResponseScehema(BaseModel):
    total: int
    page: int
    size: int
    total_pages: int

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


@deprecated("Use Pagination Request and Response schemas instead")
class EntityResponse(BaseModel):
    status: int
    message: str
    error: dict = {}
    total: int = 0
    size: int = 10
    page: int = 1
    total_pages: int = 1
    data: Any = {}

    class Config:
        from_attributes = True
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {set: lambda v: list(v)}
        json_schema_extra = {
            "example": {
                "status": 200,
                "message": "Success",
                "error": {},
                "total": 0,
                "page": 1,
                "size": 10,
                "total_pages": 1,
                "data": [],
            }
        }
