import math
import structlog
import uuid
from fastapi import Depends, HTTPException, status
from typing import Optional

from lcfs.db.base import ActionTypeEnum
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementCreateSchema,
    AllocationAgreementOptionsSchema,
    AllocationAgreementSchema,
    AllocationAgreementListSchema,
    AllocationAgreementTableOptionsSchema,
    AllocationAgreementAllSchema,
    AllocationTransactionTypeSchema,
    DeleteAllocationAgreementResponseSchema,
)
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.fuel.FuelCode import FuelCode
from lcfs.db.models.fuel.FuelType import FuelType

logger = structlog.get_logger(__name__)

# Define constants for excluded fields in model operations
ALLOCATION_AGREEMENT_EXCLUDE_FIELDS = {
    "id",
    "allocation_agreement_id",
    "deleted",
    "group_uuid",
    "user_type",
    "version",
    "action_type",
    "is_new_supplemental_entry",
    "compliance_report_id",
}

PROVISION_APPROVED_FUEL_CODE = "Fuel code - section 19 (b) (i)"


class AllocationAgreementServices:
    def __init__(
        self,
        repo: AllocationAgreementRepository = Depends(AllocationAgreementRepository),
        fuel_repo: FuelCodeRepository = Depends(),
        fuel_supply_service: FuelSupplyServices = Depends(),
        compliance_report_repo: ComplianceReportRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo
        self.fuel_supply_service = fuel_supply_service
        self.compliance_report_repo = compliance_report_repo

    async def convert_to_model(
        self, allocation_agreement: AllocationAgreementCreateSchema
    ) -> AllocationAgreement:
        """
        Converts data from AllocationAgreementCreateSchema to AllocationAgreement data model to store into the database.
        """
        allocation_transaction_type = (
            await self.repo.get_allocation_transaction_type_by_name(
                allocation_agreement.allocation_transaction_type
            )
        )
        fuel_category = await self.fuel_repo.get_fuel_category_by(
            category=allocation_agreement.fuel_category
        )
        fuel_type = await self.fuel_repo.get_fuel_type_by_name(
            allocation_agreement.fuel_type
        )
        provision_of_the_act = await self.fuel_repo.get_provision_of_the_act_by_name(
            allocation_agreement.provision_of_the_act
        )

        # Fetch fuel code only if provided, else set it to None
        fuel_code_id = None
        fuel_code = None
        if allocation_agreement.fuel_code:
            fuel_code_obj = await self.fuel_repo.get_fuel_code_by_name(
                allocation_agreement.fuel_code
            )
            fuel_code_id = fuel_code_obj.fuel_code_id
            fuel_code = fuel_code_obj

        result = AllocationAgreement(
            **allocation_agreement.model_dump(
                exclude={
                    "allocation_agreement_id",
                    "allocation_transaction_type",
                    "fuel_category",
                    "fuel_type",
                    "provision_of_the_act",
                    "fuel_code",
                    "deleted",
                    "ci_of_fuel",
                    "units",
                }
            ),
            allocation_transaction_type_id=allocation_transaction_type.allocation_transaction_type_id,
            fuel_category_id=fuel_category.fuel_category_id,
            fuel_type_id=fuel_type.fuel_type_id,
            provision_of_the_act_id=provision_of_the_act.provision_of_the_act_id,
            fuel_code_id=fuel_code_id
        )

        # Now recalc and assign ci_of_fuel and units
        recalculated_ci = await self.calculate_ci_of_fuel(
            fuel_type=fuel_type,
            fuel_category=fuel_category,
            provision_of_the_act=allocation_agreement.provision_of_the_act,
            fuel_code=fuel_code,
        )
        result.ci_of_fuel = recalculated_ci
        result.units = self.calculate_units(fuel_type)

        return result

    @service_handler
    async def get_table_options(
        self, compliance_period: str
    ) -> AllocationAgreementTableOptionsSchema:
        """
        Gets the list of table options related to allocation agreements.
        """
        table_options = await self.repo.get_table_options(compliance_period)
        options = await self.fuel_supply_service.get_fuel_supply_options(
            compliance_period
        )
        return AllocationAgreementOptionsSchema(
            allocation_transaction_types=[
                AllocationTransactionTypeSchema.model_validate(
                    allocation_transaction_type
                )
                for allocation_transaction_type in table_options[
                    "allocation_transaction_types"
                ]
            ],
            fuel_types=options.fuel_types,
        )

    @service_handler
    async def get_allocation_agreements(
        self, compliance_report_id: int, changelog: bool = False
    ) -> AllocationAgreementListSchema:
        """
        Gets the list of allocation agreements for a specific compliance report.
        """
        allocation_agreements = await self.repo.get_allocation_agreements(
            compliance_report_id, changelog=changelog
        )

        return AllocationAgreementAllSchema(
            allocation_agreements=[
                AllocationAgreementSchema.model_validate(aa)
                for aa in allocation_agreements
            ]
        )

    @service_handler
    async def get_allocation_agreements_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> AllocationAgreementListSchema:
        allocation_agreements, total_count = (
            await self.repo.get_allocation_agreements_paginated(
                pagination, compliance_report_id
            )
        )
        return AllocationAgreementListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            allocation_agreements=[
                AllocationAgreementSchema(
                    allocation_agreement_id=allocation_agreement.allocation_agreement_id,
                    transaction_partner=allocation_agreement.transaction_partner,
                    transaction_partner_email=allocation_agreement.transaction_partner_email,
                    transaction_partner_phone=allocation_agreement.transaction_partner_phone,
                    postal_address=allocation_agreement.postal_address,
                    ci_of_fuel=allocation_agreement.ci_of_fuel,
                    quantity=allocation_agreement.quantity,
                    q1_quantity=allocation_agreement.q1_quantity,
                    q2_quantity=allocation_agreement.q2_quantity,
                    q3_quantity=allocation_agreement.q3_quantity,
                    q4_quantity=allocation_agreement.q4_quantity,
                    units=allocation_agreement.units,
                    allocation_transaction_type=allocation_agreement.allocation_transaction_type.type,
                    fuel_type=allocation_agreement.fuel_type.fuel_type,
                    fuel_category=allocation_agreement.fuel_category.category,
                    provision_of_the_act=allocation_agreement.provision_of_the_act.name,
                    # Set fuel_code only if it exists
                    fuel_code=(
                        allocation_agreement.fuel_code.fuel_code
                        if allocation_agreement.fuel_code
                        else None
                    ),
                    compliance_report_id=allocation_agreement.compliance_report_id,
                )
                for allocation_agreement in allocation_agreements
            ],
        )

    @service_handler
    async def update_allocation_agreement(
        self,
        allocation_agreement_data: AllocationAgreementCreateSchema,
    ) -> AllocationAgreementSchema:
        """Update an existing Allocation agreement"""
        existing_allocation_agreement = (
            await self.repo.get_latest_allocation_agreement_by_group_uuid(
                allocation_agreement_data.group_uuid
            )
        )
        if not existing_allocation_agreement:
            raise ValueError("Allocation agreement not found")

        if (
            existing_allocation_agreement.compliance_report_id
            == allocation_agreement_data.compliance_report_id
        ):

            if (
                existing_allocation_agreement.allocation_transaction_type.type
                != allocation_agreement_data.allocation_transaction_type
            ):
                existing_allocation_agreement.allocation_transaction_type = (
                    await self.repo.get_allocation_transaction_type_by_name(
                        allocation_agreement_data.allocation_transaction_type
                    )
                )

            if (
                existing_allocation_agreement.fuel_type.fuel_type
                != allocation_agreement_data.fuel_type
            ):
                existing_allocation_agreement.fuel_type = (
                    await self.fuel_repo.get_fuel_type_by_name(
                        allocation_agreement_data.fuel_type
                    )
                )

            if (
                existing_allocation_agreement.fuel_category.category
                != allocation_agreement_data.fuel_category
            ):
                existing_allocation_agreement.fuel_category = (
                    await self.fuel_repo.get_fuel_category_by(
                        category=allocation_agreement_data.fuel_category
                    )
                )

            if (
                existing_allocation_agreement.provision_of_the_act.name
                != allocation_agreement_data.provision_of_the_act
            ):
                existing_allocation_agreement.provision_of_the_act = (
                    await self.fuel_repo.get_provision_of_the_act_by_name(
                        allocation_agreement_data.provision_of_the_act
                    )
                )

            if (
                existing_allocation_agreement.fuel_code is None
                or allocation_agreement_data.fuel_code is None
                or existing_allocation_agreement.fuel_code.fuel_code
                != allocation_agreement_data.fuel_code
            ):

                existing_allocation_agreement.fuel_code = (
                    await self.fuel_repo.get_fuel_code_by_name(
                        allocation_agreement_data.fuel_code
                    )
                )

            existing_allocation_agreement.transaction_partner = (
                allocation_agreement_data.transaction_partner
            )
            existing_allocation_agreement.transaction_partner_email = (
                allocation_agreement_data.transaction_partner_email
            )
            existing_allocation_agreement.transaction_partner_phone = (
                allocation_agreement_data.transaction_partner_phone
            )
            existing_allocation_agreement.postal_address = (
                allocation_agreement_data.postal_address
            )
            recalculated_ci = await self.calculate_ci_of_fuel(
                fuel_type=existing_allocation_agreement.fuel_type,
                fuel_category=existing_allocation_agreement.fuel_category,
                provision_of_the_act=existing_allocation_agreement.provision_of_the_act.name,
                fuel_code=existing_allocation_agreement.fuel_code,
            )
            existing_allocation_agreement.ci_of_fuel = recalculated_ci
            existing_allocation_agreement.units = self.calculate_units(
                existing_allocation_agreement.fuel_type
            )
            existing_allocation_agreement.quantity = allocation_agreement_data.quantity
            existing_allocation_agreement.q1_quantity = (
                allocation_agreement_data.q1_quantity
            )
            existing_allocation_agreement.q2_quantity = (
                allocation_agreement_data.q2_quantity
            )
            existing_allocation_agreement.q3_quantity = (
                allocation_agreement_data.q3_quantity
            )
            existing_allocation_agreement.q4_quantity = (
                allocation_agreement_data.q4_quantity
            )
            existing_allocation_agreement.fuel_type_other = (
                allocation_agreement_data.fuel_type_other
            )
            existing_allocation_agreement.group_uuid = (
                allocation_agreement_data.group_uuid
            )
            existing_allocation_agreement.version = (
                existing_allocation_agreement.version
            )
            existing_allocation_agreement.action_type = (
                existing_allocation_agreement.action_type
            )

            updated_allocation_agreement = await self.repo.update_allocation_agreement(
                existing_allocation_agreement
            )

            return AllocationAgreementSchema(
                allocation_agreement_id=updated_allocation_agreement.allocation_agreement_id,
                transaction_partner=updated_allocation_agreement.transaction_partner,
                transaction_partner_email=updated_allocation_agreement.transaction_partner_email,
                transaction_partner_phone=updated_allocation_agreement.transaction_partner_phone,
                postal_address=updated_allocation_agreement.postal_address,
                ci_of_fuel=updated_allocation_agreement.ci_of_fuel,
                quantity=updated_allocation_agreement.quantity,
                q1_quantity=updated_allocation_agreement.q1_quantity,
                q2_quantity=updated_allocation_agreement.q2_quantity,
                q3_quantity=updated_allocation_agreement.q3_quantity,
                q4_quantity=updated_allocation_agreement.q4_quantity,
                units=updated_allocation_agreement.units,
                compliance_report_id=updated_allocation_agreement.compliance_report_id,
                allocation_transaction_type=updated_allocation_agreement.allocation_transaction_type.type,
                fuel_type=updated_allocation_agreement.fuel_type.fuel_type,
                fuel_type_other=updated_allocation_agreement.fuel_type_other,
                fuel_category=updated_allocation_agreement.fuel_category.category,
                provision_of_the_act=updated_allocation_agreement.provision_of_the_act.name,
                fuel_code=(
                    updated_allocation_agreement.fuel_code.fuel_code
                    if updated_allocation_agreement.fuel_code
                    else None
                ),
                group_uuid=updated_allocation_agreement.group_uuid,
                version=updated_allocation_agreement.version,
                action_type=updated_allocation_agreement.action_type,
            )
        else:
            return await self.create_allocation_agreement(
                allocation_agreement_data, existing_allocation_agreement
            )

    @service_handler
    async def create_allocation_agreement(
        self,
        allocation_agreement_data: AllocationAgreementCreateSchema,
        existing_record: Optional[AllocationAgreement] = None,
    ) -> AllocationAgreementSchema:
        """Create a new Allocation agreement"""
        allocation_agreement = await self.convert_to_model(allocation_agreement_data)

        new_group_uuid = str(uuid.uuid4())
        allocation_agreement.group_uuid = (
            new_group_uuid if not existing_record else existing_record.group_uuid
        )
        allocation_agreement.action_type = (
            ActionTypeEnum.CREATE if not existing_record else ActionTypeEnum.UPDATE
        )
        allocation_agreement.version = (
            0 if not existing_record else existing_record.version + 1
        )
        allocation_agreement.create_date = (
            existing_record.create_date if existing_record else None
        )
        allocation_agreement.create_user = (
            existing_record.create_user if existing_record else None
        )

        created_allocation_agreement = await self.repo.create_allocation_agreement(
            allocation_agreement
        )

        allocation_transaction_type_value = (
            created_allocation_agreement.allocation_transaction_type.type
        )
        fuel_type_value = created_allocation_agreement.fuel_type.fuel_type
        fuel_category_value = created_allocation_agreement.fuel_category.category
        provision_of_the_act_value = (
            created_allocation_agreement.provision_of_the_act.name
        )

        # Set fuel_code_value only if the fuel_code is present
        fuel_code_value = (
            created_allocation_agreement.fuel_code.fuel_code
            if created_allocation_agreement.fuel_code
            else None
        )

        return AllocationAgreementSchema(
            allocation_agreement_id=created_allocation_agreement.allocation_agreement_id,
            transaction_partner=created_allocation_agreement.transaction_partner,
            transaction_partner_email=created_allocation_agreement.transaction_partner_email,
            transaction_partner_phone=created_allocation_agreement.transaction_partner_phone,
            postal_address=created_allocation_agreement.postal_address,
            ci_of_fuel=created_allocation_agreement.ci_of_fuel,
            quantity=created_allocation_agreement.quantity,
            q1_quantity=created_allocation_agreement.q1_quantity,
            q2_quantity=created_allocation_agreement.q2_quantity,
            q3_quantity=created_allocation_agreement.q3_quantity,
            q4_quantity=created_allocation_agreement.q4_quantity,
            units=created_allocation_agreement.units,
            compliance_report_id=created_allocation_agreement.compliance_report_id,
            allocation_transaction_type=allocation_transaction_type_value,
            fuel_type=fuel_type_value,
            fuel_type_other=created_allocation_agreement.fuel_type_other,
            fuel_category=fuel_category_value,
            provision_of_the_act=provision_of_the_act_value,
            fuel_code=fuel_code_value,
            group_uuid=created_allocation_agreement.group_uuid,
            version=created_allocation_agreement.version,
            action_type=created_allocation_agreement.action_type,
        )

    @service_handler
    async def delete_allocation_agreement(
        self,
        allocation_agreement_data: AllocationAgreementCreateSchema,
    ) -> DeleteAllocationAgreementResponseSchema:
        """Delete an allocation agreement"""
        existing_allocation_agreement = (
            await self.repo.get_latest_allocation_agreement_by_group_uuid(
                allocation_agreement_data.group_uuid
            )
        )
        if not existing_allocation_agreement:
            raise HTTPException(
                status_code=404, detail="Allocation agreement record not found."
            )
        # If the compliance report IDs match, also delete the original record
        if (
            existing_allocation_agreement.compliance_report_id
            == allocation_agreement_data.compliance_report_id
        ):
            await self.repo.delete_allocation_agreement(
                allocation_agreement_data.allocation_agreement_id
            )
            return DeleteAllocationAgreementResponseSchema(
                success=True, message="Marked as deleted."
            )
        # If the record is already deleted, just return success
        if existing_allocation_agreement.action_type == ActionTypeEnum.DELETE:
            return DeleteAllocationAgreementResponseSchema(message="Marked as deleted.")

        # Create a deletion record
        deleted_entity = AllocationAgreement(
            compliance_report_id=allocation_agreement_data.compliance_report_id,
            group_uuid=allocation_agreement_data.group_uuid,
            version=existing_allocation_agreement.version + 1,
            action_type=ActionTypeEnum.DELETE,
        )

        # Copy fields from the latest version for the deletion record
        for field in existing_allocation_agreement.__table__.columns.keys():
            if field not in ALLOCATION_AGREEMENT_EXCLUDE_FIELDS:
                setattr(
                    deleted_entity, field, getattr(existing_allocation_agreement, field)
                )

        # Always create the deletion record
        await self.repo.create_allocation_agreement(deleted_entity)

        return DeleteAllocationAgreementResponseSchema(message="Marked as deleted.")

    @service_handler
    async def delete_all(self, compliance_report_id: int, current_user: str) -> None:
        """
        Deletes all allocation agreements associated with a compliance report.

        Args:
            compliance_report_id: The ID of the compliance report whose allocation agreements will be deleted.
            current_user: The username of the user performing the deletion.

        Returns:
            None
        """

        # Allow bulk delete only when the target compliance report is version 0
        compliance_report = await self.get_compliance_report_by_id(compliance_report_id)
        if compliance_report.version != 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Bulk delete is permitted only on original reports (version 0). "
                ),
            )

        await self.repo.delete_all_for_report(compliance_report_id)

    @service_handler
    async def get_compliance_report_by_id(self, compliance_report_id: int):
        """Get compliance report by period with status"""
        compliance_report = (
            await self.compliance_report_repo.get_compliance_report_by_id(
                compliance_report_id,
            )
        )

        if not compliance_report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance report not found for this period",
            )

        return compliance_report

    async def calculate_ci_of_fuel(
        self,
        fuel_type: FuelType,
        fuel_category: object,
        provision_of_the_act: Optional[str] = None,
        fuel_code: Optional[FuelCode] = None,
    ) -> float:
        """
        Calculate carbon intensity of fuel based on provided parameters.
        Uses fuel code CI if available with approved provision, otherwise uses default CI from fuel type.

        Args:
            fuel_type: Fuel type model
            provision_of_the_act: Optional provision specification
            fuel_code: Optional fuel code model

        Returns:
            float: Carbon intensity value
        """

        # Approved fuel code scenario
        if provision_of_the_act == PROVISION_APPROVED_FUEL_CODE and fuel_code:
            return float(fuel_code.carbon_intensity or 0.0)

            # Unrecognized fuel type: use the category’s default carbon intensity
        if fuel_type.unrecognized:
            return float(getattr(fuel_category, "default_carbon_intensity", 0.0) or 0.0)

        # Normal scenario – the fuel_type itself has default_carbon_intensity
        return float(fuel_type.default_carbon_intensity or 0.0)

    def calculate_units(self, fuel_type: FuelType) -> str:
        """
        Retrieves the string representation of a fuel type's quantity units.

        Args:
            fuel_type (FuelType): The fuel type object containing units information.

        Returns:
            str: String representation of the quantity units enum value.

        Example:
            If fuel_type.units is QuantityUnitsEnum.KILOGRAMS, returns "kilograms".
        """
        return fuel_type.units.value
