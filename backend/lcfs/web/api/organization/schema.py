from typing import Optional, List
from pydantic import BaseModel, EmailStr


class OrganizationBase(BaseModel):
    name: str
    status: int
    type: int


    
class OrganizationAttorneyAddressBase(BaseModel):
    name: str
    street_address: str
    address_other: str
    city: str
    province_state: str
    country: str
    postalCode_zipCode: str

class OrganizationAddressBase(BaseModel):
    name: str
    street_address: str
    address_other: str
    city: str
    province_state: str
    country: str
    postalCode_zipCode: str

class OrganizationAddressCreate(OrganizationAddressBase):
    pass

class OrganizationAttorneyAddressCreate(OrganizationAttorneyAddressBase):
    pass

class OrganizationCreate(OrganizationBase):
    address: OrganizationAddressCreate
    attorney_address: OrganizationAttorneyAddressCreate

class Organization(OrganizationBase):
    organization_id: int

class OrganizationSummary(BaseModel):
    organization_id: int
    name: str

    class Config:
        from_attributes = True

class OrganizationUpdate(BaseModel):
    name: Optional[str]
    status: Optional[int]
    type: Optional[int]
    address: Optional[OrganizationAddressCreate]
    attorney_address: Optional[OrganizationAttorneyAddressCreate]

class OrganizationAddress(OrganizationAddressBase):
    organization_id: int
    
class OrganizationAttorneyAddress(OrganizationAttorneyAddressBase):
    organization_id: int

class OrganizationUser(BaseModel):
    username: str
    email: EmailStr
    display_name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    user_roles: Optional[List[object]] = None
