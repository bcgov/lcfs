from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, EmailStr

class OrganizationStatusSchema(Enum):
    UNREGISTERED = 'Unregistered'
    REGISTERED = 'Registered'
    SUSPENDED = 'Suspended'
    CANCELED = 'Canceled'

class OrganizationTypeSchema(Enum):
    FUEL_SUPPLIER = 'fuel_supplier'
    ELECTRICITY_SUPPLIER = 'electricity_supplier'
    BROKER = 'broker'
    UTILITIES = 'utilities'

class OrganizationBaseSchema(BaseModel):
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
        from_attributes=True

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
    username: str
    email: EmailStr
    display_name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    user_roles: Optional[List[object]] = None
