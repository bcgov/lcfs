from typing import Optional, List
from lcfs.web.api.fuel_supply.schema import FuelTypeOptionsResponse
from pydantic import Field, field_validator
from lcfs.web.api.base import (
    BaseSchema,
    FilterModel,
    SortOrder,
    PaginationRequestSchema,
    PaginationResponseSchema,
)
from enum import Enum


class AllocationTransactionTypeSchema(BaseSchema):
    allocation_transaction_type_id: int
    type: str


class FuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    default_and_prescribed_ci: Optional[float] = None


class FuelCodeSchema(BaseSchema):
    fuel_code_id: int
    fuel_code: str
    carbon_intensity: float


class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    name: str

class FuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    default_carbon_intensity: float
    units: str
    unrecognized: bool
    fuel_categories: List[FuelCategorySchema]
    fuel_codes: Optional[List[FuelCodeSchema]] = []
    provision_of_the_act: Optional[List[ProvisionOfTheActSchema]] = []


class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    name: str


class AllocationAgreementTableOptionsSchema(BaseSchema):
    allocation_transaction_types: List[AllocationTransactionTypeSchema]
    fuel_types: List[FuelTypeSchema]
    provisions_of_the_act: List[ProvisionOfTheActSchema]
    fuel_codes: List[FuelCodeSchema]
    units_of_measure: List[str]


class AllocationAgreementCreateSchema(BaseSchema):
    compliance_report_id: int
    allocation_agreement_id: Optional[int] = None
    allocation_transaction_type: str
    transaction_partner: str
    postal_address: str
    transaction_partner_email: str
    transaction_partner_phone: str
    fuel_type: str
    fuel_type_other: Optional[str] = None
    ci_of_fuel: float
    provision_of_the_act: str
    quantity: int = Field(
        ..., gt=0, description="Quantity must be greater than 0"
    )
    units: str
    fuel_category: str
    fuel_code: Optional[str] = None
    deleted: Optional[bool] = None


class AllocationAgreementSchema(AllocationAgreementCreateSchema):
    pass


class AllocationAgreementAllSchema(BaseSchema):
    allocation_agreements: List[AllocationAgreementSchema]
    pagination: Optional[PaginationResponseSchema] = {}


class AllocationAgreementListSchema(BaseSchema):
    allocation_agreements: List[AllocationAgreementSchema]
    pagination: PaginationResponseSchema


class PaginatedAllocationAgreementRequestSchema(BaseSchema):
    compliance_report_id: int = Field(..., alias="complianceReportId")
    filters: List[FilterModel]
    page: int
    size: int
    sort_orders: List[SortOrder]


class DeleteAllocationAgreementsSchema(BaseSchema):
    allocation_agreement_id: int
    compliance_report_id: int


class DeleteAllocationAgreementResponseSchema(BaseSchema):
    message: str


class OrganizationDetailsSchema(BaseSchema):
    name: str
    address: Optional[str]
    email: Optional[str]
    phone: Optional[str]

class AllocationAgreementOptionsSchema(FuelTypeOptionsResponse):
    allocation_transaction_types: List[AllocationTransactionTypeSchema]