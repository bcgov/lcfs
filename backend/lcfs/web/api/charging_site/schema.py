from pydantic import BaseModel, Field
from typing import List, Optional
from lcfs.services.s3.schema import FileResponseSchema
from lcfs.web.api.base import PaginationResponseSchema


class EndUserTypeSchema(BaseModel):
    end_user_type_id: int
    type_name: str
    intended_use: bool


class ChargingSiteBaseSchema(BaseModel):
    charging_site_id: int
    site_code: str
    site_name: str
    street_address: str
    city: str
    postal_code: str
    notes: Optional[str] = None
    status: str
    organization_name: str
    version: int
    intended_users: List[EndUserTypeSchema] = Field(default_factory=list)


class ChargingSiteStatusSchema(BaseModel):
    charging_site_status_id: int
    status: str
    description: Optional[str] = None


class ChargingEquipmentForSiteSchema(BaseModel):
    charging_equipment_id: int
    equipment_number: str
    registration_number: str
    version: int = 1
    allocating_organization: Optional[str] = None
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment: str
    ports: Optional[str] = None
    intended_use_types: List[str] = Field(default_factory=list)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    equipment_notes: Optional[str] = None


class ChargingSiteWithAttachmentsSchema(ChargingSiteBaseSchema):
    attachments: List[FileResponseSchema] = Field(default_factory=list)


class BulkEquipmentStatusUpdateSchema(BaseModel):
    equipment_ids: List[int]
    new_status: str


class ChargingEquipmentPaginatedSchema(BaseModel):
    equipment: List[ChargingEquipmentForSiteSchema]
    pagination: PaginationResponseSchema


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
