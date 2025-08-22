from datetime import datetime
from typing import Generic, List, Optional, TypeVar
from lcfs.db.models.compliance.NotionalTransfer import ReceivedOrTransferredEnum
from lcfs.web.api.base import Auditable, BaseSchema, Versioning
from pydantic import BaseModel


class EndUseTypeDTO(BaseSchema):
    type: str


class ProvisionOfTheActDTO(BaseSchema):
    name: str


class FuelTypeDTO(BaseSchema):
    fuel_type: str


class FuelCodeDTO(BaseSchema):
    fuel_code: str


class FuelCategoryDTO(BaseSchema):
    category: str


class AllocationTransactionTypeDTO(BaseSchema):
    type: str


class ExpectedUseDTO(BaseSchema):
    name: str


class ChangelogItemsBaseDTO(BaseModel):
    updated: Optional[bool] = None
    diff: Optional[List[str]] = None
    update_date: Optional[datetime] = None
    create_date: Optional[datetime] = None


class FuelSupplyDTO(BaseSchema, Auditable, Versioning, ChangelogItemsBaseDTO):
    fuel_supply_id: int
    compliance_report_id: int

    quantity: Optional[int] = None
    units: str

    compliance_units: Optional[float] = None
    target_ci: Optional[float] = None
    ci_of_fuel: Optional[float] = None
    energy_density: Optional[float] = None
    eer: Optional[float] = None
    uci: Optional[float] = None
    energy: Optional[float] = None
    fuel_type_other: Optional[str] = None

    fuel_category: Optional[FuelCategoryDTO] = None
    fuel_code: Optional[FuelCodeDTO] = None
    fuel_type: Optional[FuelTypeDTO] = None
    provision_of_the_act: Optional[ProvisionOfTheActDTO] = None
    is_canada_produced: Optional[bool] = False
    is_q1_supplied: Optional[bool] = False
    end_use_type: Optional[EndUseTypeDTO] = None


class AllocationAgreementDTO(BaseSchema, Auditable, Versioning, ChangelogItemsBaseDTO):
    allocation_agreement_id: int
    compliance_report_id: int

    transaction_partner: str
    postal_address: str
    quantity: Optional[int] = None
    units: str

    transaction_partner_email: Optional[str] = None
    transaction_partner_phone: Optional[str] = None
    fuel_type_other: Optional[str] = None
    ci_of_fuel: Optional[float] = None

    allocation_transaction_type: Optional[AllocationTransactionTypeDTO] = None
    fuel_type: Optional[FuelTypeDTO] = None
    fuel_category: Optional[FuelCategoryDTO] = None
    provision_of_the_act: Optional[ProvisionOfTheActDTO] = None
    fuel_code: Optional[FuelCodeDTO] = None


class NotionalTransferDTO(BaseSchema, Auditable, Versioning, ChangelogItemsBaseDTO):
    notional_transfer_id: int
    compliance_report_id: int

    legal_name: str
    address_for_service: str
    is_canada_produced: Optional[bool] = False
    is_q1_supplied: Optional[bool] = False
    received_or_transferred: ReceivedOrTransferredEnum
    quantity: Optional[int] = None
    q1_quantity: Optional[int] = None
    q2_quantity: Optional[int] = None
    q3_quantity: Optional[int] = None
    q4_quantity: Optional[int] = None

    fuel_category: Optional[FuelCategoryDTO] = None


class OtherUseDTO(BaseSchema, Auditable, Versioning, ChangelogItemsBaseDTO):
    other_uses_id: int
    compliance_report_id: int

    quantity_supplied: int
    units: str
    ci_of_fuel: float

    rationale: Optional[str] = None
    is_canada_produced: Optional[bool] = False
    is_q1_supplied: Optional[bool] = False
    fuel_category: Optional[FuelCategoryDTO] = None
    fuel_code: Optional[FuelCodeDTO] = None
    fuel_type: Optional[FuelTypeDTO] = None
    provision_of_the_act: Optional[ProvisionOfTheActDTO] = None
    expected_use: Optional[ExpectedUseDTO] = None


class FuelExportDTO(BaseSchema, Auditable, Versioning, ChangelogItemsBaseDTO):
    fuel_export_id: int
    compliance_report_id: int

    quantity: int
    units: str

    export_date: Optional[datetime] = None
    compliance_units: Optional[float] = None
    target_ci: Optional[float] = None
    ci_of_fuel: Optional[float] = None
    uci: Optional[float] = None
    energy_density: Optional[float] = None
    eer: Optional[float] = None
    energy: Optional[float] = None

    fuel_category: Optional[FuelCategoryDTO] = None
    fuel_code: Optional[FuelCodeDTO] = None
    fuel_type: Optional[FuelTypeDTO] = None
    provision_of_the_act: Optional[ProvisionOfTheActDTO] = None
    end_use_type: Optional[EndUseTypeDTO] = None


class ChangelogReportBaseDTO(BaseSchema):
    compliance_report_id: int
    version: int
    nickname: str


class ChangelogFuelSuppliesDTO(ChangelogReportBaseDTO):
    fuel_supplies: Optional[List[FuelSupplyDTO]] = None


class ChangelogFuelExportsDTO(ChangelogReportBaseDTO):
    fuel_exports: Optional[List[FuelExportDTO]] = None


class ChangelogOtherUsesDTO(ChangelogReportBaseDTO):
    other_uses: Optional[List[OtherUseDTO]] = None


class ChangelogNotionalTransfersDTO(ChangelogReportBaseDTO):
    notional_transfers: Optional[List[NotionalTransferDTO]] = None


class ChangelogAllocationAgreementsDTO(ChangelogReportBaseDTO):
    allocation_agreements: Optional[List[AllocationAgreementDTO]] = None
