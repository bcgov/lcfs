"""Schemas for the LCJFIP application API (#5532)."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import Field, field_validator, model_validator

from lcfs.web.api.base import BaseSchema

# Column limits from the data model (#5501), so out-of-range input is a 422
# rather than a database error.
MAX_LITRES = 10**12
MAX_PRICE = Decimal("999999.9999")
MAX_CARBON_INTENSITY = Decimal("99999999.99")


def _blank_to_none(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------


class LCJFIPOptionSchema(BaseSchema):
    id: int
    name: str


class LCJFIPIncentiveOptionSchema(LCJFIPOptionSchema):
    incentive_type: str
    requires_fuel_supplier: bool


class LCJFIPIncentiveRateSchema(BaseSchema):
    incentive_type: str
    ci_lower_bound: Optional[float] = None
    ci_upper_bound: Optional[float] = None
    max_rate_per_litre: float
    description: Optional[str] = None


class LCJFIPReferenceDataSchema(BaseSchema):
    car_types: List[LCJFIPOptionSchema]
    certificate_types: List[LCJFIPOptionSchema]
    feedstock_sources: List[LCJFIPOptionSchema]
    incentive_options: List[LCJFIPIncentiveOptionSchema]
    incentive_rates: List[LCJFIPIncentiveRateSchema]
    max_price_premium_range: float


class LCJFIPFuelCodeOptionSchema(BaseSchema):
    fuel_code_id: int
    fuel_code: str
    carbon_intensity: float
    company: Optional[str] = None


# ---------------------------------------------------------------------------
# Application input
# ---------------------------------------------------------------------------


class LCJFIPPurchaseDetailInputSchema(BaseSchema):
    """One purchase grid row. A row without an id is new."""

    lcjfip_purchase_detail_id: Optional[int] = None
    estimated_volume: Optional[int] = Field(None, ge=0, le=MAX_LITRES)
    anticipated_delivery_date: Optional[date] = None
    feedstock_source_ids: List[int] = Field(default_factory=list)
    estimated_blend_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    assumed_jet_a_price: Optional[Decimal] = Field(None, ge=0, le=MAX_PRICE)
    price_premium_from: Optional[Decimal] = Field(None, ge=0, le=MAX_PRICE)
    price_premium_to: Optional[Decimal] = Field(None, ge=0, le=MAX_PRICE)

    @model_validator(mode="after")
    def premium_range_ordered(self):
        if (
            self.price_premium_from is not None
            and self.price_premium_to is not None
            and self.price_premium_from > self.price_premium_to
        ):
            raise ValueError(
                "The price premium 'From' value must not be greater than 'To'."
            )
        return self


class LCJFIPApplicationSaveSchema(BaseSchema):
    """
    The application form as saved. Every field may be empty on a Draft:
    completeness is checked on submission. The estimated incentive amount is
    calculated, so it is not accepted from the client.
    """

    car_type_ids: List[int] = Field(default_factory=list)
    certificate_type_id: Optional[int] = None
    incentive_option_id: Optional[int] = None
    estimated_carbon_intensity: Optional[Decimal] = Field(
        None, ge=-MAX_CARBON_INTENSITY, le=MAX_CARBON_INTENSITY
    )
    fuel_code_id: Optional[int] = None
    requested_incentive_volume: Optional[int] = Field(None, ge=0, le=MAX_LITRES)
    fuel_supplier_organization_id: Optional[int] = None
    fuel_supplier_legal_name: Optional[str] = Field(None, max_length=500)
    fuel_supplier_contact_first_name: Optional[str] = Field(None, max_length=100)
    fuel_supplier_contact_last_name: Optional[str] = Field(None, max_length=100)
    fuel_supplier_contact_email: Optional[str] = Field(None, max_length=255)
    purchase_details: List[LCJFIPPurchaseDetailInputSchema] = Field(
        default_factory=list
    )

    @field_validator(
        "fuel_supplier_legal_name",
        "fuel_supplier_contact_first_name",
        "fuel_supplier_contact_last_name",
        "fuel_supplier_contact_email",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value):
        return _blank_to_none(value)


class LCJFIPSubmitSchema(BaseSchema):
    """The three signing authority declarations, all required."""

    declaration_authority: bool = False
    declaration_documentation: bool = False
    declaration_public_recognition: bool = False


# ---------------------------------------------------------------------------
# Application output
# ---------------------------------------------------------------------------


class LCJFIPOrganizationInfoSchema(BaseSchema):
    organization_id: int
    name: Optional[str] = None
    operating_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line: Optional[str] = None


class LCJFIPContactSchema(BaseSchema):
    user_profile_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class LCJFIPFuelSupplierOrganizationSchema(BaseSchema):
    organization_id: int
    name: Optional[str] = None


class LCJFIPPurchaseDetailSchema(BaseSchema):
    lcjfip_purchase_detail_id: int
    estimated_volume: Optional[int] = None
    anticipated_delivery_date: Optional[date] = None
    feedstock_source_ids: List[int] = Field(default_factory=list)
    estimated_blend_percentage: Optional[float] = None
    assumed_jet_a_price: Optional[float] = None
    price_premium_from: Optional[float] = None
    price_premium_to: Optional[float] = None


class LCJFIPApplicationSchema(BaseSchema):
    lcjfip_application_id: int
    application_number: str
    status: str
    organization: Optional[LCJFIPOrganizationInfoSchema] = None
    contact: Optional[LCJFIPContactSchema] = None
    car_type_ids: List[int] = Field(default_factory=list)
    certificate_type_id: Optional[int] = None
    incentive_option_id: Optional[int] = None
    incentive_type: Optional[str] = None
    estimated_carbon_intensity: Optional[float] = None
    fuel_code: Optional[LCJFIPFuelCodeOptionSchema] = None
    requested_incentive_volume: Optional[int] = None
    total_estimated_volume: Optional[int] = None
    max_incentive_rate_per_litre: Optional[float] = None
    estimated_incentive_amount: Optional[float] = None
    fuel_supplier_organization: Optional[LCJFIPFuelSupplierOrganizationSchema] = None
    fuel_supplier_legal_name: Optional[str] = None
    fuel_supplier_contact_first_name: Optional[str] = None
    fuel_supplier_contact_last_name: Optional[str] = None
    fuel_supplier_contact_email: Optional[str] = None
    application_period: Optional[str] = None
    signed_by: Optional[str] = None
    signed_date: Optional[datetime] = None
    purchase_details: List[LCJFIPPurchaseDetailSchema] = Field(default_factory=list)
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None


class LCJFIPApplicationListItemSchema(BaseSchema):
    lcjfip_application_id: int
    application_number: str
    status: str
    signed_date: Optional[datetime] = None
    create_date: Optional[datetime] = None
    update_date: Optional[datetime] = None
