import math
from logging import getLogger
from typing import List
from fastapi import Depends
from datetime import datetime

from lcfs.web.api.allocation_agreement.repo import AllocationAgreementRepository
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.compliance.AllocationAgreement import AllocationAgreement
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.allocation_agreement.schema import (
    AllocationAgreementCreateSchema,
    AllocationAgreementSchema,
    AllocationAgreementListSchema,
    AllocationAgreementTableOptionsSchema,
    # AllocationAgreementFuelCategorySchema,
    AllocationAgreementAllSchema,
    FuelTypeSchema,
    FuelCategorySchema,
    AllocationTransactionTypeSchema,
    ProvisionOfTheActSchema,
    FuelCodeSchema,
    # UnitOfMeasureSchema,
    # ExpectedUseTypeSchema
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository

logger = getLogger("allocation_agreement_services")


class AllocationAgreementServices:
    def __init__(
        self,
        repo: AllocationAgreementRepository = Depends(AllocationAgreementRepository),
        fuel_repo: FuelCodeRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo

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
        fuel_category = await self.fuel_repo.get_fuel_category_by_name(
            allocation_agreement.fuel_category
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
    async def get_table_options(self) -> AllocationAgreementTableOptionsSchema:
        """
        Gets the list of table options related to allocation agreements.
        """
        table_options = await self.repo.get_table_options()
        fuel_types = [
            FuelTypeSchema.model_validate(fuel_type)
            for fuel_type in table_options["fuel_types"]
        ]
        # fuel_types.append({'fuel_type': "Other"}) # TODO handle custom fuel types after refactor

        return AllocationAgreementTableOptionsSchema(
            allocation_transaction_types=[
                AllocationTransactionTypeSchema.model_validate(
                    allocation_transaction_type
                )
                for allocation_transaction_type in table_options[
                    "allocation_transaction_types"
                ]
            ],
            fuel_types=fuel_types,
            fuel_categories=[
                FuelCategorySchema.model_validate(category)
                for category in table_options["fuel_categories"]
            ],
            provisions_of_the_act=[
                ProvisionOfTheActSchema.model_validate(provision)
                for provision in table_options["provisions_of_the_act"]
            ],
            fuel_codes=[
                FuelCodeSchema.model_validate(fuel_code)
                for fuel_code in table_options["fuel_codes"]
            ],
            units_of_measure=table_options["units_of_measure"],
        )

    @service_handler
    async def get_allocation_agreements(
        self, compliance_report_id: int
    ) -> AllocationAgreementListSchema:
        """
        Gets the list of allocation agreements for a specific compliance report.
        """
        allocation_agreements = await self.repo.get_allocation_agreements(
            compliance_report_id
        )
        return AllocationAgreementAllSchema(
            allocation_agreements=[
                AllocationAgreementSchema.model_validate(allocation_agreement)
                for allocation_agreement in allocation_agreements
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
        self, allocation_agreement_data: AllocationAgreementCreateSchema
    ) -> AllocationAgreementSchema:
        """Update an existing Allocation agreement"""
        existing_allocation_agreement = await self.repo.get_allocation_agreement(
            allocation_agreement_data.allocation_agreement_id
        )
        if not existing_allocation_agreement:
            raise ValueError("Allocation agreement not found")

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
                await self.fuel_repo.get_fuel_category_by_name(
                    allocation_agreement_data.fuel_category
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
            existing_allocation_agreement.fuel_code.fuel_code
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
        existing_allocation_agreement.ci_of_fuel = allocation_agreement_data.ci_of_fuel
        existing_allocation_agreement.quantity = allocation_agreement_data.quantity
        existing_allocation_agreement.units = allocation_agreement_data.units

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
            fuel_category=updated_allocation_agreement.fuel_category.category,
            provision_of_the_act=updated_allocation_agreement.provision_of_the_act.name,
            fuel_code=updated_allocation_agreement.fuel_code.fuel_code,
        )

    @service_handler
    async def create_allocation_agreement(
        self, allocation_agreement_data: AllocationAgreementCreateSchema
    ) -> AllocationAgreementSchema:
        """Create a new Allocation agreement"""
        allocation_agreement = await self.convert_to_model(allocation_agreement_data)
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
            fuel_category=fuel_category_value,
            provision_of_the_act=provision_of_the_act_value,
            fuel_code=fuel_code_value,
        )

    @service_handler
    async def delete_allocation_agreement(self, allocation_agreement_id: int) -> str:
        """Delete an Allocation agreement"""
        return await self.repo.delete_allocation_agreement(allocation_agreement_id)
