from pydantic import Field, model_validator
from typing import Optional, List

from lcfs.web.api.base import (
    BaseSchema,
    ComplianceReportRequestSchema,
    FilterModel,
    SortOrder,
    PaginationResponseSchema,
)
from lcfs.web.api.fuel_code.schema import FuelCodeResponseSchema
from lcfs.web.api.fuel_supply.schema import FuelTypeOptionsResponse
from lcfs.web.api.fuel_type.schema import FuelTypeQuantityUnitsEnumSchema
from lcfs.web.utils.schema_validators import fuel_code_required_label


class AllocationTransactionTypeSchema(BaseSchema):
    allocation_transaction_type_id: int
    type: str


class FuelCategorySchema(BaseSchema):
    fuel_category_id: int
    category: str
    default_and_prescribed_ci: Optional[float] = None


class FuelCategoryResponseSchema(BaseSchema):
    fuel_category_id: Optional[int] = None
    category: str


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
    fuel_categories: Optional[List[FuelCategorySchema]] = Field(default_factory=list)
    fuel_codes: Optional[List[FuelCodeSchema]] = Field(default_factory=list)
    provision_of_the_act: Optional[List[ProvisionOfTheActSchema]] = Field(
        default_factory=list
    )


class FuelTypeChangelogSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    default_carbon_intensity: float
    units: str
    unrecognized: bool


class ProvisionOfTheActSchema(BaseSchema):
    provision_of_the_act_id: int
    name: str


class AllocationAgreementTableOptionsSchema(BaseSchema):
    allocation_transaction_types: List[AllocationTransactionTypeSchema]
    fuel_types: List[FuelTypeSchema]
    provisions_of_the_act: List[ProvisionOfTheActSchema]
    fuel_codes: List[FuelCodeSchema]
    units_of_measure: List[str]


class AllocationAgreementChangelogFuelTypeSchema(BaseSchema):
    fuel_type_id: int
    fuel_type: str
    fossil_derived: Optional[bool] = None
    provision_1_id: Optional[int] = None
    provision_2_id: Optional[int] = None
    default_carbon_intensity: Optional[float] = None
    units: FuelTypeQuantityUnitsEnumSchema


class AllocationAgreementResponseSchema(BaseSchema):
    compliance_report_id: int
    allocation_agreement_id: int
    allocation_transaction_type: AllocationTransactionTypeSchema
    transaction_partner: str
    postal_address: str
    transaction_partner_email: str
    transaction_partner_phone: str
    fuel_type: FuelTypeChangelogSchema
    fuel_category_id: Optional[int] = None
    fuel_category: FuelCategoryResponseSchema
    fuel_type_other: Optional[str] = None
    ci_of_fuel: Optional[float] = None
    provision_of_the_act: Optional[ProvisionOfTheActSchema] = None
    quantity: int
    units: str
    fuel_category: FuelCategoryResponseSchema
    fuel_code: Optional[FuelCodeResponseSchema] = None
    group_uuid: str
    version: int
    action_type: str
    updated: Optional[bool] = None


class AllocationAgreementChangelogSchema(BaseSchema):
    compliance_report_id: int
    allocation_agreement_id: Optional[int] = None
    allocation_transaction_type: str
    transaction_partner: str
    postal_address: str
    transaction_partner_email: str
    transaction_partner_phone: str
    fuel_type: AllocationAgreementChangelogFuelTypeSchema
    fuel_type_other: Optional[str] = None
    ci_of_fuel: float
    provision_of_the_act: str
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    units: str
    fuel_category: FuelCategorySchema
    fuel_code: Optional[FuelCodeSchema] = None
    deleted: Optional[bool] = None
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    action_type: Optional[str] = None
    updated: Optional[bool] = None


class FuelCategoryResponseSchema(BaseSchema):
    fuel_category_id: Optional[int] = None
    category: str


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
    ci_of_fuel: Optional[float] = 0
    provision_of_the_act: str
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    units: str
    fuel_category: str
    fuel_code: Optional[str] = None
    deleted: Optional[bool] = None
    group_uuid: Optional[str] = None
    version: Optional[int] = None
    action_type: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def check_fuel_code_required(cls, values):
        return fuel_code_required_label(values)


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

class AllocationAgreementRequestSchema(ComplianceReportRequestSchema):
    changelog: Optional[bool] = None

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
