from typing import Optional

from pydantic import BaseModel


class OrganizationBalance(BaseModel):
    """ Organization balance model """
    id: int
    organization_id: int
    credit_trade_id: int
    validated_credits: float
    deductions: float


class OrganizationAddress(BaseModel):
    """ Organization address model """
    id: int
    address_line_1: str
    address_line_2: str
    city: str
    postal_code: str
    state: str
    country: str
    other: str
    attorney_city: str
    attorney_postal_code: str
    attorney_province: str
    attorney_country: str
    attorney_address_other: str
    attorney_street_address: str
    attorney_representative_name: str


class Organization(BaseModel):
    """ Organization model """
    id: int
    name: str
    status: Optional[int]
    status_display: Optional[str]
    actions_type: Optional[int]
    actions_type_display: Optional[str]
    type: Optional[int]
    organization_balance: Optional[OrganizationBalance]
    organization_address: Optional[OrganizationAddress]
