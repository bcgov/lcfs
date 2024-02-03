from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict, Field

from lcfs.web.api.base import PaginationResponseSchema


class OrganizationStatusEnum(str, Enum):
    UNREGISTERED = "Unregistered"
    REGISTERED = "Registered"
    SUSPENDED = "Suspended"
    CANCELED = "Canceled"


class OrganizationTypeEnum(str, Enum):
    FUEL_SUPPLIER = "fuel_supplier"
    ELECTRICITY_SUPPLIER = "electricity_supplier"
    BROKER = "broker"
    UTILITIES = "utilities"


class OrganizationStatusBase(BaseModel):
    organization_status_id: int
    status: str
    description: str

    class Config:
        from_attributes = True


class OrganizationTypeBase(BaseModel):
    organization_type_id: int
    org_type: str
    description: str

    class Config:
        from_attributes = True


class OrganizationBase(BaseModel):
    organization_id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    edrms_record: Optional[str]
    organization_status_id: int
    organization_type_id: int
    organization_address_id: Optional[int]
    organization_attorney_address_id: Optional[int]
    org_type: Optional[OrganizationTypeBase] = []
    org_status: Optional[OrganizationStatusBase] = []

    class Config:
        from_attributes = True


class OrganizationBaseSchema(BaseModel):
    organization_id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    edrms_record: Optional[str]
    organization_status_id: int
    organization_type_id: int


class OrganizationAttorneyAddressBaseSchema(BaseModel):
    name: str
    street_address: str
    address_other: str
    city: str
    province_state: str
    country: str
    postalCode_zipCode: str


class OrganizationAddressBaseSchema(BaseModel):
    name: str
    street_address: str
    address_other: str
    city: str
    province_state: str
    country: str
    postalCode_zipCode: str


class OrganizationAddressCreateSchema(OrganizationAddressBaseSchema):
    pass


class OrganizationAttorneyAddressCreateSchema(OrganizationAttorneyAddressBaseSchema):
    pass


class OrganizationCreateSchema(OrganizationBaseSchema):
    address: OrganizationAddressCreateSchema
    attorney_address: OrganizationAttorneyAddressCreateSchema


class OrganizationSchema(OrganizationBaseSchema):
    organization_id: int

    class Config:
        from_attributes = True


class OrganizationSummarySchema(BaseModel):
    organization_id: int
    name: str

    class Config:
        from_attributes = True


class OrganizationUpdateSchema(BaseModel):
    name: Optional[str]
    status: Optional[int]
    type: Optional[int]
    address: Optional[OrganizationAddressCreateSchema]
    attorney_address: Optional[OrganizationAttorneyAddressCreateSchema]


class OrganizationAddressSchema(OrganizationAddressBaseSchema):
    organization_id: int


class OrganizationAttorneyAddressSchema(OrganizationAttorneyAddressBaseSchema):
    organization_id: int


class OrganizationUserSchema(BaseModel):
    email: EmailStr
    display_name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    user_roles: Optional[List[object]] = None


class AddressBaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    street_address: str
    address_other: str
    city: str
    province_state: str
    country: str
    postalCode_zipCode: str


class StatusBaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    status: OrganizationStatusEnum


class GetOrganizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    email: Optional[EmailStr]
    phone: Optional[str]
    edrms_record: Optional[str]
    org_status: StatusBaseSchema
    org_address: Optional[AddressBaseSchema]
    org_attorney_address: Optional[AddressBaseSchema]


class Organizations(BaseModel):
    pagination: PaginationResponseSchema
    organizations: List[OrganizationBase]

class MiniOrganization(BaseModel):
    name: str
    organization_id: int
    balance: float