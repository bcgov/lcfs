from datetime import datetime
from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    PaginationResponseSchema,
    SortOrder,
)
from typing import List, Optional

from lcfs.web.api.fuel_code.schema import EndUserTypeSchema


class ChargingSiteStatusSchema(BaseSchema):
    charging_site_status_id: int
    status: str


class ChargingSiteSchema(BaseSchema):
    charging_site_id: int
    organization_id: int
    status: Optional[ChargingSiteStatusSchema] = None
    status_id: int
    site_code: str
    site_name: str
    street_address: str
    city: str
    postal_code: str
    latitude: float
    longitude: float
    intended_users: List[EndUserTypeSchema] = []
    notes: Optional[str] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    create_user: Optional[str] = None
    update_user: Optional[str] = None


class DeleteChargingSiteResponseSchema(BaseSchema):
    message: str


class ChargingSitesSchema(BaseSchema):
    charging_sites: Optional[list[ChargingSiteSchema]] = []
    pagination: PaginationResponseSchema


class ChargingSiteCreateSchema(BaseSchema):
    charging_site_id: Optional[int] = None
    organization_id: int
    status_id: Optional[int] = None
    status: Optional[str] = None
    site_name: str
    site_code: Optional[str] = None
    street_address: str
    city: str
    postal_code: str
    latitude: float
    longitude: float
    intended_users: List[EndUserTypeSchema] = []
    notes: Optional[str] = None
    deleted: Optional[bool] = False


class CommonPaginatedCSRequestSchema(BaseSchema):
    filters: Optional[List[FilterModel]] = None
    page: Optional[int] = None
    size: Optional[int] = None
    sort_orders: Optional[List[SortOrder]] = None
