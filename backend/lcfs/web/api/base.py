from typing import Any, List
from typing_extensions import deprecated
from sqlalchemy import or_, and_, func, inspect, literal_column
from sqlalchemy.orm.attributes import InstrumentedAttribute
from fastapi import HTTPException, Query

from pydantic import BaseModel, Field


def row_to_dict(row, schema):
    d = {}
    for field in schema.__fields__.values():
        if isinstance(field.type_, BaseModel):
            d[field.name] = row_to_dict(d[field.name], field.type_)
            continue
        d[field.name] = getattr(row, field.name)
    return d


def get_field_for_filter(model, field):
    if hasattr(model, field):
        field = getattr(model, field)
        if isinstance(field, InstrumentedAttribute):
            return field.property.columns[0]
        else:
            return field
    return model[field]


def apply_text_filter_conditions(field, filter_value, filter_option):
    text_filter_mapping = {
        "true": field.is_(True),
        "false": field.is_(False),
        "contains": field.like(f"%{filter_value}%"),
        "notContains": field.notlike(f"%{filter_value}%"),
        "equals": field == filter_value,
        "notEqual": field != filter_value,
        "startsWith": field.like(f"{filter_value}%"),
        "endsWith": field.like(f"%{filter_value}%"),
    }

    return text_filter_mapping.get(filter_option)


def apply_number_filter_conditions(field, filter_value, filter_option):
    number_filter_mapping = {
        "equals": field == filter_value,
        "notEqual": field != filter_value,
        "greaterThan": field > filter_value,
        "greaterThanOrEqual": field >= filter_value,
        "lessThan": field < filter_value,
        "lessThanOrEqual": field <= filter_value,
        "inRange": and_(field >= filter_value[0], field <= filter_value[1]),
    }

    return number_filter_mapping.get(filter_option)


def apply_date_filter_conditions(field, filter_value, filter_option):
    date_filter_mapping = {
        "equals": field == filter_value,
        "notEqual": field != filter_value,
        "greaterThan": field > filter_value,
        "lessThan": field < filter_value,
        "inRange": and_(field >= filter_value[0], field <= filter_value[1]),
    }

    return date_filter_mapping.get(filter_option)


def apply_generic_filter_conditions(field, filter_value, filter_option):
    generic_filter_mapping = {
        "blank": field.is_(None),
        "notBlank": field.isnot(None),
        "empty": field == "",
    }

    return generic_filter_mapping.get(filter_option)


def apply_filter_conditions(field, filter_value, filter_option, filter_type):
    if filter_option in ["blank", "notBlank", "empty"]:
        return apply_generic_filter_conditions(field, filter_value, filter_option)

    # Handle various filter types
    match filter_type:
        case "text":
            return apply_text_filter_conditions(field, filter_value, filter_option)
        case "number":
            return apply_number_filter_conditions(field, filter_value, filter_option)
        case "date":
            return apply_date_filter_conditions(field, filter_value, filter_option)
        case _:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid filter type: {filter_type}",
            )


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
