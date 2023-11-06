from pydantic import BaseModel, Optional


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
    id: int

class OrganizationUpdate(BaseModel):
    name: Optional[str]
    status: Optional[int]
    type: Optional[int]
    address: Optional[OrganizationAddressCreate]
    attorney_address: Optional[OrganizationAttorneyAddressCreate]

class OrganizationAddress(OrganizationAddressBase):
    id: int
    
class OrganizationAttorneyAddress(OrganizationAttorneyAddressBase):
    id: int
