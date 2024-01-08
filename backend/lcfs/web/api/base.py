from typing import Any, List
from typing_extensions import deprecated
from sqlalchemy import and_
from sqlalchemy.orm.attributes import InstrumentedAttribute
from fastapi import HTTPException, Query

from pydantic import BaseModel, Field
from logging import getLogger

logger = getLogger("base")


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


class PaginationResponseSchema(BaseModel):
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


def validate_pagination(pagination: PaginationRequestSchema):
    """
    Validate the pagination object.

    Args:
        pagination (PaginationRequestSchema): The pagination object to validate.
    """
    logger.info("Validating pagination")
    logger.debug(f"Pagination: {pagination}")

    if not pagination.page or pagination.page < 1:
        pagination.page = 1
    if not pagination.size or pagination.size < 1:
        pagination.size = 10
    if not pagination.sortOrders:
        pagination.sortOrders = []
    if not pagination.filters:
        pagination.filters = []
    return pagination


def get_field_for_filter(model, field):
    """
    Get the field from the model based on the field name.

    Args:
        model: The model to get the field from
        field: The field name to get
    """
    try:
        if hasattr(model, field):
            field = getattr(model, field)
            if isinstance(field, InstrumentedAttribute):
                return field.property.columns[0]
            else:
                return field
        return model[field]
    except Exception as e:
        logger.error(f"Not able to get the required field: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to apply filter conditions",
        )


def apply_text_filter_conditions(field, filter_value, filter_option):
    """
    Apply text filtering conditions based on the filter option.

    Args:
       field: The field to filter on
       filter_value: The value to filter by
       filter_option: The filtering operation (equals, contains, etc)
    """
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
    """
    Apply number filtering conditions based on the filter option.

    Args:
       field: The field to filter on
       filter_value: The value to filter by
       filter_option: The filtering operation (equals, greater than, etc)
    """
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
    """
    Apply date filtering conditions based on the filter option.

    Args:
       field: The field to filter on
       filter_value: The value to filter by
       filter_option: The filtering operation
    """
    date_filter_mapping = {
        "equals": field == filter_value,
        "notEqual": field != filter_value,
        "greaterThan": field > filter_value,
        "lessThan": field < filter_value,
        "inRange": and_(field >= filter_value[0], field <= filter_value[1]),
    }

    return date_filter_mapping.get(filter_option)


def apply_generic_filter_conditions(field, filter_value, filter_option):
    """
    Apply generic filtering conditions based on the filter option.

    Args:
       field: The field to filter on
       filter_value: The value to filter by
       filter_option: The filtering operation (blank, notBlank, empty)
    """
    generic_filter_mapping = {
        "blank": field.is_(None),
        "notBlank": field.isnot(None),
        "empty": field.is_(""),
    }

    return generic_filter_mapping.get(filter_option)


def apply_filter_conditions(field, filter_value, filter_option, filter_type):
    """
    Apply filtering conditions based on the filter option and filter type.

    Args:
        field: The field to filter on
        filter_value: The value to filter by
        filter_option: The filtering operation
        filter_type: The type of the field (text, number, date)
    """
    try:
        # Handle generic filter options (blank, notBlank, empty)
        if filter_option in ["blank", "notBlank", "empty"]:
            return apply_generic_filter_conditions(field, filter_value, filter_option)

        # Handle various filter types
        match filter_type:
            # Handle text filter options (contains, notContains, equals, notEqual, startsWith, endsWith)
            case "text":
                return apply_text_filter_conditions(field, filter_value, filter_option)
            # Handle number filter options (equals, notEqual, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, inRange)
            case "number":
                return apply_number_filter_conditions(
                    field, filter_value, filter_option
                )
            # Handle date filter options (equals, notEqual, greaterThan, lessThan, inRange)
            case "date":
                return apply_date_filter_conditions(field, filter_value, filter_option)
            case _:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid filter type: {filter_type}",
                )
    except Exception as e:
        logger.error(f"Failed to apply filter conditions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to apply filter conditions",
        )
