import math
import structlog
import uuid
from fastapi import Depends, HTTPException, status
from typing import Optional, List

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
    AllocationAgreementResponseSchema,
)
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.compliance_report.repo import ComplianceReportRepository
from lcfs.web.api.fuel_code.repo import FuelCodeRepository
from lcfs.web.api.fuel_supply.services import FuelSupplyServices
from lcfs.web.core.decorators import service_handler

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
}


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
        if allocation_agreement.fuel_code:
            fuel_code = await self.fuel_repo.get_fuel_code_by_name(
                allocation_agreement.fuel_code
            )
            fuel_code_id = fuel_code.fuel_code_id

        return AllocationAgreement(
            **allocation_agreement.model_dump(
                exclude={
                    "allocation_agreement_id",
                    "allocation_transaction_type",
                    "fuel_category",
                    "fuel_type",
                    "provision_of_the_act",
                    "fuel_code",
                    "deleted",
                }
            ),
            allocation_transaction_type_id=allocation_transaction_type.allocation_transaction_type_id,
            fuel_category_id=fuel_category.fuel_category_id,
            fuel_type_id=fuel_type.fuel_type_id,
            provision_of_the_act_id=provision_of_the_act.provision_of_the_act_id,
            fuel_code_id=fuel_code_id
        )

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
        self,
        compliance_report_id: int,
        changelog: bool = False,
    ) -> AllocationAgreementAllSchema:
        """Get all Allocation agreements for a compliance report"""
        # Expect raw models from repo
        allocation_agreements_models: List[AllocationAgreement] = (
            await self.repo.get_allocation_agreements(
                compliance_report_id=compliance_report_id, changelog=changelog
            )
        )
        allocation_agreements_response = []
        # Map directly from ORM models
        for aa in allocation_agreements_models:
            aa_response = AllocationAgreementResponseSchema(
                allocation_agreement_id=aa.allocation_agreement_id,
                compliance_report_id=aa.compliance_report_id,
                allocation_transaction_type=aa.allocation_transaction_type.type,
                transaction_partner=aa.transaction_partner,
                postal_address=aa.postal_address,
                transaction_partner_email=aa.transaction_partner_email,
                transaction_partner_phone=aa.transaction_partner_phone,
                fuel_type=aa.fuel_type.fuel_type,
                fuel_category_id=aa.fuel_category_id,
                fuel_category=(aa.fuel_category.category if aa.fuel_category else None),
                fuel_type_other=aa.fuel_type_other,
                ci_of_fuel=aa.ci_of_fuel,
                provision_of_the_act=(
                    aa.provision_of_the_act.name if aa.provision_of_the_act else None
                ),
                quantity=aa.quantity,
                units=aa.units,
                fuel_code=(aa.fuel_code.fuel_code if aa.fuel_code else None),
                group_uuid=aa.group_uuid,
                version=aa.version,
                action_type=aa.action_type,
                updated=None,  # Assuming this is not mapped
            )
            allocation_agreements_response.append(aa_response)
        return AllocationAgreementAllSchema(
            allocation_agreements=allocation_agreements_response
        )

    @service_handler
    async def get_allocation_agreements_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> AllocationAgreementListSchema:
        # Repo returns raw models and count
        allocation_agreements_models, total_count = (
            await self.repo.get_allocation_agreements_paginated(
                pagination, compliance_report_id
            )
        )
        allocation_agreements_response = []
        for aa in allocation_agreements_models:
            # Construct the ResponseSchema using strings from ORM model attributes
            aa_response = AllocationAgreementResponseSchema(
                allocation_agreement_id=aa.allocation_agreement_id,
                compliance_report_id=aa.compliance_report_id,
                allocation_transaction_type=aa.allocation_transaction_type.type,
                transaction_partner=aa.transaction_partner,
                postal_address=aa.postal_address,
                transaction_partner_email=aa.transaction_partner_email,
                transaction_partner_phone=aa.transaction_partner_phone,
                fuel_type=aa.fuel_type.fuel_type,
                fuel_category_id=aa.fuel_category_id,
                fuel_category=(aa.fuel_category.category if aa.fuel_category else None),
                fuel_type_other=aa.fuel_type_other,
                ci_of_fuel=aa.ci_of_fuel,
                provision_of_the_act=(
                    aa.provision_of_the_act.name if aa.provision_of_the_act else None
                ),
                quantity=aa.quantity,
                units=aa.units,
                fuel_code=(aa.fuel_code.fuel_code if aa.fuel_code else None),
                group_uuid=aa.group_uuid,
                version=aa.version,
                action_type=aa.action_type,
                updated=None,
            )
            allocation_agreements_response.append(aa_response)
        return AllocationAgreementListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            allocation_agreements=allocation_agreements_response,
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
            existing_allocation_agreement.ci_of_fuel = (
                allocation_agreement_data.ci_of_fuel
            )
            existing_allocation_agreement.quantity = allocation_agreement_data.quantity
            existing_allocation_agreement.units = allocation_agreement_data.units
            existing_allocation_agreement.fuel_type_other = (
                allocation_agreement_data.fuel_type_other
            )
            existing_allocation_agreement.group_uuid = (
                allocation_agreement_data.group_uuid
            )
            existing_allocation_agreement.version = (
                existing_allocation_agreement.version + 1
            )
            existing_allocation_agreement.action_type = ActionTypeEnum.UPDATE

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
                units=updated_allocation_agreement.units,
                compliance_report_id=updated_allocation_agreement.compliance_report_id,
                allocation_transaction_type=updated_allocation_agreement.allocation_transaction_type.type,
                fuel_type=updated_allocation_agreement.fuel_type.fuel_type,
                fuel_type_other=updated_allocation_agreement.fuel_type_other,
                fuel_category=(
                    updated_allocation_agreement.fuel_category.category
                    if updated_allocation_agreement.fuel_category
                    else None
                ),
                provision_of_the_act=(
                    updated_allocation_agreement.provision_of_the_act.name
                    if updated_allocation_agreement.provision_of_the_act
                    else None
                ),
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
            units=created_allocation_agreement.units,
            compliance_report_id=created_allocation_agreement.compliance_report_id,
            allocation_transaction_type=allocation_transaction_type_value,
            fuel_type=fuel_type_value,
            fuel_type_other=created_allocation_agreement.fuel_type_other,
            fuel_category=(
                created_allocation_agreement.fuel_category.category
                if created_allocation_agreement.fuel_category
                else None
            ),
            provision_of_the_act=(
                created_allocation_agreement.provision_of_the_act.name
                if created_allocation_agreement.provision_of_the_act
                else None
            ),
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

        # If the compliance report IDs match, also delete the original record
        if (
            existing_allocation_agreement.compliance_report_id
            == allocation_agreement_data.compliance_report_id
        ):
            await self.repo.delete_allocation_agreement(
                allocation_agreement_data.allocation_agreement_id
            )

        # Always create the deletion record
        await self.repo.create_allocation_agreement(deleted_entity)

        return DeleteAllocationAgreementResponseSchema(message="Marked as deleted.")

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
