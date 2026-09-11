from typing import Any, List, Optional
from enum import Enum
from typing_extensions import deprecated
from sqlalchemy import and_, asc, cast, Date, desc, func, select, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import InstrumentedAttribute
from fastapi import HTTPException, Query, Request, Response
from fastapi_cache import FastAPICache

from pydantic import BaseModel, Field, ConfigDict, field_validator
from pydantic.alias_generators import to_camel
import math
import structlog
import re

logger = structlog.get_logger(__name__)


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ComplianceReportRequestSchema(BaseSchema):
    compliance_report_id: int


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

    @field_validator("field")
    def convert_field_to_snake(cls, value):
        return cls.validate_field(value)


class FilterModel(BaseSchema):
    filter_type: str = Field(default="text", alias="filterType")
    type: str = Field(default="contains", alias="type")
    filter: Optional[Any] = None
    values: Optional[List[Any]] = Field(default=None, alias="values")
    field: str = Field(default="", alias="field")
    date_from: Optional[str] = Field(default="", alias="dateFrom")
    date_to: Optional[str] = Field(default="", alias="dateTo")

    @classmethod
    def validate_field(cls, value):
        # Convert CamelCase to snake_case
        return camel_to_snake(value)

    @field_validator("field")
    def convert_field_to_snake(cls, value):
        return cls.validate_field(value)


class PaginationRequestSchema(BaseSchema):
    # `size` of 0 is a deliberate "return everything" sentinel used by the
    # export paths, so 0 stays valid - but a negative size is a negative
    # LIMIT, which Postgres rejects.
    page: int = Field(default=1, alias="page")
    size: int = Field(default=10, alias="size", ge=0)
    sort_orders: List[SortOrder] = Field(default=[], alias="sortOrders")
    filters: List[FilterModel] = Field(default=[], alias="filters")
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    @field_validator("page")
    @classmethod
    def clamp_page(cls, value: int) -> int:
        """
        `page` is 1-based; anything lower yields a negative OFFSET, which
        Postgres rejects. Several repos already clamp this themselves, and the
        frontend sends page=0 on at least one live path, so clamp rather than
        reject - a 422 here would break existing callers.
        """
        return max(value, 1)


class PaginationResponseSchema(BaseSchema):
    total: int
    page: int
    size: int
    total_pages: int
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


def calculate_total_pages(total: int, size: int) -> int:
    """
    Page count for a result set, safe for the size=0 "return everything"
    sentinel - dividing by it raises ZeroDivisionError.
    """
    if not total:
        return 0
    if size <= 0:
        return 1
    return math.ceil(total / size)


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

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
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
        },
    )


def validate_pagination(pagination: PaginationRequestSchema):
    """
    Validate the pagination object.

    Args:
        pagination (PaginationRequestSchema): The pagination object to validate.
    """
    if not pagination.page or pagination.page < 1:
        pagination.page = 1
    if not pagination.size or pagination.size < 1:
        pagination.size = 10
    if not pagination.sort_orders:
        pagination.sort_orders = []
    if not pagination.filters:
        pagination.filters = []
    return pagination


async def paginate_with_window_count(
    db: AsyncSession,
    query,
    offset: int,
    limit: int,
) -> tuple[list, int]:
    """
    Execute a paginated query in a single database round-trip using a window function.

    Wraps *query* (filters + sort applied, no LIMIT/OFFSET yet) in a subquery,
    adds ``COUNT(*) OVER()`` so every row carries the total filtered count, then
    applies OFFSET/LIMIT.  This replaces the two-query pattern
    (separate ``SELECT COUNT(*)`` + data query) that all paginated endpoints
    previously used.

    Returns ``(rows, total_count)``.  Each row supports the same named-attribute
    access as the original ORM objects, so callers using ``model_validate(row)``
    or ``row.field_name`` require no changes.

    Best applied to view-based queries (no ``joinedload`` / ORM relationship
    loading) on large tables where the extra count round-trip is measurable.
    """
    inner = query.subquery("_paginate_inner")
    windowed = select(inner, func.count().over().label("_wf_total"))
    result = await db.execute(windowed.offset(offset).limit(limit))
    rows = result.all()
    return rows, (rows[0]._wf_total if rows else 0)


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
        logger.error(
            "Not able to get the required field",
            error=str(e),
            field=field,
            model=model,
            exc_info=e,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to apply filter conditions",
        )


def get_enum_value(enum_class, filter_value):
    # Normalize both the filter value and enum names to lowercase
    normalized_filter_value = filter_value.strip().replace(" ", "_").lower()
    for enum_member in enum_class:
        if enum_member.name.lower() == normalized_filter_value:
            return enum_member
    raise AttributeError(f"{filter_value} not found in {enum_class}")


def apply_text_filter_conditions(field, filter_value, filter_option):
    """
    Apply text filtering conditions based on the filter option.

    Args:
       field: The field to filter on
       filter_value: The value to filter by
       filter_option: The filtering operation (equals, contains, etc)
    """
    # Apply text filtering with case and space insensitivity
    lower_no_space_field = func.lower(func.replace(cast(field, String), " ", ""))
    lower_no_space_filter_value = (
        filter_value.name.replace(" ", "").lower()
        if isinstance(filter_value, Enum)
        else str(filter_value).replace(" ", "").lower()
    )

    text_filter_mapping = {
        "true": field.is_(True),
        "false": field.is_(False),
        "contains": lower_no_space_field.like(f"%{lower_no_space_filter_value}%"),
        "notContains": lower_no_space_field.notlike(f"%{lower_no_space_filter_value}%"),
        "equals": lower_no_space_field == lower_no_space_filter_value,
        "notEqual": lower_no_space_field != lower_no_space_filter_value,
        "startsWith": lower_no_space_field.like(f"{lower_no_space_filter_value}%"),
        "endsWith": lower_no_space_field.like(f"%{lower_no_space_filter_value}"),
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
            "equals": field == filter_value,
            "notEqual": field != filter_value,
            "greaterThan": field > filter_value,
            "greaterThanOrEqual": field >= filter_value,
            "lessThan": field < filter_value,
            "lessThanOrEqual": field <= filter_value,
            "startsWith": cast(field, String).like(f"{filter_value}%"),
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
    if isinstance(filter_value, list) and len(filter_value) <= 1:
        filter_value = filter_value[0]
    date_filter_mapping = {
        "equals": cast(field, Date) == func.date(filter_value),
        "notEqual": cast(field, Date) != func.date(filter_value),
        "greaterThan": cast(field, Date) > func.date(filter_value),
        "lessThan": cast(field, Date) < func.date(filter_value),
        "inRange": and_(
            cast(field, Date) >= func.date(filter_value[0]),
            cast(field, Date) <= func.date(filter_value[1]),
        ),
    }

    return date_filter_mapping.get(filter_option)


def apply_set_filter_conditions(field, filter_values):
    """
    Apply set filtering conditions based on the filter values.

    Args:
       field: The field to filter on
       filter_values: The set of values to filter by
    """
    return field.in_(filter_values)


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
        filter_type: The type of the field (text, number, date, set)
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
        elif filter_type == "set":
            return apply_set_filter_conditions(field, filter_value)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid filter type: {filter_type}",
            )
    except Exception as e:
        logger.error(
            "Failed to apply filter conditions",
            error=str(e),
            filter_type=filter_type,
            filter_option=filter_option,
            filter_value=filter_value,
            field=field,
            exc_info=e,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to apply filter conditions",
        )


def camel_to_snake(name):
    """Convert a camel case string to snake case."""
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


class PaginatedQueryBuilder:
    """
    Shared filter -> sort -> paginate logic for repos, replacing the
    per-repo loops over ``pagination.filters``/``pagination.sort_orders``.

    Field lookups default to ``model``. For a rename, a different (e.g.
    joined) model, or bespoke logic, pass:
      - ``field_map``: incoming field name -> attribute name on ``model``.
      - ``custom_filters``: field name -> ``callable(FilterModel)`` returning
        a condition, or ``None`` to skip that filter.
      - ``custom_sorts``: (mapped) field name -> a column, or
        ``callable(SortOrder)`` returning a column or ``None`` to skip.
      - ``default_filter``: ``callable(FilterModel)`` used instead of the
        standard field-lookup/date-handling for any field with no
        ``custom_filters`` entry - for repos where most fields need bespoke
        handling rather than just a few.
    """

    def __init__(
        self,
        model: Any,
        field_map: Optional[dict] = None,
        custom_filters: Optional[dict] = None,
        custom_sorts: Optional[dict] = None,
        default_filter: Optional[Any] = None,
    ):
        self.model = model
        self.field_map = field_map or {}
        self.custom_filters = custom_filters or {}
        self.custom_sorts = custom_sorts or {}
        self.default_filter = default_filter

    def _field(self, name: str):
        return get_field_for_filter(self.model, self.field_map.get(name, name))

    def _default_sort_field(self, name: str):
        # Unlike filtering, an unknown sort field is silently skipped rather
        # than raising - several repos rely on this to ignore stale/invalid
        # sort params instead of 500ing.
        return self._field(name) if hasattr(self.model, name) else None

    def build_conditions(self, filters: List["FilterModel"]) -> list:
        """Translate pagination filters into a list of SQLAlchemy conditions."""
        conditions = []
        for filter_model in filters:
            mapped_field = self.field_map.get(filter_model.field, filter_model.field)
            handler = self.custom_filters.get(
                mapped_field, self.custom_filters.get(filter_model.field)
            )
            if handler is not None:
                condition = handler(filter_model)
                if condition is not None:
                    conditions.append(condition)
                continue

            if self.default_filter is not None:
                condition = self.default_filter(filter_model)
                if condition is not None:
                    conditions.append(condition)
                continue

            filter_value = filter_model.filter
            if filter_model.filter_type == "date":
                if filter_model.type == "inRange":
                    if not filter_model.date_from and not filter_model.date_to:
                        continue
                    filter_value = [filter_model.date_from, filter_model.date_to]
                else:
                    if not filter_model.date_from:
                        continue
                    filter_value = filter_model.date_from

            conditions.append(
                apply_filter_conditions(
                    self._field(filter_model.field),
                    filter_value,
                    filter_model.type,
                    filter_model.filter_type,
                )
            )
        return conditions

    def apply_filters(self, query, filters: List["FilterModel"]):
        """Apply pagination filters to *query*, returning the updated query."""
        conditions = self.build_conditions(filters)
        return query.where(and_(*conditions)) if conditions else query

    def apply_sorting(
        self,
        query,
        sort_orders: List["SortOrder"],
        default_field: Optional[str] = None,
        default_direction: str = "desc",
        secondary_field: Optional[str] = None,
        secondary_direction: str = "desc",
    ):
        """Apply sort orders, falling back to ``default_field`` when none are
        given; ``secondary_field`` is always appended as a tiebreaker."""
        if sort_orders:
            for order in sort_orders:
                sort_method = asc if order.direction == "asc" else desc
                mapped_field = self.field_map.get(order.field, order.field)
                override = self.custom_sorts.get(
                    mapped_field, self.custom_sorts.get(order.field)
                )
                if callable(override):
                    field = override(order)
                elif override is not None:
                    field = override
                else:
                    field = self._default_sort_field(mapped_field)
                if field is None:
                    continue
                query = query.order_by(sort_method(field))
        elif default_field:
            sort_method = asc if default_direction == "asc" else desc
            query = query.order_by(sort_method(self._field(default_field)))

        if secondary_field:
            sort_method = asc if secondary_direction == "asc" else desc
            query = query.order_by(sort_method(self._field(secondary_field)))
        return query

    @staticmethod
    def offset_limit(pagination: "PaginationRequestSchema") -> tuple[int, int]:
        offset = 0 if pagination.page < 1 else (pagination.page - 1) * pagination.size
        return offset, pagination.size

    async def paginate(
        self, db: AsyncSession, query, pagination: "PaginationRequestSchema"
    ) -> tuple[list, int]:
        """Apply offset/limit and execute via the single round-trip window count."""
        offset, limit = self.offset_limit(pagination)
        return await paginate_with_window_count(db, query, offset, limit)


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
        if key == "args":
            for v in value:
                if "object at" not in str(v):
                    request_key += f"{key}:{v}"
        elif "object at" not in str(value):
            request_key += f"{key}:{value}"
    # Build the cache key
    cache_key = f"{prefix}:{namespace}:{func.__name__}:{request_key}"
    logger.info("Cache key generated", cache_key=cache_key)

    # Return the cache key
    return cache_key


class AudienceType(Enum):
    """Defines the target audience for notifications."""

    SAME_ORGANIZATION = (
        "same_organization"  # Notify users in the same organization + government
    )
    OTHER_ORGANIZATIONS = "other_organizations"  # Notify all other organizations (exclude posting org + government)
    GOVERNMENT_ONLY = "government_only"  # Notify only government users
    ALL_EXCEPT_POSTING_ORG = (
        "all_except_posting_org"  # Notify everyone except the posting organization
    )


class NotificationTypeEnum(Enum):
    BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT = (
        "BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT"
    )
    BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL = (
        "BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL"
    )
    BCEID__TRANSFER__DIRECTOR_DECISION = "BCEID__TRANSFER__DIRECTOR_DECISION"
    BCEID__TRANSFER__PARTNER_ACTIONS = "BCEID__TRANSFER__PARTNER_ACTIONS"
    IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION = (
        "IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION"
    )
    IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION = (
        "IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION"
    )
    IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW = (
        "IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW"
    )
    IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST = (
        "IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST"
    )
    IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED = (
        "IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED"
    )
    IDIR_ANALYST__TRANSFER__RESCINDED_ACTION = (
        "IDIR_ANALYST__TRANSFER__RESCINDED_ACTION"
    )
    IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW = (
        "IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW"
    )
    IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION = (
        "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION"
    )
    IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT = (
        "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT"
    )
    IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW = (
        "IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW"
    )
    IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION = (
        "IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION"
    )
    IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION = (
        "IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION"
    )
    IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION = (
        "IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION"
    )
    IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION = (
        "IDIR_ANALYST__FUEL_CODE__EXPIRY_NOTIFICATION"
    )
    IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION = (
        "IDIR_DIRECTOR__FUEL_CODE__ANALYST_RECOMMENDATION"
    )
    IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION = (
        "IDIR_DIRECTOR__CI_APPLICATION__ANALYST_RECOMMENDATION"
    )
    IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED = (
        "IDIR_ANALYST__FUEL_CODE__DIRECTOR_RETURNED"
    )
    IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL = (
        "IDIR_ANALYST__FUEL_CODE__DIRECTOR_APPROVAL"
    )
    IDIR_ANALYST__CI_APPLICATION__DIRECTOR_APPROVAL = (
        "IDIR_ANALYST__CI_APPLICATION__DIRECTOR_APPROVAL"
    )
    IDIR_ANALYST__CI_APPLICATION__DIRECTOR_RETURNED = (
        "IDIR_ANALYST__CI_APPLICATION__DIRECTOR_RETURNED"
    )
    IDIR_ANALYST__CI_APPLICATION__APPLICANT_ACTIVITY = (
        "IDIR_ANALYST__CI_APPLICATION__APPLICANT_ACTIVITY"
    )
    BCEID__CI_APPLICATION__GOVERNMENT_ACTION = (
        "BCEID__CI_APPLICATION__GOVERNMENT_ACTION"
    )
    BCEID__CI_APPLICATION__FUEL_CODE_APPROVED = (
        "BCEID__CI_APPLICATION__FUEL_CODE_APPROVED"
    )
    BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE = (
        "BCEID__CREDIT_MARKET__CREDITS_LISTED_FOR_SALE"
    )
    PUBLIC__CREDIT_MARKET_MONTHLY_REPORT = "PUBLIC__CREDIT_MARKET_MONTHLY_REPORT"
    BCEID__GOVERNMENT_NOTIFICATION = "BCEID__GOVERNMENT_NOTIFICATION"
    IDIR_ANALYST__GOVERNMENT_NOTIFICATION = "IDIR_ANALYST__GOVERNMENT_NOTIFICATION"
    IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION = (
        "IDIR_COMPLIANCE_MANAGER__GOVERNMENT_NOTIFICATION"
    )
    IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION = "IDIR_DIRECTOR__GOVERNMENT_NOTIFICATION"

    def __str__(self):
        return self.value


class Auditable(BaseModel):
    create_user: Optional[str]
    update_user: Optional[str]


class Versioning(BaseModel):
    group_uuid: str
    version: int
    action_type: str
