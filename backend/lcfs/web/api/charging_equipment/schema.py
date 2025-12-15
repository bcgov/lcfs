"""Schema definitions for Charging Equipment API."""

from datetime import datetime
from typing import Optional, List
from lcfs.web.api.base import BaseSchema, PaginationResponseSchema
from pydantic import Field, field_validator
from enum import Enum


class ChargingEquipmentStatusEnum(str, Enum):
    DRAFT = "Draft"
    UPDATED = "Updated"
    SUBMITTED = "Submitted"
    VALIDATED = "Validated"
    DECOMMISSIONED = "Decommissioned"


class PortsEnum(str, Enum):
    SINGLE_PORT = "Single port"
    DUAL_PORT = "Dual port"


class EndUseTypeSchema(BaseSchema):
    end_use_type_id: int
    type: str
    description: Optional[str] = None


class EndUserTypeSchema(BaseSchema):
    end_user_type_id: int
    type_name: str


class LevelOfEquipmentSchema(BaseSchema):
    level_of_equipment_id: int
    name: str
    description: Optional[str] = None


class ChargingEquipmentBaseSchema(BaseSchema):
    charging_equipment_id: Optional[int] = None
    charging_site_id: int
    status: ChargingEquipmentStatusEnum
    equipment_number: Optional[str] = None
    registration_number: Optional[str] = None
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment_id: int
    level_of_equipment_name: Optional[str] = None
    ports: Optional[PortsEnum] = None
    notes: Optional[str] = None
    intended_uses: Optional[List[EndUseTypeSchema]] = []
    intended_users: Optional[List[EndUserTypeSchema]] = []
    latitude: float
    longitude: float
    version: Optional[int] = 1

    class Config:
        from_attributes = True


class ChargingEquipmentCreateSchema(BaseSchema):
    charging_site_id: int
    serial_number: str = Field(..., min_length=1, max_length=100)
    manufacturer: str = Field(..., min_length=1, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    level_of_equipment_id: int
    ports: Optional[PortsEnum] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    intended_use_ids: List[int] = Field(default_factory=list)
    intended_user_ids: List[int] = Field(default_factory=list)

    @field_validator("intended_use_ids")
    @classmethod
    def validate_intended_use_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one intended use is required")
        return v

    @field_validator("intended_user_ids")
    @classmethod
    def validate_intended_user_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one intended user is required")
        return v


class ChargingEquipmentUpdateSchema(BaseSchema):
    serial_number: Optional[str] = Field(None, min_length=1, max_length=100)
    manufacturer: Optional[str] = Field(None, min_length=1, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    level_of_equipment_id: Optional[int] = None
    ports: Optional[PortsEnum] = None
    notes: Optional[str] = None
    intended_use_ids: Optional[List[int]] = None
    intended_user_ids: Optional[List[int]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator("intended_use_ids")
    @classmethod
    def validate_intended_use_ids(cls, v):
        if v is not None and len(v) == 0:
            raise ValueError("At least one intended use is required")
        return v

    @field_validator("intended_user_ids")
    @classmethod
    def validate_intended_user_ids(cls, v):
        if v is not None and len(v) == 0:
            raise ValueError("At least one intended user is required")
        return v


class ChargingEquipmentListItemSchema(BaseSchema):
    charging_equipment_id: int
    charging_site_id: int
    status: ChargingEquipmentStatusEnum
    site_name: str
    organization_name: Optional[str] = None
    registration_number: str
    version: int
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment_name: str
    ports: Optional[str] = None
    intended_uses: Optional[List[EndUseTypeSchema]] = []
    intended_users: Optional[List[EndUserTypeSchema]] = []
    latitude: float
    longitude: float
    created_date: datetime
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChargingEquipmentListSchema(BaseSchema):
    items: List[ChargingEquipmentListItemSchema]
    pagination: PaginationResponseSchema


class ChargingEquipmentFilterSchema(BaseSchema):
    status: Optional[List[ChargingEquipmentStatusEnum]] = None
    charging_site_id: Optional[int] = None
    manufacturer: Optional[str] = None
    search_term: Optional[str] = None
    organization_id: Optional[int] = None  # For government users to filter by org


class BulkActionRequestSchema(BaseSchema):
    charging_equipment_ids: List[int] = Field(..., min_items=1)


class BulkSubmitRequestSchema(BulkActionRequestSchema):
    pass


class BulkDecommissionRequestSchema(BulkActionRequestSchema):
    pass


class BulkActionResponseSchema(BaseSchema):
    success: bool
    message: str
    affected_count: int
    errors: Optional[List[str]] = []
