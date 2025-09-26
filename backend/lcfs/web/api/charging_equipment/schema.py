"""Schema definitions for Charging Equipment API."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
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


class EndUseTypeSchema(BaseModel):
    end_use_type_id: int
    type: str
    description: Optional[str] = None


class LevelOfEquipmentSchema(BaseModel):
    level_of_equipment_id: int
    name: str
    description: Optional[str] = None


class ChargingEquipmentBaseSchema(BaseModel):
    charging_equipment_id: Optional[int] = None
    charging_site_id: int
    status: ChargingEquipmentStatusEnum
    equipment_number: Optional[str] = None
    registration_number: Optional[str] = None
    allocating_organization_id: Optional[int] = None
    allocating_organization_name: Optional[str] = None
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment_id: int
    level_of_equipment_name: Optional[str] = None
    ports: Optional[PortsEnum] = None
    notes: Optional[str] = None
    intended_uses: Optional[List[EndUseTypeSchema]] = []
    version: Optional[int] = 1
    
    class Config:
        from_attributes = True


class ChargingEquipmentCreateSchema(BaseModel):
    charging_site_id: int
    allocating_organization_id: Optional[int] = None
    serial_number: str = Field(..., min_length=1, max_length=100)
    manufacturer: str = Field(..., min_length=1, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    level_of_equipment_id: int
    ports: Optional[PortsEnum] = None
    notes: Optional[str] = None
    intended_use_ids: Optional[List[int]] = []


class ChargingEquipmentUpdateSchema(BaseModel):
    allocating_organization_id: Optional[int] = None
    serial_number: Optional[str] = Field(None, min_length=1, max_length=100)
    manufacturer: Optional[str] = Field(None, min_length=1, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    level_of_equipment_id: Optional[int] = None
    ports: Optional[PortsEnum] = None
    notes: Optional[str] = None
    intended_use_ids: Optional[List[int]] = None


class ChargingEquipmentListItemSchema(BaseModel):
    charging_equipment_id: int
    status: ChargingEquipmentStatusEnum
    site_name: str
    registration_number: str
    version: int
    allocating_organization_name: Optional[str] = None
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment_name: str
    created_date: datetime
    updated_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ChargingEquipmentListSchema(BaseModel):
    items: List[ChargingEquipmentListItemSchema]
    total_count: int
    current_page: int
    total_pages: int
    page_size: int


class ChargingEquipmentFilterSchema(BaseModel):
    status: Optional[List[ChargingEquipmentStatusEnum]] = None
    charging_site_id: Optional[int] = None
    manufacturer: Optional[str] = None
    search_term: Optional[str] = None
    organization_id: Optional[int] = None  # For government users to filter by org


class BulkActionRequestSchema(BaseModel):
    charging_equipment_ids: List[int] = Field(..., min_items=1)


class BulkSubmitRequestSchema(BulkActionRequestSchema):
    pass


class BulkDecommissionRequestSchema(BulkActionRequestSchema):
    pass


class BulkActionResponseSchema(BaseModel):
    success: bool
    message: str
    affected_count: int
    errors: Optional[List[str]] = []