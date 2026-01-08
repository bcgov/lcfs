from datetime import datetime
from typing import List, Optional
from pydantic import Field, field_validator
from lcfs.services.s3.schema import FileResponseSchema
from enum import Enum
from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    PaginationResponseSchema,
    SortOrder,
)
from lcfs.web.api.fuel_code.schema import EndUseTypeSchema, EndUserTypeSchema


class OrganizationSchema(BaseSchema):
    organization_id: int
    name: str


class ChargingSiteStatusSchema(BaseSchema):
    charging_site_status_id: int
    status: str


class ChargingSiteSchema(BaseSchema):
    charging_site_id: int
    organization_id: int
    organization: Optional[OrganizationSchema] = None
    allocating_organization_id: Optional[int] = None
    allocating_organization: Optional[OrganizationSchema] = None
    allocating_organization_name: Optional[str] = None
    status_id: int
    status: Optional[ChargingSiteStatusSchema] = None

    version: int
    site_code: str
    site_name: str
    street_address: str
    city: str
    postal_code: str
    latitude: float = Field(
        ..., ge=-90, le=90, description="Latitude must be between -90 and 90 degrees"
    )
    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
        description="Longitude must be between -180 and 180 degrees",
    )
    documents: Optional[List[FileResponseSchema]] = Field(default_factory=list)
    notes: Optional[str] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    create_user: Optional[str] = None
    update_user: Optional[str] = None


class DeleteChargingSiteResponseSchema(BaseSchema):
    message: str


class ChargingSitesSchema(BaseSchema):
    charging_sites: List[ChargingSiteSchema] = Field(default_factory=list)
    pagination: PaginationResponseSchema


class ChargingSiteCreateSchema(BaseSchema):
    charging_site_id: Optional[int] = None
    organization_id: int
    allocating_organization_id: Optional[int] = None
    allocating_organization_name: Optional[str] = None
    status_id: Optional[int] = None
    current_status: Optional[str] = None
    site_name: str
    site_code: Optional[str] = None
    street_address: str
    city: str
    postal_code: str
    latitude: float = Field(
        ..., ge=-90, le=90, description="Latitude must be between -90 and 90 degrees"
    )
    longitude: float = Field(
        ...,
        ge=-180,
        le=180,
        description="Longitude must be between -180 and 180 degrees",
    )
    notes: Optional[str] = None
    deleted: Optional[bool] = None

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v):
        if v < -90 or v > 90:
            raise ValueError("Latitude must be between -90 and 90 degrees")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v):
        if v < -180 or v > 180:
            raise ValueError("Longitude must be between -180 and 180 degrees")
        return v


class CommonPaginatedCSRequestSchema(BaseSchema):
    filters: Optional[List[FilterModel]] = None
    page: Optional[int] = None
    size: Optional[int] = None
    sort_orders: Optional[List[SortOrder]] = None


class ChargingSiteBaseSchema(BaseSchema):
    charging_site_id: int
    site_code: str
    site_name: str
    street_address: str
    city: str
    postal_code: str
    notes: Optional[str] = None
    status: str
    organization_name: str
    allocating_organization_name: Optional[str] = None
    version: int


class ChargingEquipmentStatusSchema(BaseSchema):
    charging_equipment_status_id: int
    status: str
    description: Optional[str] = None


class LevelOfEquipmentSchema(BaseSchema):
    level_of_equipment_id: int
    name: str
    description: Optional[str] = None
    display_order: int


class PortsEnum(str, Enum):
    SINGLE = "Single port"
    DUAL = "Dual port"


class ChargingEquipmentForSiteSchema(BaseSchema):
    charging_equipment_id: int
    charging_site_id: Optional[int]
    status: Optional[ChargingEquipmentStatusSchema] = None
    equipment_number: str
    registration_number: str
    version: int = 1
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment: Optional[LevelOfEquipmentSchema] = None
    ports: Optional[PortsEnum] = None
    intended_use_types: List[EndUseTypeSchema] = Field(default_factory=list)
    intended_user_types: List[EndUserTypeSchema] = Field(default_factory=list)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    charging_site: Optional[ChargingSiteCreateSchema] = None

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Map intended_uses to intended_use_types and intended_users to intended_user_types
        if hasattr(obj, "intended_uses") and not hasattr(obj, "intended_use_types"):
            obj.intended_use_types = obj.intended_uses
        if hasattr(obj, "intended_users") and not hasattr(obj, "intended_user_types"):
            obj.intended_user_types = obj.intended_users
        return super().model_validate(obj, **kwargs)


class BulkEquipmentStatusUpdateSchema(BaseSchema):
    equipment_ids: List[int]
    new_status: str


class ChargingSiteStatusEnum:
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    VALIDATED = "Validated"
    UPDATED = "Updated"


class EquipmentStatusEnum:
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    VALIDATED = "Validated"
    UPDATED = "Updated"
    DECOMMISSIONED = "Decommissioned"


class ChargingEquipmentPaginatedSchema(BaseSchema):
    equipments: List[ChargingEquipmentForSiteSchema]
    pagination: PaginationResponseSchema
