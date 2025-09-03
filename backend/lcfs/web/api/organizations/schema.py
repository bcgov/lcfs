from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime

from lcfs.web.api.base import BaseSchema
from lcfs.web.api.base import PaginationResponseSchema


# --------------------------------------
# Base Configuration
# --------------------------------------
class BaseConfig:
    from_attributes = True


# --------------------------------------
# Organization Type
# --------------------------------------


class OrganizationTypeBase(BaseSchema):
    organization_type_id: int
    org_type: str
    description: Optional[str] = None
    is_bceid_user: bool


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


class OrganizationStatusBase(BaseSchema):
    organization_status_id: int
    status: OrganizationStatusEnum
    description: Optional[str] = None


class OrganizationStatusSchema(OrganizationStatusBase):
    pass


# --------------------------------------
# Address Base Model
# Unified Address Model for 'Organization Address' and 'Organization Attorney Address'
# --------------------------------------


class AddressBase(BaseSchema):
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
    pass


class OrganizationAddressSchema(OrganizationAddressBase):
    organization_id: Optional[int] = None


class OrganizationAddressCreateSchema(OrganizationAddressBase):
    pass


# --------------------------------------
# Organization Attorney Address
# --------------------------------------


class OrganizationAttorneyAddressBase(AddressBase):
    pass


class OrganizationAttorneyAddressSchema(OrganizationAttorneyAddressBase):
    organization_id: Optional[int] = None


class OrganizationAttorneyAddressCreateSchema(OrganizationAddressBase):
    pass


# --------------------------------------
# Organization
# --------------------------------------


class OrganizationBase(BaseSchema):
    organization_id: Optional[int] = None
    name: str
    operating_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    has_early_issuance: bool
    edrms_record: Optional[str] = None
    total_balance: Optional[int] = None
    reserved_balance: Optional[int] = None
    organization_status_id: int
    organization_type_id: int
    credit_market_contact_name: Optional[str] = None
    credit_market_contact_email: Optional[str] = None
    credit_market_contact_phone: Optional[str] = None
    credit_market_is_seller: Optional[bool] = False
    credit_market_is_buyer: Optional[bool] = False
    credits_to_sell: Optional[int] = 0
    display_in_credit_market: Optional[bool] = False


class OrganizationSchema(OrganizationBase):
    organization_address_id: Optional[int] = None
    organization_attorney_address_id: Optional[int] = None
    org_type: Optional[OrganizationTypeSchema] = None
    org_status: Optional[OrganizationStatusSchema] = None


class OrganizationListSchema(BaseSchema):
    pagination: PaginationResponseSchema
    organizations: List[OrganizationSchema]


class OrganizationCreateSchema(BaseSchema):
    name: str
    operating_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    edrms_record: Optional[str] = None
    has_early_issuance: bool
    organization_status_id: int
    organization_type_id: int
    records_address: Optional[str] = None
    credit_market_contact_name: Optional[str] = None
    credit_market_contact_email: Optional[str] = None
    credit_market_contact_phone: Optional[str] = None
    credit_market_is_seller: Optional[bool] = False
    credit_market_is_buyer: Optional[bool] = False
    credits_to_sell: Optional[int] = 0
    display_in_credit_market: Optional[bool] = False
    address: OrganizationAddressCreateSchema
    attorney_address: OrganizationAttorneyAddressCreateSchema


class OrganizationUpdateSchema(BaseSchema):
    name: Optional[str] = None
    operating_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    edrms_record: Optional[str] = None
    has_early_issuance: bool
    organization_status_id: Optional[int] = None
    organization_type_id: int
    records_address: Optional[str] = None
    credit_market_contact_name: Optional[str] = None
    credit_market_contact_email: Optional[str] = None
    credit_market_contact_phone: Optional[str] = None
    credit_market_is_seller: Optional[bool] = False
    credit_market_is_buyer: Optional[bool] = False
    credits_to_sell: Optional[int] = 0
    display_in_credit_market: Optional[bool] = False
    address: Optional[OrganizationAddressCreateSchema] = None
    attorney_address: Optional[OrganizationAttorneyAddressCreateSchema] = None


class OrganizationResponseSchema(BaseSchema):
    organization_id: int
    name: str
    operating_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    edrms_record: Optional[str] = None
    has_early_issuance: bool
    total_balance: Optional[int] = None
    reserved_balance: Optional[int] = None
    credit_market_contact_name: Optional[str] = None
    credit_market_contact_email: Optional[str] = None
    credit_market_contact_phone: Optional[str] = None
    credit_market_is_seller: Optional[bool] = False
    credit_market_is_buyer: Optional[bool] = False
    credits_to_sell: Optional[int] = 0
    display_in_credit_market: Optional[bool] = False
    organization_type_id: Optional[int] = None
    org_status: Optional[OrganizationStatusSchema] = None
    org_type: Optional[OrganizationTypeSchema] = None
    records_address: Optional[str] = None
    org_address: Optional[OrganizationAddressSchema] = None
    org_attorney_address: Optional[OrganizationAttorneyAddressSchema] = None


class OrganizationSummaryResponseSchema(BaseSchema):
    organization_id: int
    name: Optional[str] = None
    operating_name: Optional[str] = None
    total_balance: Optional[int] = None
    reserved_balance: Optional[int] = None
    org_status: Optional[OrganizationStatusSchema] = None


class OrganizationCreateResponseSchema(BaseSchema):
    organization_id: int


class OrganizationBalanceResponseSchema(BaseSchema):
    name: str
    registered: bool
    organization_id: int
    total_balance: int
    reserved_balance: int


class OrganizationDetailsSchema(BaseSchema):
    name: str
    address: Optional[str]
    email: Optional[str]
    phone: Optional[str]


class OrganizationCreditMarketUpdateSchema(BaseSchema):
    credit_market_contact_name: Optional[str] = None
    credit_market_contact_email: Optional[str] = None
    credit_market_contact_phone: Optional[str] = None
    credit_market_is_seller: Optional[bool] = False
    credit_market_is_buyer: Optional[bool] = False
    credits_to_sell: Optional[int] = 0
    display_in_credit_market: Optional[bool] = False


class OrganizationCreditMarketListingSchema(BaseSchema):
    """Schema for credit market listings - public data only"""

    organization_id: int
    organization_name: str
    credits_to_sell: Optional[int] = 0
    display_in_credit_market: bool
    credit_market_is_seller: bool
    credit_market_is_buyer: bool
    credit_market_contact_name: Optional[str] = None
    credit_market_contact_email: Optional[str] = None
    credit_market_contact_phone: Optional[str] = None


# --------------------------------------
# Link Key Operations
# --------------------------------------


class OrganizationLinkKeyBaseSchema(BaseSchema):
    """Base schema for organization link keys"""

    link_key_id: Optional[int] = None
    organization_id: int
    form_id: int
    link_key: str


class OrganizationLinkKeyCreateSchema(BaseSchema):
    """Schema for creating organization link keys"""

    form_id: int


class OrganizationLinkKeyResponseSchema(OrganizationLinkKeyBaseSchema):
    """Schema for organization link key responses"""

    link_key_id: int
    form_name: str
    form_slug: str
    create_date: datetime
    update_date: datetime


class OrganizationLinkKeysListSchema(BaseSchema):
    """Schema for listing organization link keys"""

    organization_id: int
    organization_name: str
    link_keys: List[OrganizationLinkKeyResponseSchema]


class LinkKeyOperationResponseSchema(BaseSchema):
    """Schema for link key operation responses (generate/regenerate)"""

    link_key: str
    form_id: int
    form_name: str
    form_slug: str


class LinkKeyValidationSchema(BaseSchema):
    """Schema for validating link key access"""

    organization_id: int
    form_id: int
    form_name: str
    form_slug: str
    organization_name: str
    is_valid: bool


class AvailableFormsSchema(BaseSchema):
    """Schema for available forms"""

    forms: Dict[int, Dict[str, Any]]
