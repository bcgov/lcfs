import math
import structlog
from typing import List
from fastapi import Depends
from datetime import datetime

from lcfs.web.api.other_uses.repo import OtherUsesRepository
from lcfs.web.core.decorators import service_handler
from lcfs.db.models.compliance.OtherUses import OtherUses
from lcfs.web.api.base import PaginationRequestSchema, PaginationResponseSchema
from lcfs.web.api.other_uses.schema import (
    OtherUsesCreateSchema,
    OtherUsesSchema,
    OtherUsesListSchema,
    OtherUsesTableOptionsSchema,
    OtherUsesFuelCategorySchema,
    OtherUsesAllSchema,
    FuelTypeSchema,
    UnitOfMeasureSchema,
    ExpectedUseTypeSchema,
    ProvisionOfTheActSchema,
    FuelCodeSchema,
)
from lcfs.web.api.fuel_code.repo import FuelCodeRepository

logger = structlog.get_logger(__name__)


class OtherUsesServices:
    def __init__(
        self,
        repo: OtherUsesRepository = Depends(OtherUsesRepository),
        fuel_repo: FuelCodeRepository = Depends(),
    ) -> None:
        self.repo = repo
        self.fuel_repo = fuel_repo

    async def convert_to_model(self, other_use: OtherUsesCreateSchema) -> OtherUses:
        """
        Converts data from OtherUsesCreateSchema to OtherUses data model to store into the database.
        """
        fuel_category = await self.fuel_repo.get_fuel_category_by_name(
            other_use.fuel_category
        )
        fuel_type = await self.fuel_repo.get_fuel_type_by_name(other_use.fuel_type)
        provision_of_the_act = await self.fuel_repo.get_provision_of_the_act_by_name(
            other_use.provision_of_the_act
        )

        fuel_code_id = None
        if other_use.fuel_code:
            fuel_code = await self.fuel_repo.get_fuel_code_by_name(other_use.fuel_code)
            fuel_code_id = fuel_code.fuel_code_id

        expected_use = await self.fuel_repo.get_expected_use_type_by_name(
            other_use.expected_use
        )

        return OtherUses(
            **other_use.model_dump(
                exclude={
                    "id",
                    "fuel_category",
                    "fuel_type",
                    "provision_of_the_act",
                    "fuel_code",
                    "expected_use",
                    "deleted",
                }
            ),
            fuel_category_id=fuel_category.fuel_category_id,
            fuel_type_id=fuel_type.fuel_type_id,
            provision_of_the_act_id=provision_of_the_act.provision_of_the_act_id,
            fuel_code_id=fuel_code_id,
            expected_use_id=expected_use.expected_use_type_id
        )

    @service_handler
    async def get_table_options(self) -> OtherUsesTableOptionsSchema:
        """
        Gets the list of table options related to other uses.
        """
        table_options = await self.repo.get_table_options()
        return OtherUsesTableOptionsSchema(
            fuel_categories=[
                OtherUsesFuelCategorySchema.model_validate(category)
                for category in table_options["fuel_categories"]
            ],
            fuel_types=[
                FuelTypeSchema.model_validate(fuel_type)
                for fuel_type in table_options["fuel_types"]
            ],
            units_of_measure=table_options["units_of_measure"],
            expected_uses=[
                ExpectedUseTypeSchema.model_validate(use)
                for use in table_options["expected_uses"]
            ],
            provisions_of_the_act=[
                ProvisionOfTheActSchema.model_validate(provision)
                for provision in table_options["provisions_of_the_act"]
            ],
            fuel_codes=[
                FuelCodeSchema.model_validate(fuel_code)
                for fuel_code in table_options["fuel_codes"]
            ],
        )

    @service_handler
    async def get_other_uses(self, compliance_report_id: int) -> OtherUsesListSchema:
        """
        Gets the list of other uses for a specific compliance report.
        """
        other_uses = await self.repo.get_other_uses(compliance_report_id)
        return OtherUsesAllSchema(
            other_uses=[OtherUsesSchema.model_validate(ou) for ou in other_uses]
        )

    @service_handler
    async def get_other_uses_paginated(
        self, pagination: PaginationRequestSchema, compliance_report_id: int
    ) -> OtherUsesListSchema:
        other_uses, total_count = await self.repo.get_other_uses_paginated(
            pagination, compliance_report_id
        )
        return OtherUsesListSchema(
            pagination=PaginationResponseSchema(
                total=total_count,
                page=pagination.page,
                size=pagination.size,
                total_pages=math.ceil(total_count / pagination.size),
            ),
            other_uses=[
                OtherUsesSchema(
                    other_uses_id=ou.other_uses_id,
                    compliance_report_id=ou.compliance_report_id,
                    quantity_supplied=ou.quantity_supplied,
                    fuel_type=ou.fuel_type.fuel_type,
                    fuel_category=ou.fuel_category.category,
                    ci_of_fuel=ou.ci_of_fuel,
                    expected_use=ou.expected_use.name,
                    units=ou.units,
                    provision_of_the_act=ou.provision_of_the_act.name,
                    fuel_code=(ou.fuel_code.fuel_code if ou.fuel_code else None),
                    rationale=ou.rationale,
                )
                for ou in other_uses
            ],
        )

    @service_handler
    async def update_other_use(
        self, other_use_data: OtherUsesCreateSchema
    ) -> OtherUsesSchema:
        """Update an existing other use"""
        existing_use = await self.repo.get_other_use(other_use_data.other_uses_id)
        if not existing_use:
            raise ValueError("Other use not found")

        if existing_use.fuel_type.fuel_type != other_use_data.fuel_type:
            existing_use.fuel_type = await self.fuel_repo.get_fuel_type_by_name(
                other_use_data.fuel_type
            )

        if existing_use.fuel_category.category != other_use_data.fuel_category:
            existing_use.fuel_category = await self.fuel_repo.get_fuel_category_by_name(
                other_use_data.fuel_category
            )

        if existing_use.expected_use.name != other_use_data.expected_use:
            existing_use.expected_use = (
                await self.fuel_repo.get_expected_use_type_by_name(
                    other_use_data.expected_use
                )
            )

        if (
            not existing_use.provision_of_the_act
            or existing_use.provision_of_the_act.name
            != other_use_data.provision_of_the_act
        ):
            existing_use.provision_of_the_act = (
                await self.get_provision_of_the_act_by_name(
                    other_use_data.provision_of_the_act
                )
            )

        if (
            existing_use.fuel_code is None
            or other_use_data.fuel_code is None
            or existing_use.fuel_code.fuel_code != other_use_data.fuel_code
        ):
            existing_use.fuel_code = await self.fuel_repo.get_fuel_code_by_name(
                other_use_data.fuel_code
            )

        existing_use.ci_of_fuel = other_use_data.ci_of_fuel
        existing_use.quantity_supplied = other_use_data.quantity_supplied
        existing_use.rationale = other_use_data.rationale

        updated_use = await self.repo.update_other_use(existing_use)

        return OtherUsesSchema(
            other_uses_id=updated_use.other_uses_id,
            compliance_report_id=updated_use.compliance_report_id,
            quantity_supplied=updated_use.quantity_supplied,
            fuel_type=updated_use.fuel_type.fuel_type,
            fuel_category=updated_use.fuel_category.category,
            expected_use=updated_use.expected_use.name,
            units=updated_use.units,
            provision_of_the_act=updated_use.provision_of_the_act.name,
            fuel_code=(
                updated_use.fuel_code.fuel_code if updated_use.fuel_code else None
            ),
            ci_of_fuel=updated_use.ci_of_fuel,
            rationale=updated_use.rationale,
        )

    @service_handler
    async def create_other_use(
        self, other_use_data: OtherUsesCreateSchema
    ) -> OtherUsesSchema:
        """Create a new other use"""
        other_use = await self.convert_to_model(other_use_data)
        created_use = await self.repo.create_other_use(other_use)

        fuel_category_value = created_use.fuel_category.category
        fuel_type_value = created_use.fuel_type.fuel_type
        expected_use_value = created_use.expected_use.name
        provision_of_the_act_value = created_use.provision_of_the_act.name

        fuel_code_value = (
            created_use.fuel_code.fuel_code if created_use.fuel_code else None
        )

        return OtherUsesSchema(
            other_uses_id=created_use.other_uses_id,
            compliance_report_id=created_use.compliance_report_id,
            quantity_supplied=created_use.quantity_supplied,
            rationale=created_use.rationale,
            units=created_use.units,
            fuel_type=fuel_type_value,
            fuel_category=fuel_category_value,
            provision_of_the_act=provision_of_the_act_value,
            fuel_code=fuel_code_value,
            ci_of_fuel=created_use.ci_of_fuel,
            expected_use=expected_use_value,
        )

    @service_handler
    async def delete_other_use(self, other_uses_id: int) -> str:
        """Delete an other use"""
        return await self.repo.delete_other_use(other_uses_id)
