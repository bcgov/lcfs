from enum import Enum
from typing import List, Optional

from pydantic import BaseModel

from lcfs.web.api.base import PaginationResponseSchema


# --------------------------------------
# Base Configuration
# --------------------------------------
class BaseConfig:
    from_attributes = True

# --------------------------------------
# Organization Type
# --------------------------------------


class OrganizationTypeEnum(str, Enum):
    FUEL_SUPPLIER = "Fuel Supplier"
    ELECTRICITY_SUPPLIER = "Electricity Supplier"
    BROKER = "Broker"
    UTILITIES = "Utilities (local or public)"


class OrganizationTypeBase(BaseModel):
    organization_type_id: int
    org_type: OrganizationTypeEnum
    description: Optional[str] = None

    class Config(BaseConfig):
        pass


class OrganizationTypeSchema(OrganizationTypeBase):
    pass

# --------------------------------------
# Organization Status
# --------------------------------------


class OrganizationStatusEnum(str, Enum):
    UNREGISTERED = "Unregistered"
    REGISTERED = "Registered"
    SUSPENDED = "Suspended"
    CANCELED = "Canceled"


class OrganizationStatusBase(BaseModel):
    organization_status_id: int
    status: OrganizationStatusEnum
    description: Optional[str] = None

    class Config(BaseConfig):
        pass


class OrganizationStatusSchema(OrganizationStatusBase):
    pass

# --------------------------------------
# Address Base Model
# Unified Address Model for 'Organization Address' and 'Organization Attorney Address'
# --------------------------------------


class AddressBase(BaseModel):
    name: str
    street_address: str
    address_other: Optional[str] = None
    city: str
    province_state: str
    country: str
    postalCode_zipCode: Optional[str] = None

# --------------------------------------
# Organization Address
# --------------------------------------


class OrganizationAddressBase(AddressBase):

    class Config(BaseConfig):
        pass


class OrganizationAddressSchema(OrganizationAddressBase):
    organization_id: Optional[int] = None


class OrganizationAddressCreateSchema(OrganizationAddressBase):
    pass

# --------------------------------------
# Organization Attorney Address
# --------------------------------------


class OrganizationAttorneyAddressBase(AddressBase):

    class Config(BaseConfig):
        pass


class OrganizationAttorneyAddressSchema(OrganizationAttorneyAddressBase):
    organization_id: Optional[int] = None


class OrganizationAttorneyAddressCreateSchema(OrganizationAddressBase):
    pass

# --------------------------------------
# Organization
# --------------------------------------


class OrganizationBase(BaseModel):
    organization_id: Optional[int] = None
    name: str
    operating_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    edrms_record: Optional[str] = None
    organization_status_id: int
    organization_type_id: int

    class Config(BaseConfig):
        pass


class OrganizationSchema(OrganizationBase):
    organization_address_id: Optional[int] = None
    organization_attorney_address_id: Optional[int] = None
    org_type: Optional[OrganizationTypeSchema] = []
    org_status: Optional[OrganizationStatusSchema] = []


class OrganizationListSchema(BaseModel):
    pagination: PaginationResponseSchema
    organizations: List[OrganizationSchema]


class OrganizationCreateSchema(OrganizationBase):
    address: OrganizationAddressCreateSchema
    attorney_address: OrganizationAttorneyAddressCreateSchema


class OrganizationUpdateSchema(BaseModel):
    name: Optional[str] = None
    status: Optional[int] = None
    type: Optional[int] = None
    address: Optional[OrganizationAddressCreateSchema] = []
    attorney_address: Optional[OrganizationAttorneyAddressCreateSchema] = []


class OrganizationResponseSchema(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    edrms_record: Optional[str] = None
    org_status: OrganizationStatusSchema
    org_address: Optional[OrganizationAddressSchema] = []
    org_attorney_address: Optional[OrganizationAttorneyAddressSchema] = []

    class Config(BaseConfig):
        pass


class OrganizationSummaryResponseSchema(BaseModel):
    organization_id: int
    name: Optional[str] = None
    balance: Optional[float] = None

    class Config(BaseConfig):
        pass

class OrganizationCreateResponseSchema(BaseModel):
    organization_id: int
