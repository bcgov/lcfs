from typing import Any, List, Optional
from typing_extensions import deprecated
from sqlalchemy import and_
from sqlalchemy.orm.attributes import InstrumentedAttribute
from fastapi import HTTPException, Query, Request, Response
from fastapi_cache import FastAPICache

from pydantic import BaseModel, Field, ConfigDict, validator
from pydantic.alias_generators import to_camel
from logging import getLogger
import re

logger = getLogger("base")

class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

def row_to_dict(row, schema):
    d = {}
    for field in schema.__fields__.values():
        if isinstance(field.type_, BaseModel):
            d[field.name] = row_to_dict(d[field.name], field.type_)
            continue
        d[field.name] = getattr(row, field.name)
    return d


class SortOrder(BaseSchema):
    field: str
    direction: str
    
    @classmethod
    def validate_field(cls, value):
        # Convert CamelCase to snake_case
        return camel_to_snake(value)

    @validator("field", pre=True)
    def convert_field_to_snake(cls, value):
        return cls.validate_field(value)


class FilterModel(BaseSchema):
    filter_type: str = Field(Query(default="text", alias="filterType"))
    type: str = Field(Query(default="contains", alias="type"))
    filter: Any = Field(Query(default="", alias="filter"))
    field: str = Field(Query(default="", alias="field"))

    @classmethod
    def validate_field(cls, value):
        # Convert CamelCase to snake_case
        return camel_to_snake(value)

    @validator("field", pre=True)
    def convert_field_to_snake(cls, value):
        return cls.validate_field(value)


class PaginationRequestSchema(BaseSchema):
    page: int = Field(Query(default=0, alias="page"))
    size: int = Field(Query(default=20, alias="size"))
    sort_orders: List[SortOrder] = Field(Query(default=[], alias="sortOrders"))
    filters: List[FilterModel] = Field(Query(defautl=[], alias="filters"))

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class PaginationResponseSchema(BaseSchema):
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
    if not pagination.sort_orders:
        pagination.sort_orders = []
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
    if isinstance(filter_value, list):
        return and_(field >= filter_value[0], field <= filter_value[1])
    else:
        number_filter_mapping = {
            "equals": field == int(filter_value),
            "notEqual": field != int(filter_value),
            "greaterThan": field > int(filter_value),
            "greaterThanOrEqual": field >= int(filter_value),
            "lessThan": field < int(filter_value),
            "lessThanOrEqual": field <= int(filter_value),
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
        if filter_type == "text":
            return apply_text_filter_conditions(field, filter_value, filter_option)
        elif filter_type == "number":
            return apply_number_filter_conditions(field, filter_value, filter_option)
        elif filter_type == "date":
            return apply_date_filter_conditions(field, filter_value, filter_option)
        else:
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

def camel_to_snake(name):
    """Convert a camel case string to snake case."""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

async def lcfs_cache_key_builder(
    func,
    namespace: Optional[str] = "",
    request: Request = None,
    response: Response = None,
    *args,
    **kwargs,
):
    """
    Build a cache key for a function using the request and response objects.

    Args:
        func: The function to build the cache key for
        namespace: The namespace to use for the cache key
        request: The request object
        response: The response object
        args: Positional arguments for the function
        kwargs: Keyword arguments for the function

    Returns:
        The cache key for the function
    """
    # Get the FastAPICache prefix
    prefix = FastAPICache.get_prefix()
    request_key = ""
    for key, value in kwargs.items():
        if "object at" not in str(value):
            request_key += f"{key}:{value}"
    # Build the cache key
    cache_key = f"{prefix}:{namespace}:{func.__name__}:{request_key}"
    logger.info(f"Cache key: {cache_key}")

    # Return the cache key
    return cache_key
