from datetime import datetime
from pydantic import Field
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
    status_id: int
    status: Optional[ChargingSiteStatusSchema] = None

    version: int
    site_code: str
    site_name: str
    street_address: str
    city: str
    postal_code: str
    latitude: float
    longitude: float
    intended_users: List[EndUserTypeSchema] = Field(default_factory=list)
    documents: Optional[List[FileResponseSchema]] = Field(default_factory=list)
    notes: Optional[str] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
    create_user: Optional[str] = None
    update_user: Optional[str] = None


class ChargingSiteWithAttachmentsSchema(ChargingSiteSchema):
    attachments: List[FileResponseSchema] = Field(default_factory=list)


class DeleteChargingSiteResponseSchema(BaseSchema):
    message: str


class ChargingSitesSchema(BaseSchema):
    charging_sites: List[ChargingSiteSchema] = Field(default_factory=list)
    pagination: PaginationResponseSchema


class ChargingSiteCreateSchema(BaseSchema):
    charging_site_id: Optional[int] = None
    organization_id: int
    status_id: Optional[int] = None
    current_status: Optional[str] = None
    site_name: str
    site_code: Optional[str] = None
    street_address: str
    city: str
    postal_code: str
    latitude: float
    longitude: float
    intended_users: List[EndUserTypeSchema] = Field(default_factory=list)
    notes: Optional[str] = None
    deleted: Optional[bool] = None


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
    version: int
    intended_users: List[EndUserTypeSchema] = Field(default_factory=list)


class ChargingSiteStatusSchema(BaseSchema):
    charging_site_status_id: int
    status: str
    description: Optional[str] = None


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
    organization_name: Optional[str] = None
    allocating_organization: Optional[OrganizationSchema] = None
    registration_number: str
    version: int = 1
    serial_number: str
    manufacturer: str
    model: Optional[str] = None
    level_of_equipment: Optional[LevelOfEquipmentSchema] = None
    ports: Optional[PortsEnum] = None
    intended_use_types: List[EndUseTypeSchema] = Field(default_factory=list)
    notes: Optional[str] = None
    charging_site: Optional[ChargingSiteCreateSchema] = None

    @classmethod
    def model_validate(cls, obj, **kwargs):
        # Map intended_uses to intended_use_types
        if hasattr(obj, "intended_uses") and not hasattr(obj, "intended_use_types"):
            obj.intended_use_types = obj.intended_uses
        return super().model_validate(obj, **kwargs)


class ChargingSiteWithAttachmentsSchema(ChargingSiteBaseSchema):
    attachments: List[FileResponseSchema] = Field(default_factory=list)


class BulkEquipmentStatusUpdateSchema(BaseSchema):
    equipment_ids: List[int]
    new_status: str


class ChargingEquipmentPaginatedSchema(BaseSchema):
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


# from HEAD, conformed to BaseSchema naming and style
class ChargingEquipmentForSiteSchema(BaseSchema):
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


class ChargingEquipmentPaginatedSchema(BaseSchema):
    equipment: List[ChargingEquipmentForSiteSchema]
    pagination: PaginationResponseSchema


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
